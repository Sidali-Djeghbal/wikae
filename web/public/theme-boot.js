// The last theme, before the first paint, so a light theme doesn't flash dark. Embeds follow their host instead.
(function () {
  try {
    if (location.pathname === "/embed") return;
    var rawTheme = localStorage.getItem("wikae.theme") || localStorage.getItem("wikaa.theme") || localStorage.getItem("etude.theme");
    var t = JSON.parse(rawTheme || "null");
    if (!t || typeof t.css !== "string") return;
    var s = document.createElement("style");
    s.id = "wikae-theme";
    s.textContent = t.css;
    document.head.appendChild(s);
    var root = document.documentElement;
    root.classList.toggle("dark", t.scheme !== "light");
    root.dataset.theme = t.id;
    var metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaScheme) metaScheme.content = t.scheme === "light" ? "light" : "dark";
    if (t.bg) {
      var metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) metaTheme.content = t.bg;
    }
    var lang = localStorage.getItem("wikae.language") || localStorage.getItem("wikaa.language") || localStorage.getItem("etude.language");
    if (lang === "ar") {
      root.lang = "ar";
      root.dir = "rtl";
      root.classList.add("rtl");
    }
  } catch (e) {}
})();
