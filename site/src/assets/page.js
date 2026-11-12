// Text pages (Sync, Support, legal): the nav's backdrop, theme toggle, and language toggle.
import { initThemeToggle } from "./theme.js";
import { initLanguageToggle } from "./i18n.js";

const nav = document.getElementById("nav");
let lastY = Math.max(0, scrollY);
const onScroll = () => {
  if (!nav) return;
  const y = Math.max(0, scrollY);
  nav.classList.toggle("scrolled", y > 8);
  if (y <= 80) {
    nav.classList.remove("nav-hidden");
    lastY = y;
  } else if (y > lastY + 12) {
    nav.classList.add("nav-hidden");
    lastY = y;
  } else if (y < lastY - 2) {
    nav.classList.remove("nav-hidden");
    lastY = y;
  }
};
addEventListener("scroll", onScroll, { passive: true });
nav?.addEventListener("focusin", () => nav.classList.remove("nav-hidden"));
onScroll();
initThemeToggle();
initLanguageToggle();
