export type AssetId = string;
export type LayerId = string;

export interface CanvasSettings {
  width: number;
  height: number;
}

export interface ProjectAsset {
  id: AssetId;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface EmbeddedFont {
  id: string;
  family: string;
  assetId: AssetId;
}

export interface BaseLayer {
  id: LayerId;
  dynamic: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  lineHeight: number;
  autoShrink: boolean;
}

export interface ImageSlotLayer extends BaseLayer {
  type: "image-slot";
  assetId: AssetId | null;
  fit: "contain" | "cover" | "stretch";
}

export type TemplateLayer = TextLayer | ImageSlotLayer;

export interface DecklistTemplate {
  version: 1;
  canvas: CanvasSettings;
  backgroundAssetId: AssetId | null;
  fonts: EmbeddedFont[];
  layers: TemplateLayer[];
}

export interface TemplateDocument {
  format: "dhdecktemplate";
  version: 1;
  template: DecklistTemplate;
  assets: Record<AssetId, ProjectAsset>;
}

export interface BatchRow {
  id: string;
  name: string;
  values: Record<LayerId, string>;
}
