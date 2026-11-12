// Serves site/dist like GitHub Pages does (with `Access-Control-Allow-Origin: *`, which the
// sandboxed card frames need), under /etude/ so paths match the published site.
//   node site/tools/serve.mjs [port]
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const port = Number(process.argv[2] ?? 4620);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain" };

const reloadClients = new Set();

createServer((req, res) => {
  if (req.url === "/_reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    reloadClients.add(res);
    req.on("close", () => reloadClients.delete(res));
    return;
  }
  if (req.url === "/_reload_trigger") {
    for (const c of reloadClients) {
      try { c.write("data: reload\n\n"); } catch {}
    }
    res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
    return res.end("ok");
  }

  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/") { res.writeHead(302, { Location: "/wikae/" }); return res.end(); }
  const prefix = path.startsWith("/wikae/") ? "/wikae/" : path.startsWith("/etude/") ? "/etude/" : null;
  if (!prefix) { path = "/wikae/404.html"; }
  let file = join(dist, normalize(path.slice((prefix ?? "/wikae/").length)));
  if (file.endsWith("/") || (existsSync(file) && statSync(file).isDirectory())) file = join(file, "index.html");
  // GitHub Pages serves /sync from sync.html.
  if (!existsSync(file) && !extname(file) && existsSync(file + ".html")) file += ".html";
  const found = file.startsWith(dist) && existsSync(file);
  if (!found) file = join(dist, "404.html");
  const ext = extname(file);
  res.writeHead(found ? 200 : 404, { "Content-Type": MIME[ext] ?? "application/octet-stream", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" });
  if (ext === ".html") {
    let html = readFileSync(file, "utf8");
    const liveScript = `<script>(function(){try{var e=new EventSource('/_reload');e.onmessage=function(){location.reload()};e.onerror=function(){setTimeout(function(){location.reload()},2500)}}catch(x){}})();</script>`;
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${liveScript}</body>`);
    } else {
      html += liveScript;
    }
    return res.end(html);
  }
  res.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/wikae/`));
