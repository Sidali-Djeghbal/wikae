// JavaScript with tests runs here, in the sandbox. Everything else goes to the AI grader.
const lang = String(view.language || "").trim().toLowerCase();
const js = ["js", "javascript", "node", "mjs", "ecmascript"].includes(lang);
const tests = Array.isArray(key.tests) ? key.tests : [];
if (!js || !tests.length) return { defer: true };

const show = (v) => {
  if (v === undefined) return "undefined";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" && !Number.isFinite(v)) return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};
const same = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, k) => same(v, b[k]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
  }
  return Number.isNaN(a) && Number.isNaN(b);
};

let run;
try {
  // Direct eval inside the answer's own scope sees its functions and variables. The finally keeps a
  // top-level `return` in the answer from replacing the evaluator; rethrow keeps its errors visible.
  run = new Function(`"use strict";
let __ev, __err = null;
try {
  __ev = (__expr) => eval(__expr);
${answer}
} catch (e) { __err = e; } finally { if (__err) throw __err; return __ev; }`)();
} catch (e) {
  return { score: 0, feedback: `The code doesn't run: ${e.message}`, details: { tests: tests.map(([expr, expected]) => ({ expr, expected: show(expected), got: "not run", ok: false })) } };
}
const results = tests.map(([expr, expected]) => {
  let got;
  try { got = run(expr); } catch (e) { return { expr, expected: show(expected), got: `${e.name}: ${e.message}`, ok: false }; }
  return { expr, expected: show(expected), got: show(got), ok: same(got, expected) };
});
const passed = results.filter((r) => r.ok).length;
const first = results.find((r) => !r.ok);
return {
  score: passed / results.length,
  feedback: first ? `${passed} of ${results.length} tests pass. First failure: \`${first.expr}\` should be \`${first.expected}\`, got \`${first.got}\`.` : `All ${results.length} tests pass.`,
  details: { tests: results },
};
