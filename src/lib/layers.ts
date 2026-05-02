import type { TemplateLayer } from "../types/project";

export function isDynamicLayer(layer: TemplateLayer) {
  return layer.dynamic;
}
