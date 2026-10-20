import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Download, Eye, LocateFixed, Play, X } from "lucide-react";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";
import { GUIDE_DECKLIST_FILE } from "../data/guideExample";
import { useProjectStore } from "../store/projectStore";

const steps: { title: MessageKey; body: MessageKey; tip: MessageKey; target?: "title" | "rows" }[] = [
  { title: "guideStep1", body: "guideBody1", tip: "guideTip1" },
  { title: "guideStep2", body: "guideBody2", tip: "guideTip2", target: "title" },
  { title: "guideStep3", body: "guideBody3", tip: "guideTip3", target: "rows" },
  { title: "guideStep4", body: "guideBody4", tip: "guideTip4", target: "rows" },
  { title: "guideStep5", body: "guideBody5", tip: "guideTip5" },
];

export function DecklistGuide({ step, onStepChange, onClose, onLoadExample, onShowControls, onPreview, busy }: {
  step: number; onStepChange: (step: number) => void; onClose: () => void; onLoadExample: () => void;
  onShowControls: (target: "title" | "rows") => void; onPreview: () => void; busy: boolean;
}) {
  const { t } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);
  const rowCount = useProjectStore((state) => state.batchRows.length);
  const current = steps[step];
  return <section id="decklist-guide" className="decklist-guide" aria-labelledby="guide-heading"
    onKeyDown={(event) => { if (event.key === "Escape" && !document.querySelector('[aria-modal="true"]')) onClose(); }}>
    <div className="guide-overview">
      <span className="guide-eyebrow">{t("guideEyebrow")}</span>
      <h2 id="guide-heading">{t("guideTitle")}</h2>
      <p>{t("guideIntro")}</p>
      <a href={`${import.meta.env.BASE_URL}${GUIDE_DECKLIST_FILE}`} download="demo-decklist.png">
        <Download size={14} aria-hidden="true" />{t("guideDownloadImage")}
      </a>
    </div>
    <div className="guide-lesson">
      <nav className="guide-steps" aria-label={t("guideSteps")}>
        {steps.map((item, index) => <button key={item.title} type="button"
          aria-current={index === step ? "step" : undefined}
          aria-label={t("guideStepLabel", { number: index + 1, title: t(item.title) })}
          onClick={() => onStepChange(index)}><span aria-hidden="true">{index + 1}</span>{t(item.title)}</button>)}
      </nav>
      <div className="guide-instructions" aria-live="polite" aria-atomic="true">
        <h3 ref={headingRef} tabIndex={-1}>{t(current.title)}</h3>
        <p>{t(current.body)}</p>
        {step === 3 ? <strong className="guide-total">{t("guideRowCount", { count: rowCount })}</strong> : null}
        <p className={`guide-tip${step === 4 ? " guide-tip--save" : ""}`}>{t(current.tip)}</p>
      </div>
      <div className="guide-actions">
        {step === 0 ? <button type="button" className="rf-action-primary" disabled={busy} onClick={onLoadExample}>
          <Play size={15} aria-hidden="true" />{t("guideLoadExample")}
        </button> : current.target ? <button type="button" onClick={() => onShowControls(current.target!)}>
          <LocateFixed size={15} aria-hidden="true" />{t("guideShowControls")}
        </button> : <button type="button" onClick={onPreview}><Eye size={15} aria-hidden="true" />{t("previewRow")}</button>}
        <div className="guide-pagination">
          <button type="button" disabled={step === 0} aria-label={t("guidePrevious")} onClick={() => onStepChange(step - 1)}><ArrowLeft size={15} aria-hidden="true" /></button>
          <span>{t("guideProgress", { current: step + 1, total: steps.length })}</span>
          <button type="button" onClick={() => step === steps.length - 1 ? onClose() : onStepChange(step + 1)}>
            {t(step === steps.length - 1 ? "guideFinish" : "guideNext")}<ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
    <figure className="guide-example">
      <img src={`${import.meta.env.BASE_URL}${GUIDE_DECKLIST_FILE}`} alt={t("guideImageAlt")} width="900" height="760" />
      <figcaption>{t("guideImageCaption")}</figcaption>
    </figure>
    <button type="button" className="guide-close icon-button" aria-label={t("guideClose")} onClick={onClose}><X size={17} /></button>
  </section>;
}
