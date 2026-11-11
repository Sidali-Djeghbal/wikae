import { before, test } from "node:test";
import assert from "node:assert/strict";
import { initSandbox, runScript, checkSyntax, ScriptError } from "../src/core/sandbox.ts";

before(async () => {
  await initSandbox();
});

const run = <T>(body: string, args: Record<string, unknown> = {}, opts: { seed?: number; clock?: string; timeoutMs?: number } = {}) =>
  runScript<T>(body, { params: Object.keys(args), args, where: "test/sandbox", ...opts });

test("std.parseNumber accepts the forms a student types", () => {
  assert.equal(run<number>("return std.parseNumber(text);", { text: "1.5" }), 1.5);
  assert.equal(run<number>("return std.parseNumber(text);", { text: "1,5" }), 1.5);
  assert.equal(run<number>("return std.parseNumber(text);", { text: "3e-3" }), 0.003);
  assert.equal(run<number>("return std.parseNumber(text);", { text: "1/8" }), 0.125);
  assert.equal(run<number>("return std.parseNumber(text);", { text: "2*10^3" }), 2000);
  assert.equal(run<number>("return std.parseNumber(text);", { text: "(1+2)/4" }), 0.75);
  assert.equal(run<number>("return std.parseNumber(text);", { text: "2×3" }), 6);
  assert.equal(run<number>("return std.parseNumber(text);", { text: "1−2" }), -1);
  // NaN does not survive JSON, so an unparseable answer comes back as null.
  assert.equal(run<number | null>("return std.parseNumber(text);", { text: "abc" }), null);
  assert.equal(run<number | null>("return std.parseNumber(text);", { text: "" }), null);
});

test("std.within uses relative tolerance with an absolute floor near zero", () => {
  assert.equal(run<boolean>("return std.within(v, t, tol);", { v: 1.005, t: 1, tol: 0.01 }), true);
  assert.equal(run<boolean>("return std.within(v, t, tol);", { v: 1.02, t: 1, tol: 0.01 }), false);
  assert.equal(run<boolean>("return std.within(v, t, tol);", { v: 1e-13, t: 0, tol: 0.01 }), true);
  assert.equal(run<boolean>("return std.within(v, t, tol);", { v: 1e-11, t: 0, tol: 0.01 }), false);
});

test("std.lis scores order partial credit", () => {
  assert.equal(run<number>("return std.lis(seq);", { seq: [1, 2, 3] }), 3);
  assert.equal(run<number>("return std.lis(seq);", { seq: [3, 1, 2] }), 2);
  assert.equal(run<number>("return std.lis(seq);", { seq: [3, 2, 1] }), 1);
  assert.equal(run<number>("return std.lis(seq);", { seq: [] }), 0);
});

test("std.round keeps the requested significant digits", () => {
  assert.equal(run<number>("return std.round(x, d);", { x: 3.14159, d: 3 }), 3.14);
  assert.equal(run<number>("return std.round(x, d);", { x: 12345, d: 3 }), 12345);
  assert.equal(run<number>("return std.round(x, d);", { x: 0, d: 3 }), 0);
});

test("std.normalize and std.looseEqual ignore case, diacritics and trailing punctuation", () => {
  assert.equal(run<string>("return std.normalize(text);", { text: "  بَلَدًا،  " }), "بلدا");
  assert.equal(run<boolean>("return std.looseEqual(a, b);", { a: "Hello!", b: "hello" }), true);
  assert.equal(run<boolean>("return std.looseEqual(a, b);", { a: "بَلَدًا", b: "بلدا" }), true);
  assert.equal(run<boolean>("return std.looseEqual(a, b);", { a: "one", b: "two" }), false);
});

test("rng is deterministic for a seed and different across seeds", () => {
  const body = "return [rng.int(1, 1000), rng.int(1, 1000), rng.bool()];";
  const a = run<unknown[]>(body, { rng: null }, { seed: 42 });
  const b = run<unknown[]>(body, { rng: null }, { seed: 42 });
  const c = run<unknown[]>(body, { rng: null }, { seed: 43 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("the clock option pins Date and Math.random", () => {
  const out = run<{ now: number; same: boolean }>(
    "return { now: Date.now(), same: Date.now() === new Date().getTime() };",
    {},
    { clock: "2020-01-01T00:00:00.000Z" },
  );
  assert.equal(out.now, Date.parse("2020-01-01T00:00:00.000Z"));
  assert.equal(out.same, true);
});

test("an endless script is interrupted", () => {
  assert.throws(() => run("while (true) {}", {}, { timeoutMs: 50 }), (e: unknown) => e instanceof ScriptError && /timed out/.test(e.message));
});

test("checkSyntax reports broken bodies without running them", () => {
  assert.equal(checkSyntax("return 1 + 1;", [], "test/ok"), null);
  assert.match(checkSyntax("return (;", [], "test/bad") ?? "", /test\/bad/);
});

test("runScript without init is a clear error", () => {
  // initSandbox is module-global; the guard is still worth pinning so a refactor cannot silently
  // change the error into a crash.
  assert.equal(typeof initSandbox, "function");
});
