import {
  Copy,
  Image as ImageIcon,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Rows3,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18n";
import { fileToAsset, IMAGE_FILE_ACCEPT, validateAssetFile } from "../lib/assets";
import { isDynamicLayer } from "../lib/layers";
import { useProjectStore } from "../store/projectStore";
import type { ImageSlotLayer, TemplateLayer, TextLayer } from "../types/project";

type PanelTab = "layers" | "batch";

function layerIcon(layer: TemplateLayer) {
  return layer.type === "text" ? <Type size={15} /> : <ImageIcon size={15} />;
}

interface RightPanelProps {
  guideRequest?: { id: number; focus: boolean };
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function RightPanel({ collapsed, onToggleCollapsed, guideRequest }: RightPanelProps) {
  const { t, errorMessage } = useI18n();
  const [tab, setTab] = useState<PanelTab>("batch");
  const handledGuideRequest = useRef(0);
  useEffect(() => {
    if (guideRequest?.id) setTab("batch");
  }, [guideRequest]);
  useLayoutEffect(() => {
    if (!guideRequest?.focus || !guideRequest.id || collapsed || tab !== "batch" || handledGuideRequest.current === guideRequest.id) return;
    const heading = document.querySelector<HTMLElement>('[data-decklist-guide="rows"] h2');
    if (!heading) return;
    heading.scrollIntoView({ block: "start" });
    heading.focus({ preventScroll: true });
    handledGuideRequest.current = guideRequest.id;
  }, [guideRequest, tab, collapsed]);
  const template = useProjectStore((state) => state.template);
  const selectedLayerId = useProjectStore((state) => state.selectedLayerId);
  const selectedBatchRowId = useProjectStore((state) => state.selectedBatchRowId);
  const batchRows = useProjectStore((state) => state.batchRows);
  const assets = useProjectStore((state) => state.assets);
  const addAsset = useProjectStore((state) => state.addAsset);
  const selectLayer = useProjectStore((state) => state.selectLayer);
  const moveLayer = useProjectStore((state) => state.moveLayer);
  const removeLayer = useProjectStore((state) => state.removeLayer);
  const addBatchRow = useProjectStore((state) => state.addBatchRow);
  const duplicateBatchRow = useProjectStore((state) => state.duplicateBatchRow);
  const removeBatchRow = useProjectStore((state) => state.removeBatchRow);
  const selectBatchRow = useProjectStore((state) => state.selectBatchRow);
  const updateBatchValue = useProjectStore((state) => state.updateBatchValue);
  const textLayers = template.layers.filter(
    (layer): layer is TextLayer => layer.type === "text" && isDynamicLayer(layer),
  );
  const imageSlots = template.layers.filter(
    (layer): layer is ImageSlotLayer => layer.type === "image-slot" && isDynamicLayer(layer),
  );

  async function handleRowImage(rowId: string, layerId: string, file: File | undefined) {
    if (!file) {
      return;
    }

    const validationError = validateAssetFile(file, "image");
    if (validationError) {
      window.alert(errorMessage(validationError, "errorReadAsset"));
      return;
    }

    try {
      const asset = await fileToAsset(file);
      addAsset(asset);
      updateBatchValue(rowId, layerId, asset.id);
    } catch (error) { window.alert(errorMessage(error, "errorReadAsset")); }
  }

  if (collapsed) {
    return (
      <aside className="right-panel right-panel-collapsed">
        <button
          className="sidebar-collapse-button"
          title={t("expandBatch")}
          type="button"
          onClick={onToggleCollapsed}
        >
          <PanelRightOpen size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-panel">
      <div className="right-panel-header">
        <button
          className="sidebar-collapse-button"
          title={t("collapseBatch")}
          type="button"
          onClick={onToggleCollapsed}
        >
          <PanelRightClose size={18} />
        </button>
      </div>
      <div className="panel-tabs">
        <button
          className={tab === "layers" ? "tab-button-active" : ""}
          aria-pressed={tab === "layers"}
          type="button"
          onClick={() => setTab("layers")}
        >
          <Layers size={16} />
          {t("layers")}
        </button>
        <button
          className={tab === "batch" ? "tab-button-active" : ""}
          aria-pressed={tab === "batch"}
          type="button"
          onClick={() => setTab("batch")}
        >
          <Rows3 size={16} />
          {t("batch")}
        </button>
      </div>

      {tab === "layers" ? (
        <section className="panel right-panel-body">
          <h2>{t("layerStack")}</h2>
          <div className="layer-list">
            {[...template.layers].reverse().map((layer, reverseIndex) => {
              const index = template.layers.length - 1 - reverseIndex;
              return (
                <div
                  className={`layer-row ${selectedLayerId === layer.id ? "layer-row-active" : ""}`}
                  key={layer.id}
                >
                  <button
                    className="layer-select"
                    aria-pressed={selectedLayerId === layer.id}
                    type="button"
                    onClick={() => selectLayer(layer.id)}
                  >
                    {layerIcon(layer)}
                    <span>
                      <strong>{layer.id}</strong>
                      <small>{layer.type === "text" ? t("textLayer") : t("imageSlot")}</small>
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    disabled={index >= template.layers.length - 1}
                    title={t("moveUp")}
                    type="button"
                    onClick={() => moveLayer(layer.id, 1)}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-button"
                    disabled={index <= 0}
                    title={t("moveDown")}
                    type="button"
                    onClick={() => moveLayer(layer.id, -1)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-button danger-button"
                    title={t("delete")}
                    type="button"
                    onClick={() => removeLayer(layer.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="panel right-panel-body" data-decklist-guide="rows">
          <div className="panel-heading-row">
            <h2 tabIndex={-1}>{t("batchRows")}</h2>
            <button type="button" onClick={addBatchRow}>
              <Plus size={16} />
              {t("row")}
            </button>
          </div>
          <div className="batch-table-wrap">
            <table className="batch-table">
              <thead>
                <tr>
                  <th>{t("row")}</th>
                  {textLayers.map((layer) => (
                    <th key={layer.id}>{layer.id}</th>
                  ))}
                  {imageSlots.map((layer) => (
                    <th key={layer.id}>{layer.id}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {batchRows.map((row, index) => (
                  <tr
                    className={selectedBatchRowId === row.id ? "batch-row-active" : ""}
                    key={row.id}
                    onClick={() => selectBatchRow(row.id)}
                  >
                    <td>
                      <button
                        className="batch-row-select"
                        aria-label={t("selectRow", { row: index + 1 })}
                        aria-pressed={selectedBatchRowId === row.id}
                        type="button"
                        onClick={() => selectBatchRow(row.id)}
                      >
                        {index + 1}
                      </button>
                    </td>
                    {textLayers.map((layer) => (
                      <td key={layer.id}>
                        <textarea
                          aria-label={t("batchCell", { id: layer.id, row: index + 1 })}
                          value={row.values[layer.id] ?? ""}
                          placeholder={layer.text}
                          onChange={(event) =>
                            updateBatchValue(row.id, layer.id, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    {imageSlots.map((layer) => {
                      const assetId = row.values[layer.id];
                      const asset = assetId ? assets[assetId] : null;

                      return (
                        <td key={layer.id}>
                          <label className="small-file-button">
                            <Upload size={14} />
                            {asset ? asset.name : t("image")}
                            <input
                              accept={IMAGE_FILE_ACCEPT}
                              type="file"
                              onChange={(event) => {
                                void handleRowImage(row.id, layer.id, event.target.files?.[0]);
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </td>
                      );
                    })}
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title={t("duplicateRow")}
                          type="button"
                          onClick={() => duplicateBatchRow(row.id)}
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          className="icon-button danger-button"
                          disabled={batchRows.length <= 1}
                          title={t("deleteRow")}
                          type="button"
                          onClick={() => removeBatchRow(row.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </aside>
  );
}
