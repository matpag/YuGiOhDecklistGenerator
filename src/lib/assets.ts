import type { ProjectAsset } from "../types/project";

export const IMAGE_FILE_ACCEPT = "image/*,.avif,.bmp,.gif,.jpg,.jpeg,.png,.svg,.webp";
export const FONT_FILE_ACCEPT = ".ttf,.otf,.woff,.woff2,font/*";
export const TEMPLATE_FILE_ACCEPT =
  ".dhdecktemplate,application/json,application/zip,application/vnd.dhdecktemplate+zip";
export const MAX_ASSET_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const FONT_EXTENSION_PATTERN = /\.(ttf|otf|woff2?)$/i;

export function fileToAsset(file: File): Promise<ProjectAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || inferMimeType(file.name),
        dataUrl: String(reader.result),
      });
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || IMAGE_EXTENSION_PATTERN.test(file.name);
}

export function isFontFile(file: File) {
  return file.type.startsWith("font/") || FONT_EXTENSION_PATTERN.test(file.name);
}

export function validateAssetFile(file: File, type: "image" | "font") {
  if (file.size > MAX_ASSET_FILE_SIZE_BYTES) {
    return `${file.name} is larger than 20 MB.`;
  }

  if (type === "image" && !isImageFile(file)) {
    return `${file.name} is not an image file.`;
  }

  if (type === "font" && !isFontFile(file)) {
    return `${file.name} is not a supported font file.`;
  }

  return null;
}

export function inferFontFamilyFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "ttf":
      return "font/ttf";
    case "otf":
      return "font/otf";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
