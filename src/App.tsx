import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Eye, FileJson, FolderOpen, Moon, Save, SaveAll, Sun, X } from "lucide-react";
import { DecklistStage } from "./components/DecklistStage";
import { EditorSidebar } from "./components/EditorSidebar";
import { RightPanel } from "./components/RightPanel";
import { TEMPLATE_FILE_ACCEPT } from "./lib/assets";
import { registerEmbeddedFonts } from "./lib/fonts";
import { exportTemplateArchive, importTemplateArchive } from "./lib/templateArchive";
import { createTemplateDocument, templateFileName } from "./lib/templateDocument";
import { useProjectStore } from "./store/projectStore";
import { LanguageControl, useI18n } from "./i18n/I18n";
import type { MessageKey, MessageValues } from "./i18n/messages";
import type { TemplateLayer } from "./types/project";

type Theme = "light" | "dark";
type BusyAction = "opening" | "saving" | "exporting";
type Notice = {
  id: number;
  key: MessageKey;
  values?: MessageValues;
};

const BUSY_MESSAGES: Record<BusyAction, MessageKey> = {
  opening: "opening",
  saving: "saving",
  exporting: "exporting",
};


function waitForPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"),
  );
}

export default function App() {
  const { t, link, errorMessage } = useI18n();
  const pickerTypes: FilePickerAcceptType[] = [
    {
      description: t("templateFile"),
      accept: {
        "application/vnd.dhdecktemplate+zip": [".dhdecktemplate"],
        "application/json": [".json"],
      },
    },
  ];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layerClipboardRef = useRef<TemplateLayer | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [templateFileHandle, setTemplateFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [openedTemplateName, setOpenedTemplateName] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [pngPreviewUrl, setPngPreviewUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return window.localStorage.getItem("decklist-maker-theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });
  const template = useProjectStore((state) => state.template);
  const assets = useProjectStore((state) => state.assets);
  const loadDocument = useProjectStore((state) => state.loadDocument);
  const selectedLayer = useProjectStore((state) =>
    state.template.layers.find((layer) => layer.id === state.selectedLayerId) ?? null,
  );
  const pasteLayer = useProjectStore((state) => state.pasteLayer);
  const removeLayer = useProjectStore((state) => state.removeLayer);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (busyAction || pngPreviewUrl || isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const copyShortcut = (event.ctrlKey || event.metaKey) && key === "c";
      const pasteShortcut = (event.ctrlKey || event.metaKey) && key === "v";
      const deleteShortcut = event.key === "Delete" || event.key === "Backspace";

      if (copyShortcut && selectedLayer) {
        event.preventDefault();
        layerClipboardRef.current = structuredClone(selectedLayer);
        showNotice("copied", { id: selectedLayer.id });
      }

      if (pasteShortcut && layerClipboardRef.current) {
        event.preventDefault();
        pasteLayer(layerClipboardRef.current);
        showNotice("pasted");
      }

      if (deleteShortcut && selectedLayer) {
        event.preventDefault();
        removeLayer(selectedLayer.id);
        showNotice("deleted", { id: selectedLayer.id });
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [busyAction, pasteLayer, pngPreviewUrl, removeLayer, selectedLayer, t]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem("decklist-maker-theme", theme); } catch { /* Theme still works when storage is unavailable. */ }
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function loadFonts() {
      await registerEmbeddedFonts(template.fonts, assets);
      await document.fonts.ready;

      if (active) {
        setFontRevision((revision) => revision + 1);
      }
    }

    void loadFonts();

    return () => {
      active = false;
    };
  }, [assets, template.fonts]);

  useEffect(() => {
    function handlePreviewReady(event: Event) {
      const previewEvent = event as CustomEvent<{ dataUrl: string }>;
      setPngPreviewUrl(previewEvent.detail.dataUrl);
    }

    window.addEventListener("decklist-maker:png-preview-ready", handlePreviewReady);
    return () => window.removeEventListener("decklist-maker:png-preview-ready", handlePreviewReady);
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function showNotice(key: MessageKey, values?: MessageValues) {
    setNotice({ id: Date.now(), key, values });
  }

  async function loadTemplateFile(file: File) {
    const templateDocument = await importTemplateArchive(await file.arrayBuffer());
    await registerEmbeddedFonts(templateDocument.template.fonts, templateDocument.assets);
    await document.fonts.ready;
    loadDocument(templateDocument);
    setFontRevision((revision) => revision + 1);
  }

  async function handleOpenTemplateFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setBusyAction("opening");

    try {
      await waitForPaint();
      await loadTemplateFile(file);
      setTemplateFileHandle(null);
      setOpenedTemplateName(file.name);
      showNotice("opened", { name: file.name });
    } catch (error) {
      window.alert(errorMessage(error, "errorOpen"));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenTemplate() {
    if (!window.showOpenFilePicker) {
      fileInputRef.current?.click();
      return;
    }

    setBusyAction("opening");

    try {
      await waitForPaint();
      const [fileHandle] = await window.showOpenFilePicker({
        excludeAcceptAllOption: false,
        multiple: false,
        types: pickerTypes,
      });

      if (!fileHandle) {
        return;
      }

      await loadTemplateFile(await fileHandle.getFile());
      setTemplateFileHandle(fileHandle);
      setOpenedTemplateName(fileHandle.name);
      showNotice("opened", { name: fileHandle.name });
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      window.alert(errorMessage(error, "errorOpen"));
    } finally {
      setBusyAction(null);
    }
  }

  async function createTemplateBlob() {
    const currentState = useProjectStore.getState();
    const templateDocument = createTemplateDocument(currentState.template, currentState.assets);

    return {
      blob: await exportTemplateArchive(templateDocument),
      fileName: templateFileName(currentState.template),
    };
  }

  async function writeTemplateFile(fileHandle: FileSystemFileHandle, blob: Blob) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  function downloadTemplate(blob: Blob, fileName: string) {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    showNotice("downloaded", { name: fileName });
  }

  async function handleSaveTemplate() {
    setBusyAction("saving");

    try {
      await waitForPaint();
      const { blob } = await createTemplateBlob();

      if (!templateFileHandle) {
        await handleSaveTemplateAs();
        return;
      }

      await writeTemplateFile(templateFileHandle, blob);
      showNotice("saved", { name: templateFileHandle.name });
    } catch (error) {
      window.alert(errorMessage(error, "errorSave"));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveTemplateAs() {
    setBusyAction("saving");

    try {
      await waitForPaint();
      const { blob, fileName } = await createTemplateBlob();

      if (!window.showSaveFilePicker) {
        downloadTemplate(blob, fileName);
        showNotice("downloadFallback");
        return;
      }

      const fileHandle = await window.showSaveFilePicker({
        excludeAcceptAllOption: false,
        suggestedName: fileName,
        types: pickerTypes,
      });

      await writeTemplateFile(fileHandle, blob);
      setTemplateFileHandle(fileHandle);
      setOpenedTemplateName(fileHandle.name);
      showNotice("saved", { name: fileHandle.name });
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      window.alert(errorMessage(error, "errorSave"));
    } finally {
      setBusyAction(null);
    }
  }

  async function dispatchExport(eventName: string) {
    setBusyAction("exporting");
    await waitForPaint();
    window.dispatchEvent(new CustomEvent(eventName));
    window.setTimeout(() => setBusyAction(null), 400);
  }

  return (
    <main className="app-shell" aria-busy={busyAction !== null}>
      <h1 className="visually-hidden">{t("product")}</h1>
      <header className="topbar rf-suite-header rf-suite-header--compact">
        <a className="rf-brand" href={link("https://retroformats.com/")} aria-label={t("home")}>
          <img
            className="rf-brand__mark"
            src={`${import.meta.env.BASE_URL}retroformats/retroformats-mark.svg`}
            alt=""
            width="38"
            height="38"
          />
          <span>
            retroformats<span className="rf-brand__dot">.</span>
            <span className="rf-brand__product">{t("product")}</span>
          </span>
        </a>
        {openedTemplateName ? (
          <div className="open-file-status" title={openedTemplateName}>
            <span>{t("template")}</span>
            <strong>{openedTemplateName}</strong>
            {templateFileHandle ? <small>{t("directSave")}</small> : <small>{t("downloadSave")}</small>}
          </div>
        ) : null}
        <div className="topbar-actions rf-suite-actions">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept={TEMPLATE_FILE_ACCEPT}
            onChange={(event) => {
              void handleOpenTemplateFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            title={t("openTemplate")}
            aria-label={t("openTemplate")}
            disabled={busyAction !== null}
            onClick={() => void handleOpenTemplate()}
          >
            <FolderOpen size={18} />
          </button>
          <button
            type="button"
            title={
              templateFileHandle
                ? t("saveOpened")
                : t("saveNew")
            }
            aria-label={templateFileHandle ? t("saveOpened") : t("saveNew")}
            disabled={busyAction !== null}
            onClick={() => void handleSaveTemplate()}
          >
            <Save size={18} />
          </button>
          <button
            type="button"
            title={t("saveAs")}
            aria-label={t("saveAs")}
            disabled={busyAction !== null}
            onClick={() => void handleSaveTemplateAs()}
          >
            <SaveAll size={18} />
            {t("as")}
          </button>
          <button
            type="button"
            title={t("previewRow")}
            aria-label={t("previewRow")}
            disabled={busyAction !== null}
            onClick={() => void dispatchExport("decklist-maker:preview-current")}
          >
            <Eye size={18} />
          </button>
          <button
            className="rf-action-primary"
            type="button"
            title={t("exportRow")}
            aria-label={t("exportRowPng")}
            disabled={busyAction !== null}
            onClick={() => void dispatchExport("decklist-maker:export-current")}
          >
            <Download size={18} />
            {t("current")}
          </button>
          <button
            type="button"
            title={t("exportAll")}
            aria-label={t("exportAllPng")}
            disabled={busyAction !== null}
            onClick={() => void dispatchExport("decklist-maker:export-all")}
          >
            <FileJson size={18} />
            {t("all")}
          </button>
          <button
            className="theme-toggle"
            type="button"
            title={theme === "dark" ? t("switchLight") : t("switchDark")}
            aria-label={theme === "dark" ? t("switchLight") : t("switchDark")}
            aria-pressed={theme === "dark"}
            disabled={busyAction !== null}
            onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === "dark" ? t("light") : t("dark")}</span>
          </button>
          <LanguageControl />
          <details className="rf-suite-switcher">
            <summary>
              {t("tools")}
              <ChevronDown aria-hidden="true" size={14} />
            </summary>
            <nav className="rf-suite-nav" aria-label={t("suiteNav")}>
              <a href={link("https://retroformats.com/")} >{t("home")}</a>
              <a href={link("https://retroformats.com/probability/")} >{t("probability")}</a>
              <a href={link("https://retroformats.com/proxy/")} >{t("proxy")}</a>
              <a href={link("https://retroformats.com/decklist/")} aria-current="page">{t("decklist")}</a>
              <a href={link("https://retroformats.com/breakdown/")} >{t("breakdown")}</a>
            </nav>
          </details>
        </div>
      </header>

      <section
        className={`workspace ${leftSidebarCollapsed ? "workspace-left-collapsed" : ""} ${
          rightSidebarCollapsed ? "workspace-right-collapsed" : ""
        }`}
      >
        <EditorSidebar
          collapsed={leftSidebarCollapsed}
          onToggleCollapsed={() => setLeftSidebarCollapsed((collapsed) => !collapsed)}
        />
        <DecklistStage fontRevision={fontRevision} theme={theme} />
        <RightPanel
          collapsed={rightSidebarCollapsed}
          onToggleCollapsed={() => setRightSidebarCollapsed((collapsed) => !collapsed)}
        />
      </section>

      {busyAction ? (
        <div className="loading-backdrop" role="alert" aria-live="assertive">
          <div className="loading-dialog">
            <span className="loading-spinner" aria-hidden="true" />
            <p>{t(BUSY_MESSAGES[busyAction])}</p>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="app-notice" role="status" aria-live="polite">
          {t(notice.key, notice.values)}
        </div>
      ) : null}

      {pngPreviewUrl ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPngPreviewUrl(null);
            }
          }}
        >
          <section
            className="png-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="png-preview-title"
          >
            <header className="png-preview-header">
              <h2 id="png-preview-title">{t("pngPreview")}</h2>
              <div className="dialog-actions">
                <button
                  type="button"
                  title={t("downloadPreview")}
                  aria-label={t("downloadPreview")}
                  onClick={() => {
                    const link = document.createElement("a");
                    link.download = "decklist-preview.png";
                    link.href = pngPreviewUrl;
                    link.click();
                  }}
                >
                  <Download size={17} />
                </button>
                <button type="button" title={t("closePreview")} aria-label={t("closePreview")} onClick={() => setPngPreviewUrl(null)}>
                  <X size={17} />
                </button>
              </div>
            </header>
            <div className="png-preview-body">
              <img src={pngPreviewUrl} alt={t("pngAlt")} />
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
