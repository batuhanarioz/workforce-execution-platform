"use client";

import type { Locale } from "../lib/i18n";

type Props = {
  locale: Locale;
  onChange: (locale: Locale) => void;
};

export function LanguageSwitch({ locale, onChange }: Props) {
  return (
    <div className="language-switch" aria-label="Language switcher">
      <button
        type="button"
        className={locale === "en" ? "primary" : "secondary"}
        onClick={() => onChange("en")}
        aria-label="English"
        title="English"
      >
        <span className="flag flag-en" aria-hidden="true">🇬🇧</span>
        <span>EN</span>
      </button>
      <button
        type="button"
        className={locale === "tr" ? "primary" : "secondary"}
        onClick={() => onChange("tr")}
        aria-label="Türkçe"
        title="Türkçe"
      >
        <span className="flag flag-tr" aria-hidden="true">🇹🇷</span>
        <span>TR</span>
      </button>
    </div>
  );
}
