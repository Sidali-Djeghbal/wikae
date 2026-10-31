// Text pages (Sync, Support, legal): the nav's backdrop, theme toggle, and language toggle.
import { initThemeToggle } from "./theme.js";
import { initLanguageToggle } from "./i18n.js";

const nav = document.getElementById("nav");
const onScroll = () => nav?.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
initThemeToggle();
initLanguageToggle();
