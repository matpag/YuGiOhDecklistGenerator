import {
  FileImage,
  Image as ImageIcon,
  Plus,
  RectangleHorizontal,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import {
  fileToAsset,
  FONT_FILE_ACCEPT,
  IMAGE_FILE_ACCEPT,
  inferFontFamilyFromFileName,
  validateAssetFile,
} from "../lib/assets";
import { registerEmbeddedFont } from "../lib/fonts";
import { selectedLayerFromState, useProjectStore } from "../store/projectStore";
import type { EmbeddedFont, ImageSlotLayer, TemplateLayer, TextLayer } from "../types/project";

function asNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="field-row">{children}</div>;
}

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({ label, min, onChange, step = 1, value }: NumberFieldProps) {
  return (
    <label>
      {label}
      <input
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(asNumber(event.target.value, value))}
      />
    </label>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ label, onChange, value }: ColorFieldProps) {
  return (
    <label>
      {label}
      <span className="color-control">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

interface CommonLayerControlsProps {
  layer: TemplateLayer;
}

function CommonLayerControls({ layer }: CommonLayerControlsProps) {
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const setLayerId = useProjectStore((state) => state.setLayerId);

  return (
    <>
      <label>
        Layer ID
        <input value={layer.id} onChange={(event) => setLayerId(layer.id, event.target.value)} />
      </label>
      <label className="checkbox-row">
        <input
          checked={layer.dynamic}
          type="checkbox"
          onChange={(event) => updateLayer(layer.id, { dynamic: event.target.checked })}
        />
        Use this layer in batch rows
      </label>
      <FieldRow>
        <NumberField
          label="X"
          value={layer.x}
          onChange={(value) => updateLayer(layer.id, { x: value })}
        />
        <NumberField
          label="Y"
          value={layer.y}
          onChange={(value) => updateLayer(layer.id, { y: value })}
        />
      </FieldRow>
      <FieldRow>
        <NumberField
          label="Width"
          min={1}
          value={layer.width}
          onChange={(value) => updateLayer(layer.id, { width: value })}
        />
        <NumberField
          label="Height"
          min={1}
          value={layer.height}
          onChange={(value) => updateLayer(layer.id, { height: value })}
        />
      </FieldRow>
      <NumberField
        label="Rotation"
        value={layer.rotation}
        onChange={(value) => updateLayer(layer.id, { rotation: value })}
      />
    </>
  );
}

interface TextControlsProps {
  layer: TextLayer;
}

function TextControls({ layer }: TextControlsProps) {
  const template = useProjectStore((state) => state.template);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const fontOptions = [
    "Arial Black",
    "Arial",
    "Impact",
    "Trebuchet MS",
    "Verdana",
    ...template.fonts.map((font) => font.family),
  ];

  return (
    <>
      <label>
        Default text
        <textarea
          value={layer.text}
          onChange={(event) => updateLayer(layer.id, { text: event.target.value })}
        />
      </label>
      <FieldRow>
        <label>
          Font
          <input
            list="font-options"
            value={layer.fontFamily}
            onChange={(event) => updateLayer(layer.id, { fontFamily: event.target.value })}
          />
          <datalist id="font-options">
            {fontOptions.map((font) => (
              <option key={font} value={font} />
            ))}
          </datalist>
        </label>
        <label>
          Style
          <select
            value={layer.fontStyle}
            onChange={(event) => updateLayer(layer.id, { fontStyle: event.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="italic">Italic</option>
            <option value="bold italic">Bold italic</option>
          </select>
        </label>
      </FieldRow>
      <FieldRow>
        <NumberField
          label="Font size"
          min={1}
          value={layer.fontSize}
          onChange={(value) => updateLayer(layer.id, { fontSize: value })}
        />
        <NumberField
          label="Line height"
          min={0.5}
          step={0.05}
          value={layer.lineHeight}
          onChange={(value) => updateLayer(layer.id, { lineHeight: value })}
        />
      </FieldRow>
      <FieldRow>
        <ColorField
          label="Fill"
          value={layer.fill}
          onChange={(value) => updateLayer(layer.id, { fill: value })}
        />
        <ColorField
          label="Stroke"
          value={layer.stroke}
          onChange={(value) => updateLayer(layer.id, { stroke: value })}
        />
      </FieldRow>
      <NumberField
        label="Stroke width"
        min={0}
        value={layer.strokeWidth}
        onChange={(value) => updateLayer(layer.id, { strokeWidth: value })}
      />
      <FieldRow>
        <label>
          Align
          <select
            value={layer.align}
            onChange={(event) =>
              updateLayer(layer.id, { align: event.target.value as TextLayer["align"] })
            }
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label>
          Vertical
          <select
            value={layer.verticalAlign}
            onChange={(event) =>
              updateLayer(layer.id, {
                verticalAlign: event.target.value as TextLayer["verticalAlign"],
              })
            }
          >
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
      </FieldRow>
      <label className="checkbox-row">
        <input
          checked={layer.autoShrink}
          type="checkbox"
          onChange={(event) => updateLayer(layer.id, { autoShrink: event.target.checked })}
        />
        Auto-shrink dynamic text
      </label>
      <label className="checkbox-row">
        <input
          checked={layer.shadowEnabled}
          type="checkbox"
          onChange={(event) => updateLayer(layer.id, { shadowEnabled: event.target.checked })}
        />
        Shadow
      </label>
      {layer.shadowEnabled ? (
        <>
          <ColorField
            label="Shadow color"
            value={layer.shadowColor}
            onChange={(value) => updateLayer(layer.id, { shadowColor: value })}
          />
          <FieldRow>
            <NumberField
              label="Blur"
              min={0}
              value={layer.shadowBlur}
              onChange={(value) => updateLayer(layer.id, { shadowBlur: value })}
            />
            <NumberField
              label="Offset X"
              value={layer.shadowOffsetX}
              onChange={(value) => updateLayer(layer.id, { shadowOffsetX: value })}
            />
          </FieldRow>
          <NumberField
            label="Offset Y"
            value={layer.shadowOffsetY}
            onChange={(value) => updateLayer(layer.id, { shadowOffsetY: value })}
          />
        </>
      ) : null}
    </>
  );
}

function ImageSlotControls({ layer }: { layer: ImageSlotLayer }) {
  const updateLayer = useProjectStore((state) => state.updateLayer);

  return (
    <label>
      Fit
      <select
        value={layer.fit}
        onChange={(event) =>
          updateLayer(layer.id, { fit: event.target.value as ImageSlotLayer["fit"] })
        }
      >
        <option value="contain">Contain</option>
        <option value="cover">Cover</option>
        <option value="stretch">Stretch</option>
      </select>
    </label>
  );
}

export function EditorSidebar() {
  const selectedLayer = useProjectStore(selectedLayerFromState);
  const template = useProjectStore((state) => state.template);
  const assets = useProjectStore((state) => state.assets);
  const addAsset = useProjectStore((state) => state.addAsset);
  const addFont = useProjectStore((state) => state.addFont);
  const addTextLayer = useProjectStore((state) => state.addTextLayer);
  const addImageSlotLayer = useProjectStore((state) => state.addImageSlotLayer);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const setBackgroundAsset = useProjectStore((state) => state.setBackgroundAsset);
  const removeLayer = useProjectStore((state) => state.removeLayer);

  async function handleBackgroundFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationError = validateAssetFile(file, "image");
    if (validationError) {
      window.alert(validationError);
      return;
    }

    const asset = await fileToAsset(file);
    addAsset(asset);
    setBackgroundAsset(asset.id);
  }

  async function handleFontFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const validationError = validateAssetFile(file, "font");
    if (validationError) {
      window.alert(validationError);
      return;
    }

    const asset = await fileToAsset(file);
    const defaultFamily = inferFontFamilyFromFileName(file.name);
    const alias = window.prompt("Font alias name", defaultFamily);
    const family = alias?.trim() || defaultFamily;
    const font: EmbeddedFont = {
      id: `font-${crypto.randomUUID()}`,
      family,
      assetId: asset.id,
    };

    try {
      await registerEmbeddedFont(font, asset);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not load this font file.");
      return;
    }

    addAsset(asset);
    addFont(font);

    if (selectedLayer?.type === "text") {
      updateLayer(selectedLayer.id, { fontFamily: family });
    }
  }

  return (
    <aside className="sidebar">
      <section className="panel">
        <div className="panel-heading-row">
          <h2>Template</h2>
        </div>
        <label className="file-button">
          <FileImage size={17} />
          Background
          <input
            accept={IMAGE_FILE_ACCEPT}
            type="file"
            onChange={(event) => {
              void handleBackgroundFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="file-button">
          <Upload size={17} />
          Font file
          <input
            accept={FONT_FILE_ACCEPT}
            type="file"
            onChange={(event) => {
              void handleFontFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {template.fonts.length > 0 ? (
          <div className="font-list">
            {template.fonts.map((font) => (
              <div className="font-list-row" key={font.id}>
                <Type size={15} />
                <span style={{ fontFamily: font.family }}>
                  <strong>{font.family}</strong>
                  <small>{assets[font.assetId]?.name ?? "Embedded font"}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No custom fonts embedded yet.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading-row">
          <h2>Add Layer</h2>
        </div>
        <div className="layer-add-grid">
          <button type="button" onClick={addTextLayer}>
            <Type size={17} />
            Text
          </button>
          <button type="button" onClick={addImageSlotLayer}>
            <RectangleHorizontal size={17} />
            Image slot
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading-row">
          <h2>Selected Layer</h2>
          {selectedLayer ? (
            <button
              className="icon-button danger-button"
              title="Delete layer"
              type="button"
              onClick={() => removeLayer(selectedLayer.id)}
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
        {selectedLayer ? (
          <>
            <div className="layer-type-pill">
              {selectedLayer.type === "text" ? <Type size={15} /> : <ImageIcon size={15} />}
              {selectedLayer.type === "text" ? "Text layer" : "Image slot"}
            </div>
            <CommonLayerControls layer={selectedLayer} />
            {selectedLayer.type === "text" ? (
              <TextControls layer={selectedLayer} />
            ) : (
              <ImageSlotControls layer={selectedLayer} />
            )}
          </>
        ) : (
          <p className="empty-state">Select a layer on the canvas or from the layer list.</p>
        )}
      </section>
    </aside>
  );
}
