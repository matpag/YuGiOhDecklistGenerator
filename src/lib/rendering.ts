import type { ImageSlotLayer, TextLayer } from "../types/project";

export const EDITOR_OVERLAY_NAME = "editor-overlay";

export interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function coverRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const width = sourceRatio > targetRatio ? targetHeight * sourceRatio : targetWidth;
  const height = sourceRatio > targetRatio ? targetHeight : targetWidth / sourceRatio;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

export function imageRectForSlot(layer: ImageSlotLayer, image: HTMLImageElement): DrawRect {
  if (layer.fit === "stretch") {
    return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  }

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const slotRatio = layer.width / layer.height;
  const cover = layer.fit === "cover";
  const useWidth = cover ? sourceRatio < slotRatio : sourceRatio > slotRatio;
  const width = useWidth ? layer.width : layer.height * sourceRatio;
  const height = useWidth ? layer.width / sourceRatio : layer.height;

  return {
    x: layer.x + (layer.width - width) / 2,
    y: layer.y + (layer.height - height) / 2,
    width,
    height,
  };
}

export function fittedFontSize(layer: TextLayer, text: string) {
  if (!layer.autoShrink || !text.trim()) {
    return layer.fontSize;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return layer.fontSize;
  }

  for (let size = layer.fontSize; size >= 8; size -= 1) {
    context.font = `${layer.fontStyle} ${size}px ${quoteFontFamily(layer.fontFamily)}`;
    const lines = wrapText(context, text, Math.max(1, layer.width - layer.strokeWidth * 2));
    const lineHeightPx = size * layer.lineHeight;
    const totalHeight = lines.length * lineHeightPx;
    const widestLine = Math.max(...lines.map((line) => context.measureText(line).width), 0);

    if (totalHeight <= layer.height && widestLine <= layer.width) {
      return size;
    }
  }

  return 8;
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
