// Theme manager for Wikae (Dark / Light mode).
// Handles toggle switch, system preference detection, persistence in localStorage,
// and posting theme updates to embedded card iframes.

const THEME_KEY = "wikae-theme";
const THEME_VARS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--popover", "--popover-foreground", "--muted", "--muted-foreground",
  "--secondary", "--secondary-foreground", "--border", "--input",
  "--primary", "--primary-foreground", "--accent", "--accent-foreground",
  "--ring", "--destructive", "--success", "--warning", "--danger",
  "--highlight", "--again", "--hard", "--good", "--easy", "--new",
  "--learn", "--review", "--radius", "--font-sans", "--font-mono"
];

export function getThemeVars() {
  const cs = getComputedStyle(document.documentElement);
  const vars = {};
  for (const v of THEME_VARS) {
    const val = cs.getPropertyValue(v).trim();
    if (val) vars[v] = val;
  }
  return vars;
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#fbfbfb" : "#0d0d0c");

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {}

  // Update any active iframes (card demos)
  const vars = getThemeVars();
  document.querySelectorAll("iframe").forEach((frame) => {
    try {
      frame.contentWindow?.postMessage({
        type: "theme",
        theme: { scheme: theme, vars }
      }, "*");
    } catch (_) {}
  });

  window.dispatchEvent(new CustomEvent("wikae-theme-change", { detail: { theme, vars } }));
}

export function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = getCurrentTheme();
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
    });
  }

  // When OS color scheme changes and user hasn't explicitly overridden:
  try {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  } catch (_) {}
}
