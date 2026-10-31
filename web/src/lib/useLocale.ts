// React hook: re-renders when the locale changes.
import { useEffect, useState } from "react";
import { locale, setLocale, t as rawT, dir, isRtl, LOCALE_OPTIONS, type LocaleId } from "./i18n";

export function useLocale() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const h = () => rerender((n) => n + 1);
    window.addEventListener("wikae:locale", h);
    window.addEventListener("wikaa:locale", h);
    window.addEventListener("etude:locale", h);
    return () => {
      window.removeEventListener("wikae:locale", h);
      window.removeEventListener("wikaa:locale", h);
      window.removeEventListener("etude:locale", h);
    };
  }, []);
  const current = locale();
  const toggle = () => setLocale(current === "ar" ? "en" : "ar");
  return {
    locale: current,
    setLocale,
    toggle,
    t: rawT,
    dir: dir(),
    isRtl: isRtl(),
    options: LOCALE_OPTIONS,
  };
}

export { t, setLocale, locale, dir, isRtl, LOCALE_OPTIONS } from "./i18n";
export type { LocaleId } from "./i18n";
