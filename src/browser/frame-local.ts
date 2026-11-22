// Turns a card frame from the server's shape (stylesheets and the runtime loaded from /runtime)
// into one self-contained document: a sandboxed srcdoc frame has nowhere to load them from.
import runtime from "./gen/frame-runtime.js?raw";
import kit from "./gen/frame-kit.js?raw";
import css from "./gen/frame.css?raw";
import shim from "./frame-shim.js?raw";

const script = (js: string) => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`;

export function localFrame(html: string): string {
  const base = /<base href="([^"]*)">/.exec(html)?.[1] ?? "";
  // Function replacements throughout: the minified runtime contains "$'" and "$&", which a
  // string replacement would expand.
  let out = html.replace(/<link rel="stylesheet" href="[^"]*runtime\/[^"]*">\n?/g, () => "");
  // lastIndexOf: a card's own CSS could contain the literal `</head>` in a comment.
  const head = out.lastIndexOf("</head>");
  if (head !== -1) out = out.slice(0, head) + `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>\n` + out.slice(head);
  out = out.replace(`import { boot } from "${base}runtime/runtime.js";`, () => "const { boot } = globalThis.EtudeRuntime;");
  out = out.replace('<script type="module">', () => `${script(shim)}\n${script(runtime)}\n${script(kit)}\n<script type="module">`);
  return out;
}
