import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ja from "./locales/ja/translation.json";
import en from "./locales/en/translation.json";

void i18n.use(initReactI18next).init({
  lng: "ja",
  fallbackLng: "ja",
  interpolation: { escapeValue: false },
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
});

export default i18n;
