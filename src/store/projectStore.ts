import { create } from "zustand";
import { defaultDocument } from "../data/defaultTemplate";
import type {
  AssetId,
  BatchRow,
  CanvasSettings,
  DecklistTemplate,
  EmbeddedFont,
  ImageSlotLayer,
  LayerId,
  ProjectAsset,
  TemplateDocument,
  TemplateLayer,
  TextLayer,
} from "../types/project";

interface ProjectState extends TemplateDocument {
  selectedLayerId: LayerId | null;
  selectedBatchRowId: string;
  batchRows: BatchRow[];
  loadDocument: (document: TemplateDocument) => void;
  updateCanvas: (updates: Partial<CanvasSettings>) => void;
  addAsset: (asset: ProjectAsset) => AssetId;
  addFont: (font: EmbeddedFont) => void;
  removeFont: (fontId: string) => void;
  setBackgroundAsset: (assetId: AssetId | null) => void;
  addTextLayer: () => void;
  addImageSlotLayer: () => void;
  pasteLayer: (layer: TemplateLayer) => void;
  updateLayer: (layerId: LayerId, updates: Partial<TemplateLayer>) => void;
  setLayerId: (layerId: LayerId, nextId: string) => void;
  selectLayer: (layerId: LayerId | null) => void;
  removeLayer: (layerId: LayerId) => void;
  moveLayer: (layerId: LayerId, direction: -1 | 1) => void;
  addBatchRow: () => void;
  duplicateBatchRow: (rowId: string) => void;
  removeBatchRow: (rowId: string) => void;
  selectBatchRow: (rowId: string) => void;
  updateBatchValue: (rowId: string, layerId: LayerId, value: string) => void;
}

const initialRowId = "row-1";

export const useProjectStore = create<ProjectState>((set) => ({
  ...structuredClone(defaultDocument),
  selectedLayerId: defaultDocument.template.layers[0]?.id ?? null,
  selectedBatchRowId: initialRowId,
  batchRows: [
    {
      id: initialRowId,
      name: "Decklist 1",
      values: {},
    },
  ],
  loadDocument: (document) =>
    set({
      ...structuredClone(document),
      selectedLayerId: document.template.layers[0]?.id ?? null,
      selectedBatchRowId: initialRowId,
      batchRows: [
        {
          id: initialRowId,
          name: "Decklist 1",
          values: {},
        },
      ],
    }),
  updateCanvas: (updates) =>
    set((state) => ({
      template: {
        ...state.template,
        canvas: {
          ...state.template.canvas,
          ...updates,
        },
      },
    })),
  addAsset: (asset) => {
    set((state) => ({
      assets: {
        ...state.assets,
        [asset.id]: asset,
      },
    }));

    return asset.id;
  },
  addFont: (font) =>
    set((state) => ({
      template: {
        ...state.template,
        fonts: [
          ...state.template.fonts.filter(
            (existingFont) =>
              existingFont.id !== font.id && existingFont.family !== font.family,
          ),
          font,
        ],
      },
    })),
  removeFont: (fontId) =>
    set((state) => {
      const font = state.template.fonts.find((embeddedFont) => embeddedFont.id === fontId);

      if (!font) {
        return state;
      }

      const remainingFonts = state.template.fonts.filter(
        (embeddedFont) => embeddedFont.id !== fontId,
      );
      const assetStillUsedByFont = remainingFonts.some(
        (embeddedFont) => embeddedFont.assetId === font.assetId,
      );
      const assets = assetStillUsedByFont
        ? state.assets
        : Object.fromEntries(
            Object.entries(state.assets).filter(([assetId]) => assetId !== font.assetId),
          );

      return {
        assets,
        template: {
          ...state.template,
          fonts: remainingFonts,
          layers: state.template.layers.map((layer) =>
            layer.type === "text" && layer.fontFamily === font.family
              ? { ...layer, fontFamily: "Arial" }
              : layer,
          ),
        },
      };
    }),
  setBackgroundAsset: (assetId) =>
    set((state) => ({
      template: {
        ...state.template,
        backgroundAssetId: assetId,
      },
    })),
  addTextLayer: () =>
    set((state) => {
      const id = uniqueLayerId(state.template, "text");
      const width = Math.min(520, state.template.canvas.width);
      const height = Math.min(80, state.template.canvas.height);
      const layer: TextLayer = {
        id,
        type: "text",
        dynamic: true,
        text: "Text",
        x: Math.round((state.template.canvas.width - width) / 2),
        y: Math.round((state.template.canvas.height - height) / 2),
        width,
        height,
        rotation: 0,
        fontFamily: state.template.fonts[0]?.family ?? "Arial Black",
        fontStyle: "bold",
        fontSize: 44,
        fill: "#f2d15d",
        stroke: "#000000",
        strokeWidth: 5,
        shadowEnabled: false,
        shadowColor: "#000000",
        shadowBlur: 8,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        align: "left",
        verticalAlign: "middle",
        lineHeight: 1,
        autoShrink: true,
      };

      return appendLayer(state, layer);
    }),
  addImageSlotLayer: () =>
    set((state) => {
      const id = uniqueLayerId(state.template, "decklist");
      const width = Math.round(state.template.canvas.width * 0.5);
      const height = Math.round(state.template.canvas.height * 0.5);
      const layer: ImageSlotLayer = {
        id,
        type: "image-slot",
        dynamic: true,
        x: Math.round((state.template.canvas.width - width) / 2),
        y: Math.round((state.template.canvas.height - height) / 2),
        width,
        height,
        rotation: 0,
        assetId: null,
        fit: "contain",
      };

      return appendLayer(state, layer);
    }),
  pasteLayer: (sourceLayer) =>
    set((state) => {
      const id = uniqueLayerId(state.template, `${sourceLayer.id}-copy`);
      const layer = {
        ...sourceLayer,
        id,
        x: boundedPastedPosition(
          sourceLayer.x,
          sourceLayer.width,
          state.template.canvas.width,
        ),
        y: boundedPastedPosition(
          sourceLayer.y,
          sourceLayer.height,
          state.template.canvas.height,
        ),
      } as TemplateLayer;

      return appendLayer(state, layer);
    }),
  updateLayer: (layerId, updates) =>
    set((state) => ({
      template: {
        ...state.template,
        layers: state.template.layers.map((layer) =>
          layer.id === layerId && updates.type === undefined
            ? ({ ...layer, ...updates } as TemplateLayer)
            : layer,
        ),
      },
    })),
  setLayerId: (layerId, nextId) =>
    set((state) => {
      const normalizedId = normalizeLayerId(nextId) || layerId;
      const uniqueId = uniqueLayerId(state.template, normalizedId, layerId);

      return {
        selectedLayerId: state.selectedLayerId === layerId ? uniqueId : state.selectedLayerId,
        template: {
          ...state.template,
          layers: state.template.layers.map((layer) =>
            layer.id === layerId ? { ...layer, id: uniqueId } : layer,
          ),
        },
        batchRows: state.batchRows.map((row) => {
          if (!(layerId in row.values)) {
            return row;
          }

          const { [layerId]: oldValue, ...values } = row.values;
          return {
            ...row,
            values: {
              ...values,
              [uniqueId]: oldValue,
            },
          };
        }),
      };
    }),
  selectLayer: (layerId) => set({ selectedLayerId: layerId }),
  removeLayer: (layerId) =>
    set((state) => {
      const layers = state.template.layers.filter((layer) => layer.id !== layerId);

      return {
        selectedLayerId:
          state.selectedLayerId === layerId ? layers[0]?.id ?? null : state.selectedLayerId,
        template: {
          ...state.template,
          layers,
        },
        batchRows: state.batchRows.map((row) => {
          const { [layerId]: _removed, ...values } = row.values;
          return { ...row, values };
        }),
      };
    }),
  moveLayer: (layerId, direction) =>
    set((state) => {
      const index = state.template.layers.findIndex((layer) => layer.id === layerId);
      const nextIndex = index + direction;

      if (index === -1 || nextIndex < 0 || nextIndex >= state.template.layers.length) {
        return state;
      }

      const layers = [...state.template.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(nextIndex, 0, layer);

      return {
        template: {
          ...state.template,
          layers,
        },
      };
    }),
  addBatchRow: () =>
    set((state) => {
      const id = `row-${crypto.randomUUID()}`;
      return {
        selectedBatchRowId: id,
        batchRows: [
          ...state.batchRows,
          {
            id,
            name: `Decklist ${state.batchRows.length + 1}`,
            values: {},
          },
        ],
      };
    }),
  duplicateBatchRow: (rowId) =>
    set((state) => {
      const source = state.batchRows.find((row) => row.id === rowId);

      if (!source) {
        return state;
      }

      const id = `row-${crypto.randomUUID()}`;
      return {
        selectedBatchRowId: id,
        batchRows: [
          ...state.batchRows,
          {
            id,
            name: `${source.name} copy`,
            values: { ...source.values },
          },
        ],
      };
    }),
  removeBatchRow: (rowId) =>
    set((state) => {
      if (state.batchRows.length <= 1) {
        return state;
      }

      const rows = state.batchRows.filter((row) => row.id !== rowId);
      return {
        selectedBatchRowId:
          state.selectedBatchRowId === rowId ? rows[0].id : state.selectedBatchRowId,
        batchRows: rows,
      };
    }),
  selectBatchRow: (rowId) => set({ selectedBatchRowId: rowId }),
  updateBatchValue: (rowId, layerId, value) =>
    set((state) => ({
      batchRows: state.batchRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              values: {
                ...row.values,
                [layerId]: value,
              },
            }
          : row,
      ),
    })),
}));

function appendLayer(state: ProjectState, layer: TemplateLayer): Partial<ProjectState> {
  return {
    selectedLayerId: layer.id,
    template: {
      ...state.template,
      layers: [...state.template.layers, layer],
    },
  };
}

function boundedPastedPosition(position: number, size: number, canvasSize: number) {
  const offsetPosition = Math.round(position + 24);

  if (offsetPosition + size <= canvasSize) {
    return offsetPosition;
  }

  return Math.max(0, Math.round((canvasSize - size) / 2));
}

function uniqueLayerId(template: DecklistTemplate, seed: string, ignoredLayerId?: string) {
  const baseId = normalizeLayerId(seed) || "layer";
  const usedIds = new Set(
    template.layers.filter((layer) => layer.id !== ignoredLayerId).map((layer) => layer.id),
  );

  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function normalizeLayerId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function selectedLayerFromState(state: ProjectState) {
  return state.template.layers.find((layer) => layer.id === state.selectedLayerId) ?? null;
}
