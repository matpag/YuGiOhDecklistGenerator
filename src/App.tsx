import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileJson, FolderOpen, Moon, Save, SaveAll, Sun, X } from "lucide-react";
import { DecklistStage } from "./components/DecklistStage";
import { EditorSidebar } from "./components/EditorSidebar";
import { RightPanel } from "./components/RightPanel";
import { TEMPLATE_FILE_ACCEPT } from "./lib/assets";
import { registerEmbeddedFonts } from "./lib/fonts";
import { exportTemplateArchive, importTemplateArchive } from "./lib/templateArchive";
import { createTemplateDocument, templateFileName } from "./lib/templateDocument";
import { useProjectStore } from "./store/projectStore";

type Theme = "light" | "dark";
type BusyAction = "opening" | "saving" | "exporting";

const BUSY_MESSAGES: Record<BusyAction, string> = {
  opening: "Opening template...",
  saving: "Saving template...",
  exporting: "Preparing export...",
};

const TEMPLATE_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: "Decklist template",
    accept: {
      "application/vnd.dhdecktemplate+zip": [".dhdecktemplate"],
      "application/json": [".json"],
    },
  },
];

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

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [templateFileHandle, setTemplateFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [openedTemplateName, setOpenedTemplateName] = useState<string | null>(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [pngPreviewUrl, setPngPreviewUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() =>
    window.localStorage.getItem("decklist-maker-theme") === "dark" ? "dark" : "light",
  );
  const template = useProjectStore((state) => state.template);
  const assets = useProjectStore((state) => state.assets);
  const loadDocument = useProjectStore((state) => state.loadDocument);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("decklist-maker-theme", theme);
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
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not open the template.");
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
        types: TEMPLATE_PICKER_TYPES,
      });

      if (!fileHandle) {
        return;
      }

      await loadTemplateFile(await fileHandle.getFile());
      setTemplateFileHandle(fileHandle);
      setOpenedTemplateName(fileHandle.name);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      window.alert(error instanceof Error ? error.message : "Could not open the template.");
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
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not save the template.");
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
        return;
      }

      const fileHandle = await window.showSaveFilePicker({
        excludeAcceptAllOption: false,
        suggestedName: fileName,
        types: TEMPLATE_PICKER_TYPES,
      });

      await writeTemplateFile(fileHandle, blob);
      setTemplateFileHandle(fileHandle);
      setOpenedTemplateName(fileHandle.name);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      window.alert(error instanceof Error ? error.message : "Could not save the template.");
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
      <header className="topbar">
        <div>
          <h1>Decklist Maker</h1>
          <p>Design one reusable template, then fill rows and export PNGs.</p>
        </div>
        {openedTemplateName ? (
          <div className="open-file-status" title={openedTemplateName}>
            <span>Template</span>
            <strong>{openedTemplateName}</strong>
            {templateFileHandle ? <small>direct save enabled</small> : <small>download save</small>}
          </div>
        ) : null}
        <div className="topbar-actions">
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
            title="Open template"
            disabled={busyAction !== null}
            onClick={() => void handleOpenTemplate()}
          >
            <FolderOpen size={18} />
          </button>
          <button
            type="button"
            title={
              templateFileHandle
                ? "Save template to the opened file"
                : "Save template as a new file"
            }
            disabled={busyAction !== null}
            onClick={() => void handleSaveTemplate()}
          >
            <Save size={18} />
          </button>
          <button
            type="button"
            title="Save template as"
            disabled={busyAction !== null}
            onClick={() => void handleSaveTemplateAs()}
          >
            <SaveAll size={18} />
            As
          </button>
          <button
            type="button"
            title="Preview selected row"
            disabled={busyAction !== null}
            onClick={() => void dispatchExport("decklist-maker:preview-current")}
          >
            <Eye size={18} />
          </button>
          <button
            type="button"
            title="Export selected row"
            disabled={busyAction !== null}
            onClick={() => void dispatchExport("decklist-maker:export-current")}
          >
            <Download size={18} />
            Current
          </button>
          <button
            type="button"
            title="Export every row"
            disabled={busyAction !== null}
            onClick={() => void dispatchExport("decklist-maker:export-all")}
          >
            <FileJson size={18} />
            All
          </button>
          <button
            className="theme-toggle"
            type="button"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={theme === "dark"}
            disabled={busyAction !== null}
            onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
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
        <DecklistStage fontRevision={fontRevision} />
        <RightPanel
          collapsed={rightSidebarCollapsed}
          onToggleCollapsed={() => setRightSidebarCollapsed((collapsed) => !collapsed)}
        />
      </section>

      {busyAction ? (
        <div className="loading-backdrop" role="alert" aria-live="assertive">
          <div className="loading-dialog">
            <span className="loading-spinner" aria-hidden="true" />
            <p>{BUSY_MESSAGES[busyAction]}</p>
          </div>
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
              <h2 id="png-preview-title">PNG preview</h2>
              <div className="dialog-actions">
                <button
                  type="button"
                  title="Download preview"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.download = "decklist-preview.png";
                    link.href = pngPreviewUrl;
                    link.click();
                  }}
                >
                  <Download size={17} />
                </button>
                <button type="button" title="Close preview" onClick={() => setPngPreviewUrl(null)}>
                  <X size={17} />
                </button>
              </div>
            </header>
            <div className="png-preview-body">
              <img src={pngPreviewUrl} alt="PNG export preview" />
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
