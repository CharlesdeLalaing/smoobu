import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslations from "./translations/en.json";
import frTranslations from "./translations/fr.json";
import nlTranslations from "./translations/nl.json";

i18n.use(initReactI18next).init({
    resources: {
        en: enTranslations,
        fr: frTranslations,
        nl: nlTranslations,
    },
    lng: "fr", // default language
    fallbackLng: "fr",
    interpolation: {
        escapeValue: false,
    },
    react: {
        useSuspense: false,
    },
});

export default i18n;