import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGE_NAMES, LANGUAGES, readLanguageStorage, resolveLanguage, withLanguage, writeLanguageStorage, type Language } from "./core";
import { translate, UiError, type MessageKey, type Translator } from "./messages";

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translator;
  link: (url: string) => string;
  errorMessage: (error: unknown, fallback: MessageKey) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => resolveLanguage(
    window.location.href,
    readLanguageStorage(() => window.localStorage),
    navigator.languages?.length ? navigator.languages : [navigator.language],
  ));
  const t = useCallback<Translator>((key, values) => translate(language, key, values), [language]);
  const link = useCallback((url: string) => withLanguage(url, language), [language]);
  const errorMessage = useCallback((error: unknown, fallback: MessageKey) =>
    error instanceof UiError ? t(error.key, error.values) : t(fallback), [t]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `${t("product")} · Retroformats`;
    writeLanguageStorage(() => window.localStorage, language);
    try { window.history.replaceState(window.history.state, "", withLanguage(window.location.href, language)); } catch { /* Sandboxed documents can still change interface language. */ }
  }, [language, t]);

  const value = useMemo(() => ({ language, setLanguage, t, link, errorMessage }), [language, t, link, errorMessage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n requires I18nProvider");
  return value;
}

export function LanguageControl() {
  const { language, setLanguage, t } = useI18n();
  return <label className="rf-language-control">
    <span>{t("language")}</span>
    <select className="rf-language-select" data-ui-language-select aria-label={t("language")} value={language}
      onChange={(event) => setLanguage(event.target.value as Language)}>
      {LANGUAGES.map(value => <option key={value} value={value} lang={value}>{LANGUAGE_NAMES[value]}</option>)}
    </select>
  </label>;
}
