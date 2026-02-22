import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";

/**
 * Supported languages with their display names (in their own language).
 * Used by the language selector UI.
 */
export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "pt-BR": { translation: ptBR },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
    detection: {
      // Order of detection: localStorage first, then browser language
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "openclaw-language",
      caches: ["localStorage"],
    },
  });

export default i18n;
