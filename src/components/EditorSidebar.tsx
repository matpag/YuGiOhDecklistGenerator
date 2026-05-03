import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileImage,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RectangleHorizontal,
  Search,
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

const FALLBACK_FONT_OPTIONS = [
  "Arial Black",
  "Arial",
  "Calibri",
  "Cambria",
  "Comic Sans MS",
  "Courier New",
  "Georgia",
  "Impact",
  "Inter",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
];

interface LocalFontData {
  family: string;
}

interface FontMenuPosition {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

interface FontSelectProps {
  label: string;
  onChange: (fontFamily: string) => void;
  onOpen: () => void;
  options: string[];
  value: string;
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFontData[]>;
  }
}

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
  fontOptions: string[];
  layer: TextLayer;
  onFontOpen: () => void;
}

function TextControls({ fontOptions, layer, onFontOpen }: TextControlsProps) {
  const updateLayer = useProjectStore((state) => state.updateLayer);

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
        <div className="field-label">
          <span>Font</span>
          <FontSelect
            label="Font"
            options={fontOptions}
            value={layer.fontFamily}
            onOpen={onFontOpen}
            onChange={(fontFamily) => updateLayer(layer.id, { fontFamily })}
          />
        </div>
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
  const assets = useProjectStore((state) => state.assets);
  const addAsset = useProjectStore((state) => state.addAsset);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const slotAsset = layer.assetId ? assets[layer.assetId] : null;

  async function handleSlotImageFile(file: File | undefined) {
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
    updateLayer(layer.id, { assetId: asset.id });
  }

  return (
    <>
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
      <label className="file-button">
        <Upload size={17} />
        {slotAsset ? slotAsset.name : "Upload slot image"}
        <input
          accept={IMAGE_FILE_ACCEPT}
          type="file"
          onChange={(event) => {
            void handleSlotImageFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {layer.dynamic && slotAsset ? (
        <p className="field-warning">
          This image will be replaced at export time by the batch row image.
        </p>
      ) : null}
    </>
  );
}

interface EditorSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function EditorSidebar({ collapsed, onToggleCollapsed }: EditorSidebarProps) {
  const selectedLayer = useProjectStore(selectedLayerFromState);
  const template = useProjectStore((state) => state.template);
  const assets = useProjectStore((state) => state.assets);
  const addAsset = useProjectStore((state) => state.addAsset);
  const addFont = useProjectStore((state) => state.addFont);
  const addTextLayer = useProjectStore((state) => state.addTextLayer);
  const addImageSlotLayer = useProjectStore((state) => state.addImageSlotLayer);
  const updateCanvas = useProjectStore((state) => state.updateCanvas);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const setBackgroundAsset = useProjectStore((state) => state.setBackgroundAsset);
  const removeLayer = useProjectStore((state) => state.removeLayer);
  const removeFont = useProjectStore((state) => state.removeFont);
  const [fontAccessRequested, setFontAccessRequested] = useState(false);
  const [fontOptions, setFontOptions] = useState(() =>
    mergeFontOptions([...FALLBACK_FONT_OPTIONS, ...fontFamiliesFromTemplate(template)]),
  );

  useEffect(() => {
    setFontOptions((currentOptions) =>
      mergeFontOptions([
        ...currentOptions,
        ...FALLBACK_FONT_OPTIONS,
        ...fontFamiliesFromTemplate(template),
      ]),
    );
  }, [template]);

  async function loadSystemFonts() {
    if (fontAccessRequested || !window.queryLocalFonts) {
      return;
    }

    setFontAccessRequested(true);

    try {
      const localFonts = await window.queryLocalFonts();
      setFontOptions((currentOptions) =>
        mergeFontOptions([
          ...currentOptions,
          ...localFonts.map((font) => font.family),
          ...FALLBACK_FONT_OPTIONS,
          ...fontFamiliesFromTemplate(template),
        ]),
      );
    } catch {
      setFontOptions((currentOptions) =>
        mergeFontOptions([
          ...currentOptions,
          ...FALLBACK_FONT_OPTIONS,
          ...fontFamiliesFromTemplate(template),
        ]),
      );
    }
  }

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
    setFontOptions((currentOptions) => mergeFontOptions([...currentOptions, family]));

    if (selectedLayer?.type === "text") {
      updateLayer(selectedLayer.id, { fontFamily: family });
    }
  }

  function handleRemoveFont(font: EmbeddedFont) {
    removeFont(font.id);
    setFontOptions((currentOptions) => {
      return mergeFontOptions(
        currentOptions.filter((fontOption) => fontOption !== font.family),
      );
    });
  }

  if (collapsed) {
    return (
      <aside className="sidebar sidebar-collapsed">
        <button
          className="sidebar-collapse-button"
          title="Expand editor sidebar"
          type="button"
          onClick={onToggleCollapsed}
        >
          <PanelLeftOpen size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <button
        className="sidebar-collapse-button sidebar-collapse-button-inline"
        title="Collapse editor sidebar"
        type="button"
        onClick={onToggleCollapsed}
      >
        <PanelLeftClose size={18} />
      </button>
      <section className="panel">
        <h2>Canvas</h2>
        <FieldRow>
          <NumberField
            label="Width"
            min={1}
            value={template.canvas.width}
            onChange={(value) => updateCanvas({ width: Math.round(value) })}
          />
          <NumberField
            label="Height"
            min={1}
            value={template.canvas.height}
            onChange={(value) => updateCanvas({ height: Math.round(value) })}
          />
        </FieldRow>
      </section>
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
                <button
                  className="icon-button danger-button"
                  title={`Delete ${font.family}`}
                  type="button"
                  onClick={() => handleRemoveFont(font)}
                >
                  <Trash2 size={15} />
                </button>
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
              <TextControls
                fontOptions={fontOptions}
                layer={selectedLayer}
                onFontOpen={loadSystemFonts}
              />
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

function FontSelect({ label, onChange, onOpen, options, value }: FontSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const skipNextFocusOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [menuPosition, setMenuPosition] = useState<FontMenuPosition | null>(null);
  const menuId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-menu`;
  const availableOptions = mergeFontOptions([...options, value]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? availableOptions.filter((font) => font.toLowerCase().includes(normalizedQuery))
    : availableOptions;

  useEffect(() => {
    if (!isOpen) {
      setQuery(value);
    }
  }, [isOpen, value]);

  function updateMenuPosition() {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    const rect = input.getBoundingClientRect();
    const gap = 4;
    const viewportMargin = 10;
    const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
    const spaceAbove = rect.top - viewportMargin;
    const opensAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, opensAbove ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(320, availableHeight - gap);
    const top = opensAbove
      ? Math.max(viewportMargin, rect.top - maxHeight - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - maxHeight - viewportMargin);
    const left = Math.min(
      Math.max(viewportMargin, rect.left),
      Math.max(viewportMargin, window.innerWidth - rect.width - viewportMargin),
    );

    setMenuPosition({
      left,
      maxHeight,
      top,
      width: rect.width,
    });
  }

  function openMenu() {
    onOpen();
    setIsOpen(true);
  }

  function closeMenu() {
    setIsOpen(false);
  }

  function focusInputWithoutOpening() {
    skipNextFocusOpenRef.current = true;
    inputRef.current?.focus();
    window.setTimeout(() => {
      skipNextFocusOpenRef.current = false;
    }, 0);
  }

  function selectFont(font: string) {
    onChange(font);
    setQuery(font);
    closeMenu();
    focusInputWithoutOpening();
  }

  useLayoutEffect(() => {
    if (isOpen) {
      updateMenuPosition();
    }
  }, [isOpen, filteredOptions.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (inputRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <>
      <div className="font-combobox">
        <input
          ref={inputRef}
          aria-autocomplete="list"
          aria-controls={isOpen ? menuId : undefined}
          aria-expanded={isOpen}
          aria-label={label}
          className="font-combobox-input"
          role="combobox"
          value={isOpen ? query : value}
          onChange={(event) => {
            setQuery(event.target.value);
            openMenu();
          }}
          onFocus={() => {
            if (skipNextFocusOpenRef.current) {
              return;
            }

            openMenu();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              openMenu();
              menuRef.current?.querySelector<HTMLButtonElement>(".font-select-option")?.focus();
            }

            if (event.key === "Enter") {
              const exactMatch = availableOptions.find(
                (font) => font.toLowerCase() === query.trim().toLowerCase(),
              );
              const nextFont = exactMatch ?? filteredOptions[0];

              if (nextFont) {
                event.preventDefault();
                selectFont(nextFont);
              }
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setQuery(value);
              closeMenu();
            }
          }}
        />
        <Search aria-hidden="true" className="font-combobox-icon" size={15} />
      </div>
      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              aria-label={label}
              className="font-select-menu"
              id={menuId}
              role="listbox"
              style={{
                left: menuPosition.left,
                maxHeight: menuPosition.maxHeight,
                top: menuPosition.top,
                width: menuPosition.width,
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setQuery(value);
                  closeMenu();
                  focusInputWithoutOpening();
                }

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  const options = Array.from(
                    menuRef.current?.querySelectorAll<HTMLButtonElement>(".font-select-option") ??
                      [],
                  );
                  const currentIndex = options.findIndex(
                    (option) => option === document.activeElement,
                  );
                  options[Math.min(currentIndex + 1, options.length - 1)]?.focus();
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  const options = Array.from(
                    menuRef.current?.querySelectorAll<HTMLButtonElement>(".font-select-option") ??
                      [],
                  );
                  const currentIndex = options.findIndex(
                    (option) => option === document.activeElement,
                  );

                  if (currentIndex <= 0) {
                    inputRef.current?.focus();
                    return;
                  }

                  options[currentIndex - 1]?.focus();
                }
              }}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((font) => (
                  <button
                    aria-selected={font === value}
                    className={`font-select-option ${
                      font === value ? "font-select-option-active" : ""
                    }`}
                    key={font}
                    role="option"
                    type="button"
                    onClick={() => {
                      selectFont(font);
                    }}
                  >
                    {font}
                  </button>
                ))
              ) : (
                <div className="font-select-empty">No fonts found</div>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function fontFamiliesFromTemplate(template: ReturnType<typeof useProjectStore.getState>["template"]) {
  return [
    ...template.fonts.map((font) => font.family),
    ...template.layers.flatMap((layer) => (layer.type === "text" ? [layer.fontFamily] : [])),
  ];
}

function mergeFontOptions(fonts: string[]) {
  return Array.from(new Set(fonts.map((font) => font.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}
