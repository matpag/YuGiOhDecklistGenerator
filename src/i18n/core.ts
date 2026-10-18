export const LANGUAGES = ["en", "it", "de", "es", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_STORAGE_KEY = "retroformats-ui-language";
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English", it: "Italiano", de: "Deutsch", es: "Español", fr: "Français",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGES.includes(value as Language);
}

export function resolveLanguage(url: string, stored: unknown, browserLanguages: readonly string[]): Language {
  let parameter: string | null = null;
  try { parameter = new URL(url).searchParams.get("ui_lang"); } catch { /* Invalid URLs use the remaining preferences. */ }
  if (isLanguage(parameter)) return parameter;
  if (isLanguage(stored)) return stored;
  for (const candidate of browserLanguages) {
    const language = candidate.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(language)) return language;
  }
  return "en";
}

export function readLanguageStorage(getStorage: () => Pick<Storage, "getItem">): string | null {
  try { return getStorage().getItem(LANGUAGE_STORAGE_KEY); } catch { return null; }
}

export function writeLanguageStorage(getStorage: () => Pick<Storage, "setItem">, language: Language): void {
  try { getStorage().setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* The interface remains usable without storage. */ }
}

export function withLanguage(url: string, language: Language): string {
  const result = new URL(url);
  result.searchParams.set("ui_lang", language);
  return result.href;
}
