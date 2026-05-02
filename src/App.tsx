import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileJson, FolderOpen, Moon, Save, Sun, X } from "lucide-react";
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

function waitForPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
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

  async function handleOpenTemplate(file: File | undefined) {
    if (!file) {
      return;
    }

    setBusyAction("opening");

    try {
      await waitForPaint();
      const templateDocument = await importTemplateArchive(await file.arrayBuffer());
      await registerEmbeddedFonts(templateDocument.template.fonts, templateDocument.assets);
      await document.fonts.ready;
      loadDocument(templateDocument);
      setFontRevision((revision) => revision + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not open the template.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveTemplate() {
    setBusyAction("saving");

    try {
      await waitForPaint();
      const currentState = useProjectStore.getState();
      const templateDocument = createTemplateDocument(currentState.template, currentState.assets);
      const blob = await exportTemplateArchive(templateDocument);
      const link = document.createElement("a");
      link.download = templateFileName(currentState.template);
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
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
        <div className="topbar-actions">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept={TEMPLATE_FILE_ACCEPT}
            onChange={(event) => {
              void handleOpenTemplate(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            title="Open template"
            disabled={busyAction !== null}
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen size={18} />
          </button>
          <button
            type="button"
            title="Save template"
            disabled={busyAction !== null}
            onClick={handleSaveTemplate}
          >
            <Save size={18} />
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
