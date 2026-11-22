import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Etude } from "../src/core/engine.ts";
import { createApp } from "../src/server/app.ts";

async function collection() {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "etude-range-"));
  return Etude.open(join(dir, "etude.db"), { home: dir });
}

test("static files support byte ranges for seeking media", async () => {
  const e = await collection();
  try {
    const app = createApp(e);
    const full = await app.request("/runtime/runtime.js");
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    const bytes = new Uint8Array(await full.arrayBuffer());
    assert.ok(bytes.length > 100);

    const part = await app.request("/runtime/runtime.js", { headers: { range: "bytes=10-19" } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), `bytes 10-19/${bytes.length}`);
    assert.equal(part.headers.get("content-length"), "10");
    assert.deepEqual(new Uint8Array(await part.arrayBuffer()), bytes.slice(10, 20));

    const suffix = await app.request("/runtime/runtime.js", { headers: { range: "bytes=-5" } });
    assert.equal(suffix.status, 206);
    assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()), bytes.slice(-5));

    const open = await app.request("/runtime/runtime.js", { headers: { range: "bytes=1000000-" } });
    assert.equal(open.status, 416);
    assert.equal(open.headers.get("content-range"), `bytes */${bytes.length}`);

    const bad = await app.request("/runtime/runtime.js", { headers: { range: "bytes=abc" } });
    assert.equal(bad.status, 416);
  } finally {
    e.close();
  }
});
