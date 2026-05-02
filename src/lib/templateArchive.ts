import JSZip from "jszip";
import { z } from "zod";
import type { AssetId, ProjectAsset, TemplateDocument } from "../types/project";
import { createTemplateDocument, parseTemplateDocument } from "./templateDocument";

export const TEMPLATE_ARCHIVE_EXTENSION = ".dhdecktemplate";
export const TEMPLATE_ARCHIVE_MIME_TYPE = "application/vnd.dhdecktemplate+zip";

const archiveAssetPathSchema = z
  .string()
  .regex(/^(assets|fonts)\/[^/\\]+$/, "Asset files must live directly under assets/ or fonts/.");

const archiveAssetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    path: archiveAssetPathSchema,
  })
  .strict();

const archiveManifestSchema = z
  .object({
    format: z.literal("dhdecktemplate"),
    version: z.literal(1),
    template: z.unknown(),
    assets: z.record(z.string().min(1), archiveAssetSchema),
  })
  .strict();

type ArchiveManifest = z.infer<typeof archiveManifestSchema>;

interface DataUrlPayload {
  mimeType: string;
  bytes: Uint8Array;
}

export async function exportTemplateArchive(document: TemplateDocument): Promise<Blob> {
  const validatedDocument = createTemplateDocument(document.template, document.assets);
  const fontAssetIds = new Set(validatedDocument.template.fonts.map((font) => font.assetId));
  const zip = new JSZip();
  const manifestAssets: ArchiveManifest["assets"] = {};
  const usedPaths = new Set<string>();

  for (const asset of Object.values(validatedDocument.assets)) {
    const payload = dataUrlToBytes(asset.dataUrl, asset.mimeType);
    const path = uniqueAssetArchivePath(asset, fontAssetIds.has(asset.id), usedPaths);

    manifestAssets[asset.id] = {
      id: asset.id,
      name: asset.name,
      mimeType: payload.mimeType,
      path,
    };

    zip.file(path, payload.bytes);
  }

  const manifest: ArchiveManifest = {
    format: "dhdecktemplate",
    version: 1,
    template: validatedDocument.template,
    assets: manifestAssets,
  };

  zip.file("manifest.json", JSON.stringify(archiveManifestSchema.parse(manifest), null, 2));

  return zip.generateAsync({
    type: "blob",
    mimeType: TEMPLATE_ARCHIVE_MIME_TYPE,
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function importTemplateArchive(input: Blob | ArrayBuffer | Uint8Array | string) {
  if (typeof input === "string") {
    return parseTemplateDocument(JSON.parse(input));
  }

  try {
    const zip = await JSZip.loadAsync(input);
    const manifestFile = zip.file("manifest.json");

    if (!manifestFile) {
      throw new Error("manifest.json is missing.");
    }

    const manifest = archiveManifestSchema.parse(JSON.parse(await manifestFile.async("string")));
    const assets: Record<AssetId, ProjectAsset> = {};

    for (const [assetId, manifestAsset] of Object.entries(manifest.assets)) {
      const assetFile = zip.file(manifestAsset.path);

      if (!assetFile) {
        throw new Error(`Asset file "${manifestAsset.path}" is missing.`);
      }

      const bytes = await assetFile.async("uint8array");
      assets[assetId] = {
        id: manifestAsset.id,
        name: manifestAsset.name,
        mimeType: manifestAsset.mimeType,
        dataUrl: bytesToDataUrl(bytes, manifestAsset.mimeType),
      };
    }

    return parseTemplateDocument({
      format: "dhdecktemplate",
      version: 1,
      template: manifest.template,
      assets,
    });
  } catch (error) {
    if (input instanceof ArrayBuffer) {
      const text = new TextDecoder().decode(input);
      return parseTemplateDocument(JSON.parse(text));
    }

    throw error;
  }
}

function dataUrlToBytes(dataUrl: string, fallbackMimeType: string): DataUrlPayload {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("Asset dataUrl must start with data:.");
  }

  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1) {
    throw new Error("Asset dataUrl is missing a payload separator.");
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const data = dataUrl.slice(commaIndex + 1);
  const metadataParts = metadata.split(";").filter(Boolean);
  const declaredMimeType = metadataParts[0]?.includes("/") ? metadataParts[0] : "";
  const mimeType = declaredMimeType || fallbackMimeType || "application/octet-stream";
  const isBase64 = metadataParts.includes("base64");

  if (isBase64) {
    return {
      mimeType,
      bytes: binaryStringToBytes(atob(data)),
    };
  }

  return {
    mimeType,
    bytes: new TextEncoder().encode(decodeURIComponent(data)),
  };
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function binaryStringToBytes(binary: string) {
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function uniqueAssetArchivePath(asset: ProjectAsset, isFont: boolean, usedPaths: Set<string>) {
  const extension = assetExtension(asset);
  const encodedId = encodeURIComponent(asset.id).replace(/\*/g, "%2A");
  const directory = isFont ? "fonts" : "assets";
  let path = `${directory}/${encodedId}${extension}`;
  let suffix = 2;

  while (usedPaths.has(path)) {
    path = `${directory}/${encodedId}-${suffix}${extension}`;
    suffix += 1;
  }

  usedPaths.add(path);
  return path;
}

function assetExtension(asset: ProjectAsset) {
  const match = asset.name.match(/(\.[A-Za-z0-9]+)$/);

  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  switch (asset.mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/svg+xml":
      return ".svg";
    case "image/webp":
      return ".webp";
    case "font/ttf":
    case "application/x-font-ttf":
      return ".ttf";
    case "font/otf":
    case "application/x-font-otf":
      return ".otf";
    case "font/woff":
    case "application/font-woff":
      return ".woff";
    case "font/woff2":
    case "application/font-woff2":
      return ".woff2";
    default:
      return "";
  }
}
