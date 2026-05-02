import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Image, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import {
  EDITOR_OVERLAY_NAME,
  coverRect,
  fittedFontSize,
  imageRectForSlot,
} from "../lib/rendering";
import { isDynamicLayer } from "../lib/layers";
import { useProjectStore } from "../store/projectStore";
import type {
  BatchRow,
  ImageSlotLayer,
  ProjectAsset,
  TemplateLayer,
  TextLayer,
} from "../types/project";

const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200];
const MIN_LAYER_SIZE = 10;

function useAssetImages(assets: Record<string, ProjectAsset>) {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    let active = true;
    const assetList = Object.values(assets);

    setImages((currentImages) => {
      const nextImages: Record<string, HTMLImageElement> = {};
      const expectedSources = new Map(assetList.map((asset) => [asset.id, asset.dataUrl]));

      for (const [assetId, image] of Object.entries(currentImages)) {
        if (expectedSources.get(assetId) === image.src) {
          nextImages[assetId] = image;
        }
      }

      return nextImages;
    });

    for (const asset of assetList) {
      const image = new window.Image();
      const handleLoad = () => {
        if (!active) {
          return;
        }

        setImages((currentImages) => {
          if (currentImages[asset.id]?.src === asset.dataUrl) {
            return currentImages;
          }

          return {
            ...currentImages,
            [asset.id]: image,
          };
        });
      };

      image.addEventListener("load", handleLoad);
      image.src = asset.dataUrl;

      if (image.complete) {
        handleLoad();
      }
    }

    return () => {
      active = false;
    };
  }, [assets]);

  return images;
}

interface DraftZoomInputProps {
  value: number;
  onCommit: (value: number) => void;
}

function DraftZoomInput({ value, onCommit }: DraftZoomInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value));
    }
  }, [isEditing, value]);

  return (
    <input
      inputMode="decimal"
      type="text"
      value={draft}
      onBlur={() => {
        setIsEditing(false);
        const parsed = Number(draft);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setDraft(String(value));
        }
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        const parsed = Number(nextDraft);

        setDraft(nextDraft);

        if (Number.isFinite(parsed) && parsed > 0) {
          onCommit(parsed);
        }
      }}
      onFocus={() => setIsEditing(true)}
    />
  );
}

interface EditableTextLayerProps {
  fontRevision: number;
  layer: TextLayer;
  row: BatchRow | null;
  isSelected: boolean;
  onSelect: () => void;
}

function EditableTextLayer({ fontRevision, layer, row, isSelected, onSelect }: EditableTextLayerProps) {
  const textRef = useRef<Konva.Text>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const text = layer.dynamic ? row?.values[layer.id] || layer.text : layer.text;
  const fontSize = fittedFontSize(layer, text);

  useEffect(() => {
    const transformer = transformerRef.current;
    const textNode = textRef.current;

    if (!transformer) {
      return;
    }

    if (isSelected && textNode) {
      transformer.nodes([textNode]);
      transformer.moveToTop();
      transformer.getLayer()?.batchDraw();
      return;
    }

    transformer.nodes([]);
    transformer.getLayer()?.batchDraw();
  }, [fontRevision, isSelected, layer.height, layer.width]);

  function commitTextBox(node: Konva.Text) {
    const nextWidth = Math.max(MIN_LAYER_SIZE, node.width() * node.scaleX());
    const nextHeight = Math.max(MIN_LAYER_SIZE, node.height() * node.scaleY());

    node.scale({ x: 1, y: 1 });
    updateLayer(layer.id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.round(nextWidth),
      height: Math.round(nextHeight),
      rotation: Math.round(node.rotation()),
    });
  }

  return (
    <>
      <Text
        ref={textRef}
        align={layer.align}
        draggable={isSelected}
        fill={layer.fill}
        fillAfterStrokeEnabled
        fontFamily={layer.fontFamily}
        fontSize={fontSize}
        fontStyle={layer.fontStyle}
        height={layer.height}
        lineHeight={layer.lineHeight}
        onClick={onSelect}
        onDragEnd={(event) => commitTextBox(event.target as Konva.Text)}
        onTap={onSelect}
        onTransformEnd={(event) => commitTextBox(event.target as Konva.Text)}
        rotation={layer.rotation}
        shadowBlur={layer.shadowEnabled ? layer.shadowBlur : 0}
        shadowColor={layer.shadowColor}
        shadowEnabled={layer.shadowEnabled}
        shadowOffsetX={layer.shadowOffsetX}
        shadowOffsetY={layer.shadowOffsetY}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth * 2}
        text={text}
        verticalAlign={layer.verticalAlign}
        width={layer.width}
        x={layer.x}
        y={layer.y}
      />
      {isSelected ? (
        <Transformer
          ref={transformerRef}
          anchorCornerRadius={3}
          anchorFill="#2f80ed"
          anchorSize={12}
          anchorStroke="#ffffff"
          anchorStrokeWidth={2}
          borderDash={[8, 6]}
          borderStroke="#2f80ed"
          borderStrokeWidth={2}
          boundBoxFunc={(oldBox, newBox) =>
            Math.abs(newBox.width) < MIN_LAYER_SIZE || Math.abs(newBox.height) < MIN_LAYER_SIZE
              ? oldBox
              : newBox
          }
          flipEnabled={false}
          name={EDITOR_OVERLAY_NAME}
        />
      ) : null}
    </>
  );
}

interface EditableImageSlotProps {
  layer: ImageSlotLayer;
  row: BatchRow | null;
  image: HTMLImageElement | null;
  isSelected: boolean;
  onSelect: () => void;
}

function EditableImageSlot({ layer, image, isSelected, onSelect }: EditableImageSlotProps) {
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const imageRect = image ? imageRectForSlot(layer, image) : null;

  useEffect(() => {
    const transformer = transformerRef.current;
    const rect = rectRef.current;

    if (!transformer) {
      return;
    }

    if (isSelected && rect) {
      transformer.nodes([rect]);
      transformer.moveToTop();
      transformer.getLayer()?.batchDraw();
      return;
    }

    transformer.nodes([]);
    transformer.getLayer()?.batchDraw();
  }, [isSelected, layer.height, layer.width]);

  function commitRect(node: Konva.Rect) {
    const nextWidth = Math.max(MIN_LAYER_SIZE, node.width() * node.scaleX());
    const nextHeight = Math.max(MIN_LAYER_SIZE, node.height() * node.scaleY());

    node.scale({ x: 1, y: 1 });
    updateLayer(layer.id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.round(nextWidth),
      height: Math.round(nextHeight),
      rotation: Math.round(node.rotation()),
    });
  }

  return (
    <>
      {image && imageRect ? (
        <Group
          clipFunc={(context) => {
            context.rect(0, 0, layer.width, layer.height);
          }}
          rotation={layer.rotation}
          x={layer.x}
          y={layer.y}
        >
          <Image
            image={image}
            listening={false}
            height={imageRect.height}
            width={imageRect.width}
            x={imageRect.x - layer.x}
            y={imageRect.y - layer.y}
          />
        </Group>
      ) : null}
      <Rect
        ref={rectRef}
        dash={image ? undefined : [12, 8]}
        draggable={isSelected}
        fill={image ? "rgba(255,255,255,0.001)" : "rgba(47,128,237,0.12)"}
        height={layer.height}
        name={EDITOR_OVERLAY_NAME}
        onClick={onSelect}
        onDragEnd={(event) => commitRect(event.target as Konva.Rect)}
        onDragMove={(event) => commitRect(event.target as Konva.Rect)}
        onTap={onSelect}
        onTransform={(event) => commitRect(event.target as Konva.Rect)}
        onTransformEnd={(event) => commitRect(event.target as Konva.Rect)}
        rotation={layer.rotation}
        stroke={isSelected ? "#2f80ed" : "#86a8d9"}
        strokeWidth={isSelected ? 3 : 2}
        width={layer.width}
        x={layer.x}
        y={layer.y}
      />
      {isSelected ? (
        <Transformer
          ref={transformerRef}
          anchorCornerRadius={3}
          anchorFill="#2f80ed"
          anchorSize={12}
          anchorStroke="#ffffff"
          anchorStrokeWidth={2}
          borderDash={[8, 6]}
          borderStroke="#2f80ed"
          borderStrokeWidth={2}
          boundBoxFunc={(oldBox, newBox) =>
            Math.abs(newBox.width) < MIN_LAYER_SIZE || Math.abs(newBox.height) < MIN_LAYER_SIZE
              ? oldBox
              : newBox
          }
          flipEnabled={false}
          name={EDITOR_OVERLAY_NAME}
        />
      ) : null}
    </>
  );
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

function outputFileName(row: BatchRow, layers: TemplateLayer[], rowIndex: number) {
  const textLayerIds = layers
    .filter((layer) => layer.type === "text" && isDynamicLayer(layer))
    .map((layer) => layer.id);
  const textSeed =
    textLayerIds.map((layerId) => row.values[layerId]).find((value) => value?.trim()) || row.name;
  const slug = textSeed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  const prefix = String(rowIndex + 1).padStart(2, "0");

  return `${prefix}-${slug || row.name.toLowerCase().replace(/\s+/g, "-")}.png`;
}

function missingDynamicContentMessages(
  rows: Array<{ row: BatchRow; rowIndex: number }>,
  layers: TemplateLayer[],
  assets: Record<string, ProjectAsset>,
) {
  const dynamicLayers = layers.filter(isDynamicLayer);
  const missingMessages: string[] = [];

  for (const { row, rowIndex } of rows) {
    for (const layer of dynamicLayers) {
      const value = row.values[layer.id];

      if (layer.type === "text" && !value?.trim()) {
        missingMessages.push(`Row ${rowIndex + 1}: missing text "${layer.id}"`);
      }

      if (layer.type === "image-slot" && (!value || !assets[value])) {
        missingMessages.push(`Row ${rowIndex + 1}: missing image "${layer.id}"`);
      }
    }
  }

  return missingMessages;
}

function showMissingDynamicContentError(messages: string[]) {
  const visibleMessages = messages.slice(0, 12);
  const remainingCount = messages.length - visibleMessages.length;
  const suffix = remainingCount > 0 ? `\n...and ${remainingCount} more missing fields.` : "";

  window.alert(
    `Cannot export yet. Please fill all dynamic batch fields first:\n\n${visibleMessages.join(
      "\n",
    )}${suffix}`,
  );
}

interface DecklistStageProps {
  fontRevision: number;
}

export function DecklistStage({ fontRevision }: DecklistStageProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 900 });
  const [zoomMode, setZoomMode] = useState<"fit" | "fixed">("fit");
  const [zoomPercent, setZoomPercent] = useState(75);
  const [exportRowId, setExportRowId] = useState<string | null>(null);
  const template = useProjectStore((state) => state.template);
  const assets = useProjectStore((state) => state.assets);
  const selectedLayerId = useProjectStore((state) => state.selectedLayerId);
  const selectedBatchRowId = useProjectStore((state) => state.selectedBatchRowId);
  const batchRows = useProjectStore((state) => state.batchRows);
  const selectLayer = useProjectStore((state) => state.selectLayer);
  const images = useAssetImages(assets);
  const fitScale = Math.min(
    Math.max(viewportSize.width / template.canvas.width, 0.05),
    Math.max(viewportSize.height / template.canvas.height, 0.05),
  );
  const previewScale = zoomMode === "fit" ? fitScale : zoomPercent / 100;
  const previewWidth = Math.round(template.canvas.width * previewScale);
  const previewHeight = Math.round(template.canvas.height * previewScale);
  const activeRow = useMemo(
    () =>
      batchRows.find((row) => row.id === (exportRowId ?? selectedBatchRowId)) ??
      batchRows[0] ??
      null,
    [batchRows, exportRowId, selectedBatchRowId],
  );
  const backgroundImage = template.backgroundAssetId
    ? images[template.backgroundAssetId] ?? null
    : null;
  const backgroundRect =
    backgroundImage && backgroundImage.naturalWidth && backgroundImage.naturalHeight
      ? coverRect(
          backgroundImage.naturalWidth,
          backgroundImage.naturalHeight,
          template.canvas.width,
          template.canvas.height,
        )
      : null;

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const renderPng = useCallback(() => {
    const stage = stageRef.current;

    if (!stage) {
      return null;
    }

    const overlays = stage.find(`.${EDITOR_OVERLAY_NAME}`);
    overlays.forEach((node) => node.hide());
    stage.draw();

    const dataUrl = stage.toDataURL({
      mimeType: "image/png",
      pixelRatio: 1 / previewScale,
    });

    overlays.forEach((node) => node.show());
    stage.draw();

    return dataUrl;
  }, [previewScale]);

  useEffect(() => {
    async function renderForRow(rowId: string) {
      setExportRowId(rowId);
      await waitForPaint();
      const dataUrl = renderPng();
      setExportRowId(null);
      await waitForPaint();
      return dataUrl;
    }

    async function handlePreview() {
      const dataUrl = await renderForRow(selectedBatchRowId);

      if (!dataUrl) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent("decklist-maker:png-preview-ready", {
          detail: { dataUrl },
        }),
      );
    }

    async function handleExportCurrent() {
      const rowIndex = batchRows.findIndex((candidate) => candidate.id === selectedBatchRowId);
      const row = rowIndex >= 0 ? batchRows[rowIndex] : null;

      if (!row) {
        return;
      }

      const missingMessages = missingDynamicContentMessages(
        [{ row, rowIndex }],
        template.layers,
        assets,
      );

      if (missingMessages.length > 0) {
        showMissingDynamicContentError(missingMessages);
        return;
      }

      const dataUrl = await renderForRow(row.id);

      if (dataUrl) {
        downloadDataUrl(dataUrl, outputFileName(row, template.layers, rowIndex));
      }
    }

    async function handleExportAll() {
      const rowsWithIndex = batchRows.map((row, rowIndex) => ({ row, rowIndex }));
      const missingMessages = missingDynamicContentMessages(rowsWithIndex, template.layers, assets);

      if (missingMessages.length > 0) {
        showMissingDynamicContentError(missingMessages);
        return;
      }

      for (const [rowIndex, row] of batchRows.entries()) {
        const dataUrl = await renderForRow(row.id);

        if (dataUrl) {
          downloadDataUrl(dataUrl, outputFileName(row, template.layers, rowIndex));
          await new Promise((resolve) => window.setTimeout(resolve, 120));
        }
      }
    }

    window.addEventListener("decklist-maker:preview-current", handlePreview);
    window.addEventListener("decklist-maker:export-current", handleExportCurrent);
    window.addEventListener("decklist-maker:export-all", handleExportAll);

    return () => {
      window.removeEventListener("decklist-maker:preview-current", handlePreview);
      window.removeEventListener("decklist-maker:export-current", handleExportCurrent);
      window.removeEventListener("decklist-maker:export-all", handleExportAll);
    };
  }, [assets, batchRows, renderPng, selectedBatchRowId, template.layers]);

  function checkDeselect(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (event.target === event.target.getStage()) {
      selectLayer(null);
    }
  }

  return (
    <section className="preview-pane">
      <div className="preview-toolbar">
        <div className="zoom-controls" aria-label="Preview zoom">
          <button
            className={zoomMode === "fit" ? "zoom-button-active" : ""}
            type="button"
            onClick={() => setZoomMode("fit")}
          >
            Fill
          </button>
          {ZOOM_PRESETS.map((preset) => (
            <button
              className={zoomMode === "fixed" && zoomPercent === preset ? "zoom-button-active" : ""}
              key={preset}
              type="button"
              onClick={() => {
                setZoomMode("fixed");
                setZoomPercent(preset);
              }}
            >
              {preset}%
            </button>
          ))}
        </div>
        <label className="zoom-custom">
          Zoom
          <DraftZoomInput
            value={zoomMode === "fit" ? Math.round(fitScale * 100) : zoomPercent}
            onCommit={(nextPercent) => {
              setZoomMode("fixed");
              setZoomPercent(nextPercent);
            }}
          />
        </label>
      </div>
      <div ref={viewportRef} className="canvas-wrap">
        <div className="stage-shell">
          <Stage
            ref={stageRef}
            width={previewWidth}
            height={previewHeight}
            scaleX={previewScale}
            scaleY={previewScale}
            onMouseDown={checkDeselect}
            onTouchStart={checkDeselect}
          >
            <Layer>
              <Rect width={template.canvas.width} height={template.canvas.height} fill="#ffffff" />
              {backgroundImage && backgroundRect ? (
                <Image
                  image={backgroundImage}
                  height={backgroundRect.height}
                  listening={false}
                  width={backgroundRect.width}
                  x={backgroundRect.x}
                  y={backgroundRect.y}
                />
              ) : null}
            </Layer>
            <Layer>
              {template.layers.map((layer) =>
                layer.type === "text" ? (
                  <EditableTextLayer
                    fontRevision={fontRevision}
                    isSelected={selectedLayerId === layer.id}
                    key={`${layer.id}-${fontRevision}`}
                    layer={layer}
                    row={activeRow}
                    onSelect={() => selectLayer(layer.id)}
                  />
                ) : (
                  <EditableImageSlot
                    image={
                      layer.dynamic && activeRow?.values[layer.id]
                        ? images[activeRow.values[layer.id]] ?? images[layer.assetId ?? ""] ?? null
                        : images[layer.assetId ?? ""] ?? null
                    }
                    isSelected={selectedLayerId === layer.id}
                    key={layer.id}
                    layer={layer}
                    row={activeRow}
                    onSelect={() => selectLayer(layer.id)}
                  />
                ),
              )}
            </Layer>
          </Stage>
        </div>
      </div>
    </section>
  );
}
