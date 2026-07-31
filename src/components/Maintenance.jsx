// Maintenance.jsx — shown on guest-facing routes when VITE_MAINTENANCE_MODE is enabled
import { useTranslation } from "react-i18next";
import logo from "../assets/logoBaseilles.webp";

const LANGUAGES = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "nl", label: "NL" },
];

function Maintenance() {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 py-12 text-center">
      <img
        src={logo}
        alt="Les Baseilles"
        className="w-40 md:w-52 mb-10 object-contain"
      />

      <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
        {t("maintenance.title")}
      </h1>

      <p className="max-w-xl text-gray-600 leading-relaxed mb-2">
        {t("maintenance.message")}
      </p>

      <p className="max-w-xl text-gray-600 leading-relaxed mb-10">
        {t("maintenance.contact")}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        <a
          href={`tel:${t("maintenance.phone").replace(/\s/g, "")}`}
          className="px-6 py-3 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50 transition"
        >
          {t("maintenance.phone")}
        </a>
        <a
          href={`mailto:${t("maintenance.email")}`}
          className="px-6 py-3 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50 transition"
        >
          {t("maintenance.email")}
        </a>
      </div>

      <div className="flex gap-3">
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            onClick={() => i18n.changeLanguage(code)}
            className={`px-3 py-1 text-sm rounded ${
              i18n.language === code
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Maintenance;
