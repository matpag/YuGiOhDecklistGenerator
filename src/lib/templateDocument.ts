import { z } from "zod";
import type { AssetId, DecklistTemplate, ProjectAsset, TemplateDocument } from "../types/project";

const assetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    dataUrl: z.string().startsWith("data:"),
  })
  .strict();

const baseLayerSchema = z.object({
  id: z.string().min(1),
  dynamic: z.boolean().default(true),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number(),
});

const textLayerSchema = baseLayerSchema
  .extend({
    type: z.literal("text"),
    text: z.string(),
    fontFamily: z.string().min(1),
    fontStyle: z.string(),
    fontSize: z.number().min(1),
    fill: z.string().min(1),
    stroke: z.string().min(1),
    strokeWidth: z.number().min(0),
    shadowEnabled: z.boolean(),
    shadowColor: z.string().min(1),
    shadowBlur: z.number().min(0),
    shadowOffsetX: z.number(),
    shadowOffsetY: z.number(),
    align: z.enum(["left", "center", "right"]),
    verticalAlign: z.enum(["top", "middle", "bottom"]),
    lineHeight: z.number().min(0.5),
    autoShrink: z.boolean(),
  });

const imageSlotLayerSchema = baseLayerSchema
  .extend({
    type: z.literal("image-slot"),
    fit: z.enum(["contain", "cover", "stretch"]),
  });

const templateSchema = z
  .object({
    version: z.literal(1),
    canvas: z.object({ width: z.literal(1080), height: z.literal(1080) }).strict(),
    backgroundAssetId: z.string().min(1).nullable(),
    fonts: z
      .array(
        z
          .object({
            id: z.string().min(1),
            family: z.string().min(1),
            assetId: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    layers: z.array(z.discriminatedUnion("type", [textLayerSchema, imageSlotLayerSchema])),
  })
  .strict();

const templateDocumentSchema = z
  .object({
    format: z.literal("dhdecktemplate"),
    version: z.literal(1),
    template: templateSchema,
    assets: z.record(z.string().min(1), assetSchema),
  })
  .strict();

export function parseTemplateDocument(input: unknown): TemplateDocument {
  const document = templateDocumentSchema.parse(input);

  if (
    document.template.backgroundAssetId &&
    !document.assets[document.template.backgroundAssetId]
  ) {
    throw new Error("Invalid template: background image asset is missing.");
  }

  for (const font of document.template.fonts) {
    if (!document.assets[font.assetId]) {
      throw new Error(`Invalid template: font asset for "${font.family}" is missing.`);
    }
  }

  return document;
}

export function createTemplateDocument(
  template: DecklistTemplate,
  assets: Record<AssetId, ProjectAsset>,
): TemplateDocument {
  const templateAssets: Record<AssetId, ProjectAsset> = {};

  if (template.backgroundAssetId) {
    templateAssets[template.backgroundAssetId] = requireAsset(
      assets,
      template.backgroundAssetId,
      "background image",
    );
  }

  for (const font of template.fonts) {
    templateAssets[font.assetId] = requireAsset(
      assets,
      font.assetId,
      `font "${font.family}"`,
    );
  }

  return parseTemplateDocument({
    format: "dhdecktemplate",
    version: 1,
    template,
    assets: templateAssets,
  });
}

export function templateFileName(template: DecklistTemplate) {
  const firstText = template.layers.find((layer) => layer.type === "text");
  const seed = firstText?.type === "text" ? firstText.text : "decklist-template";
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);

  return `${slug || "decklist-template"}.dhdecktemplate`;
}

function requireAsset(
  assets: Record<AssetId, ProjectAsset>,
  assetId: AssetId,
  label: string,
) {
  const asset = assets[assetId];

  if (!asset?.dataUrl) {
    throw new Error(`Could not save template: embedded asset for ${label} is missing.`);
  }

  return asset;
}
