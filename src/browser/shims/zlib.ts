import { Buffer } from "buffer";
import { Inflate } from "fflate";
import { decompress } from "fzstd";

/** Mirrors node:zlib's maxOutputLength: abort as soon as a zip bomb exceeds the cap. */
export function inflateRawSync(b: Uint8Array, opts?: { maxOutputLength?: number }): Buffer {
  const max = opts?.maxOutputLength ?? Infinity;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const inf = new Inflate((chunk) => {
    size += chunk.length;
    if (size > max) {
      inf.terminate();
      throw new Error("decompressed output is too large");
    }
    chunks.push(chunk);
  });
  inf.push(b, true);
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return Buffer.from(out);
}

// shortcut: fzstd has no streaming cap; check after decompression so an oversized frame is still rejected.
export function zstdDecompressSync(b: Uint8Array, opts?: { maxOutputLength?: number }): Buffer {
  const out = Buffer.from(decompress(b));
  if (opts?.maxOutputLength != null && out.length > opts.maxOutputLength) throw new Error("decompressed output is too large");
  return out;
}
export default { inflateRawSync, zstdDecompressSync };
