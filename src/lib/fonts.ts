import type { AssetId, EmbeddedFont, ProjectAsset } from "../types/project";

const registeredFonts = new Set<string>();

export async function registerEmbeddedFont(font: EmbeddedFont, asset: ProjectAsset | undefined) {
  if (!asset || registeredFonts.has(font.id)) {
    return;
  }

  const fontFace = new FontFace(font.family, `url(${asset.dataUrl})`);
  await fontFace.load();
  document.fonts.add(fontFace);
  registeredFonts.add(font.id);
}

export async function registerEmbeddedFonts(
  fonts: EmbeddedFont[],
  assets: Record<AssetId, ProjectAsset>,
) {
  await Promise.all(fonts.map((font) => registerEmbeddedFont(font, assets[font.assetId])));
}
