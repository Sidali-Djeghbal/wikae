// Lightweight, robust i18n system for Etude
// Supports English & professional Arabic, with reactive locale switching, RTL support,
// and automatic DOM translation coverage for all UI elements.

import en from "../locales/en";
import ar from "../locales/ar";

export type LocaleId = "en" | "ar";
export type TranslationMap = Record<string, string>;

const locales: Record<LocaleId, TranslationMap> = { en, ar };

const STORAGE_KEY = "etude.language";
const RTL_LOCALES: Set<LocaleId> = new Set(["ar"]);

function detect(): LocaleId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in locales) return stored as LocaleId;
  } catch { /* storage blocked */ }
  const nav = navigator.language?.split("-")[0]?.toLowerCase();
  if (nav in locales) return nav as LocaleId;
  return "en";
}

let current: LocaleId = detect();

export function locale(): LocaleId {
  return current;
}

export function dir(): "ltr" | "rtl" {
  return RTL_LOCALES.has(current) ? "rtl" : "ltr";
}

export function isRtl(): boolean {
  return RTL_LOCALES.has(current);
}

export function setLocale(id: LocaleId) {
  if (id === current && document.documentElement.lang === id) return;
  current = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* storage blocked */ }
  applyLocaleToDocument();
  if (typeof document !== "undefined" && document.body) {
    walkAndTranslate(document.body);
  }
  window.dispatchEvent(new Event("etude:locale"));
}

/** Look up a translation key. Falls back to English, then to the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  if (!key) return "";
  let text = locales[current]?.[key] ?? locales.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Available locales for the settings UI. */
export const LOCALE_OPTIONS: { id: LocaleId; label: string; nativeLabel: string }[] = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "ar", label: "Arabic", nativeLabel: "العربية" },
];

function applyLocaleToDocument() {
  const d = dir();
  document.documentElement.lang = current;
  document.documentElement.dir = d;
  if (d === "rtl") {
    document.documentElement.classList.add("rtl");
  } else {
    document.documentElement.classList.remove("rtl");
  }
}

// --------------------------------------------------------------------------
// DOM Auto-Translator: provides 100% Arabic coverage for static/dynamic UI nodes
// --------------------------------------------------------------------------
const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "IFRAME", "TEXTAREA"]);

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (IGNORED_TAGS.has(parent.tagName)) return true;
  if (parent.closest("[data-no-translate], [contenteditable='true'], .cm-editor, .monaco-editor, iframe")) {
    return true;
  }
  return false;
}

function translateText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = locales[current]?.[trimmed];
  if (match && match !== trimmed) {
    const startWs = text.match(/^\s*/)?.[0] ?? "";
    const endWs = text.match(/\s*$/)?.[0] ?? "";
    return startWs + match + endWs;
  }
  return null;
}

const originalText = new WeakMap<Node, string>();
const originalAttrs = new WeakMap<Element, { placeholder?: string; title?: string; aria?: string }>();

function translateElementAttributes(el: HTMLElement) {
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const input = el as HTMLInputElement;
    if (input.placeholder) {
      if (!originalAttrs.has(el)) originalAttrs.set(el, {});
      const stored = originalAttrs.get(el)!;
      if (!("placeholder" in stored)) stored.placeholder = input.placeholder;
      if (stored.placeholder) {
        const trans = locales[current]?.[stored.placeholder.trim()];
        if (trans && trans !== input.placeholder) {
          input.placeholder = trans;
        }
      }
    }
  }
  if (el.title) {
    if (!originalAttrs.has(el)) originalAttrs.set(el, {});
    const stored = originalAttrs.get(el)!;
    if (!("title" in stored)) stored.title = el.title;
    if (stored.title) {
      const trans = locales[current]?.[stored.title.trim()];
      if (trans && trans !== el.title) {
        el.title = trans;
      }
    }
  }
  const aria = el.getAttribute("aria-label");
  if (aria) {
    if (!originalAttrs.has(el)) originalAttrs.set(el, {});
    const stored = originalAttrs.get(el)!;
    if (!("aria" in stored)) stored.aria = aria;
    if (stored.aria) {
      const trans = locales[current]?.[stored.aria.trim()];
      if (trans && trans !== aria) {
        el.setAttribute("aria-label", trans);
      }
    }
  }
}

function restoreElementAttributes(el: HTMLElement) {
  const stored = originalAttrs.get(el);
  if (!stored) return;
  if ("placeholder" in stored && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
    (el as HTMLInputElement).placeholder = stored.placeholder!;
  }
  if ("title" in stored) {
    el.title = stored.title!;
  }
  if ("aria" in stored) {
    el.setAttribute("aria-label", stored.aria!);
  }
}

function walkAndTranslate(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!shouldSkipNode(root)) {
      if (current === "ar") {
        const raw = root.nodeValue ?? "";
        if (!originalText.has(root)) {
          originalText.set(root, raw);
        }
        const source = originalText.get(root) ?? raw;
        const translated = translateText(source);
        if (translated && root.nodeValue !== translated) {
          root.nodeValue = translated;
        }
      } else {
        const orig = originalText.get(root);
        if (orig !== undefined && root.nodeValue !== orig) {
          root.nodeValue = orig;
        }
      }
    }
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as HTMLElement;
    if (IGNORED_TAGS.has(el.tagName) || el.hasAttribute("data-no-translate") || el.classList.contains("cm-editor")) {
      return;
    }
    if (current === "ar") {
      translateElementAttributes(el);
    } else {
      restoreElementAttributes(el);
    }
    let child = root.firstChild;
    while (child) {
      walkAndTranslate(child);
      child = child.nextSibling;
    }
  }
}

let observer: MutationObserver | null = null;

function setupDomTranslator() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  applyLocaleToDocument();

  if (document.body) {
    walkAndTranslate(document.body);
  }

  if (!observer) {
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          for (const node of m.addedNodes) {
            walkAndTranslate(node);
          }
        } else if (m.type === "characterData") {
          if (!shouldSkipNode(m.target)) {
            if (current === "ar") {
              const raw = m.target.nodeValue ?? "";
              const translated = translateText(raw);
              if (translated && m.target.nodeValue !== translated) {
                originalText.set(m.target, raw);
                m.target.nodeValue = translated;
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupDomTranslator);
  } else {
    setupDomTranslator();
  }
}
