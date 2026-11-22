import { test } from "node:test";
import assert from "node:assert/strict";
import { imageSize } from "../src/core/image-size.ts";

test("JPEG skips repeated 0xFF fill bytes before a marker", () => {
  // SOI, three fill bytes, then SOF0 with height 100 and width 200.
  const jpeg = Buffer.from("ffd8ffffffc0000b08006400c801011100", "hex");
  assert.deepEqual(imageSize(jpeg), { width: 200, height: 100 });
});

test("SVG width ignores attributes that merely end in width", () => {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" data-stroke-width="999" stroke-width="2" width="120px" height="80px" viewBox="0 0 10 10"></svg>`);
  assert.deepEqual(imageSize(svg), { width: 120, height: 80 });
});
