import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Image, Layer, Rect, Stage, Transformer } from "react-konva";
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
const TEXT_RASTER_SCALE = 6;

interface RasterizedText {
  image: HTMLImageElement;
  padding: number;
  height: number;
  width: number;
}

interface TextRasterData {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  padding: number;
  height: number;
  width: number;
}

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

function useRasterizedText(layer: TextLayer, text: string, fontRevision: number) {
  const [rasterizedText, setRasterizedText] = useState<RasterizedText | null>(null);
  const fontSize = fittedFontSize(layer, text);

  useEffect(() => {
    let active = true;

    async function rasterizeText() {
      await document.fonts.ready;

      if (!active) {
        return;
      }

      const rasterData = renderTextToImage(layer, text, fontSize);
      const image = new window.Image();
      const handleLoad = () => {
        if (!active) {
          return;
        }

        setRasterizedText({
          image,
          padding: rasterData.padding,
          width: rasterData.width,
          height: rasterData.height,
        });
      };

      image.addEventListener("load", handleLoad);
      image.src = rasterData.dataUrl;

      if (image.complete) {
        handleLoad();
      }
    }

    void rasterizeText();

    return () => {
      active = false;
    };
  }, [
    fontRevision,
    fontSize,
    layer.align,
    layer.autoShrink,
    layer.fill,
    layer.fontFamily,
    layer.fontSize,
    layer.fontStyle,
    layer.height,
    layer.lineHeight,
    layer.shadowBlur,
    layer.shadowColor,
    layer.shadowEnabled,
    layer.shadowOffsetX,
    layer.shadowOffsetY,
    layer.stroke,
    layer.strokeWidth,
    layer.verticalAlign,
    layer.width,
    text,
  ]);

  return rasterizedText;
}

function renderTextToImage(layer: TextLayer, text: string, fontSize: number): TextRasterData {
  const strokeLineWidth = layer.strokeWidth * 2;
  const shadowPadding = layer.shadowEnabled
    ? layer.shadowBlur + Math.max(Math.abs(layer.shadowOffsetX), Math.abs(layer.shadowOffsetY))
    : 0;
  const padding = Math.ceil(strokeLineWidth + shadowPadding + 4);
  const logicalWidth = Math.max(1, layer.width + padding * 2);
  const logicalHeight = Math.max(1, layer.height + padding * 2);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = Math.ceil(logicalWidth * TEXT_RASTER_SCALE);
  canvas.height = Math.ceil(logicalHeight * TEXT_RASTER_SCALE);

  if (!context) {
    return {
      canvas,
      dataUrl: canvas.toDataURL("image/png"),
      padding,
      width: logicalWidth,
      height: logicalHeight,
    };
  }

  context.scale(TEXT_RASTER_SCALE, TEXT_RASTER_SCALE);
  context.font = `${layer.fontStyle} ${fontSize}px ${quoteFontFamily(layer.fontFamily)}`;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.miterLimit = 2;
  context.textAlign = layer.align;
  context.textBaseline = "top";

  const lines = wrapText(
    context,
    text,
    Math.max(1, layer.width - Math.max(layer.strokeWidth * 2, 0)),
  );
  const lineHeightPx = fontSize * layer.lineHeight;
  const textHeight = Math.max(fontSize, (lines.length - 1) * lineHeightPx + fontSize);
  const verticalOffset =
    layer.verticalAlign === "middle"
      ? Math.max(0, (layer.height - textHeight) / 2)
      : layer.verticalAlign === "bottom"
        ? Math.max(0, layer.height - textHeight)
        : 0;
  const textX =
    layer.align === "center"
      ? padding + layer.width / 2
      : layer.align === "right"
        ? padding + layer.width
        : padding;

  for (const [lineIndex, line] of lines.entries()) {
    const textY = padding + verticalOffset + lineIndex * lineHeightPx;

    if (strokeLineWidth > 0) {
      context.strokeStyle = layer.stroke;
      context.lineWidth = strokeLineWidth;
      context.strokeText(line, textX, textY);
    }

    if (layer.shadowEnabled) {
      context.save();
      context.shadowBlur = layer.shadowBlur;
      context.shadowColor = layer.shadowColor;
      context.shadowOffsetX = layer.shadowOffsetX;
      context.shadowOffsetY = layer.shadowOffsetY;
      context.fillStyle = layer.fill;
      context.fillText(line, textX, textY);
      context.restore();
    }

    context.fillStyle = layer.fill;
    context.fillText(line, textX, textY);
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL("image/png"),
    padding,
    width: logicalWidth,
    height: logicalHeight,
  };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const result: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      result.push("");
      continue;
    }

    let line = words[0];

    for (const word of words.slice(1)) {
      const nextLine = `${line} ${word}`;

      if (context.measureText(nextLine).width <= maxWidth) {
        line = nextLine;
      } else {
        result.push(line);
        line = word;
      }
    }

    result.push(line);
  }

  return result;
}

function quoteFontFamily(fontFamily: string) {
  return fontFamily.includes(" ") ? `"${fontFamily}"` : fontFamily;
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
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const text = layer.dynamic ? row?.values[layer.id] || layer.text : layer.text;
  const rasterizedText = useRasterizedText(layer, text, fontRevision);

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
  }, [fontRevision, isSelected, layer.height, layer.width]);

  function commitTextBox(node: Konva.Rect) {
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
      {rasterizedText ? (
        <Group
          listening={false}
          rotation={layer.rotation}
          x={layer.x}
          y={layer.y}
        >
          <Image
            height={rasterizedText.height}
            image={rasterizedText.image}
            imageSmoothingEnabled
            width={rasterizedText.width}
            x={-rasterizedText.padding}
            y={-rasterizedText.padding}
          />
        </Group>
      ) : null}
      <Rect
        ref={rectRef}
        draggable={isSelected}
        fill="rgba(255,255,255,0.001)"
        height={layer.height}
        name={EDITOR_OVERLAY_NAME}
        onClick={onSelect}
        onDragEnd={(event) => commitTextBox(event.target as Konva.Rect)}
        onDragMove={(event) => commitTextBox(event.target as Konva.Rect)}
        onTap={onSelect}
        onTransform={(event) => commitTextBox(event.target as Konva.Rect)}
        onTransformEnd={(event) => commitTextBox(event.target as Konva.Rect)}
        rotation={layer.rotation}
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
        stroke={isSelected ? "rgba(255,255,255,0.001)" : "#86a8d9"}
        strokeWidth={isSelected ? 1 : 2}
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

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const rect = coverRect(image.naturalWidth, image.naturalHeight, canvasWidth, canvasHeight);
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

function drawImageSlot(
  context: CanvasRenderingContext2D,
  layer: ImageSlotLayer,
  image: HTMLImageElement | null,
) {
  if (!image) {
    return;
  }

  const imageRect = imageRectForSlot(layer, image);

  context.save();
  context.translate(layer.x, layer.y);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.beginPath();
  context.rect(0, 0, layer.width, layer.height);
  context.clip();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    imageRect.x - layer.x,
    imageRect.y - layer.y,
    imageRect.width,
    imageRect.height,
  );
  context.restore();
}

function drawTextLayer(context: CanvasRenderingContext2D, layer: TextLayer, text: string) {
  const fontSize = fittedFontSize(layer, text);
  const rasterizedText = renderTextToImage(layer, text, fontSize);

  context.save();
  context.translate(layer.x, layer.y);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    rasterizedText.canvas,
    -rasterizedText.padding,
    -rasterizedText.padding,
    rasterizedText.width,
    rasterizedText.height,
  );
  context.restore();
}

function renderTemplateToDataUrl(
  templateLayers: TemplateLayer[],
  canvasWidth: number,
  canvasHeight: number,
  backgroundImage: HTMLImageElement | null,
  row: BatchRow | null,
  images: Record<string, HTMLImageElement>,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  if (backgroundImage) {
    drawImageCover(context, backgroundImage, canvasWidth, canvasHeight);
  }

  for (const layer of templateLayers) {
    if (layer.type === "text") {
      const text = layer.dynamic ? row?.values[layer.id] || layer.text : layer.text;
      drawTextLayer(context, layer, text);
      continue;
    }

    const image =
      layer.dynamic && row?.values[layer.id]
        ? images[row.values[layer.id]] ?? images[layer.assetId ?? ""] ?? null
        : images[layer.assetId ?? ""] ?? null;

    drawImageSlot(context, layer, image);
  }

  return canvas.toDataURL("image/png");
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

  const renderPng = useCallback(
    (row: BatchRow | null) =>
      renderTemplateToDataUrl(
        template.layers,
        template.canvas.width,
        template.canvas.height,
        backgroundImage,
        row,
        images,
      ),
    [backgroundImage, images, template.canvas.height, template.canvas.width, template.layers],
  );

  useEffect(() => {
    async function renderForRow(rowId: string) {
      setExportRowId(rowId);
      await waitForPaint();
      const row = batchRows.find((candidate) => candidate.id === rowId) ?? batchRows[0] ?? null;
      const dataUrl = renderPng(row);
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
