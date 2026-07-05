"use client";

import { useRouter } from "next/navigation";
import { LanguageSwitch } from "./language-switch";
import { useLocale } from "../lib/i18n";

export function GlobalLanguageSwitch() {
  const [locale, setLocale] = useLocale();
  const router = useRouter();

  function handleChange(nextLocale: "en" | "tr") {
    setLocale(nextLocale);
    router.refresh();
  }

  return <LanguageSwitch locale={locale} onChange={handleChange} />;
}
