// Language and direction manager for Wikae (Arabic RTL / English LTR).
const LANG_KEY = "wikae-lang";

export function getCurrentLang() {
  return document.documentElement.getAttribute("lang") || "ar";
}

export function setLanguage(lang) {
  const isAr = lang === "ar";
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", isAr ? "rtl" : "ltr");
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (_) {}

  const titles = {
    ar: {
      index: "وِكَاء — رِباطُ المحفوظ وإتقان المتشابهات بالتكرار المتباعد الذكي",
      download: "تحميل وِكَاء — لنظام Windows و macOS و Linux",
      support: "الدعم والمساعدة — وِكَاء",
      sync: "المزامنة المشفرة — وِكَاء"
    },
    en: {
      index: "Wikae — Spaced Repetition for Quran, Mutashabihat and Knowledge",
      download: "Download Wikae — for Windows, macOS and Linux",
      support: "Support & Help — Wikae",
      sync: "Encrypted Sync — Wikae"
    }
  };

  const path = window.location.pathname.toLowerCase();
  let pageKey = "index";
  if (path.includes("download")) pageKey = "download";
  else if (path.includes("support")) pageKey = "support";
  else if (path.includes("sync")) pageKey = "sync";

  if (titles[lang]?.[pageKey]) {
    document.title = titles[lang][pageKey];
  }

  // Update dynamic elements
  window.dispatchEvent(new CustomEvent("wikae-lang-change", { detail: { lang, dir: isAr ? "rtl" : "ltr" } }));
}

export function initLanguageToggle() {
  const btn = document.getElementById("lang-toggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = getCurrentLang();
      const next = current === "ar" ? "en" : "ar";
      setLanguage(next);
    });
  }
}
