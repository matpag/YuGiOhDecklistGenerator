import { defaultDocument } from "./defaultTemplate";
import type { BatchRow, ProjectAsset, TemplateDocument } from "../types/project";

export const GUIDE_BACKGROUND_FILE = "guide/decklist-background-1080.png";
export const GUIDE_DECKLIST_FILE = "guide/demo-decklist.png";

export function createGuideSession(background: ProjectAsset, decklist: ProjectAsset) {
  const document: TemplateDocument = structuredClone(defaultDocument);
  document.template.backgroundAssetId = background.id;
  document.assets = { [background.id]: structuredClone(background), [decklist.id]: structuredClone(decklist) };
  document.template.layers = document.template.layers.map((layer) => {
    if (layer.type === "image-slot") return { ...layer, x: 100, y: 270, width: 880, height: 730, fit: "contain" as const, assetId: null };
    return {
      ...layer, x: 100, width: 880, fontFamily: "Arial", fill: "#20324a", strokeWidth: 0,
      align: "center" as const, fontSize: layer.id === "player" ? 40 : 32,
      text: layer.id === "title" ? "RETROFORMATS DEMO · 8P" : layer.text,
      y: layer.id === "title" ? 55 : layer.id === "player" ? 135 : 195,
    };
  });
  const row: BatchRow = {
    id: "guide-row-1", name: "Demo 1",
    values: { player: "1 · Alex Rossi", deck: "Chaos Turbo", decklist: decklist.id },
  };
  // Rows are session data, deliberately separate from the reusable template archive.
  return { ...document, batchRows: [row], selectedBatchRowId: row.id, selectedLayerId: "title" };
}
