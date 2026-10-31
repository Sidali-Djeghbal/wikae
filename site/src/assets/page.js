// Text pages (Sync, Support, legal): the nav's backdrop once the page scrolls, and theme toggle.
import { initThemeToggle } from "./theme.js";

const nav = document.getElementById("nav");
const onScroll = () => nav?.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
initThemeToggle();
