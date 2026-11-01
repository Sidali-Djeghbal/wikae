const blanks = [];
const text = String(fields.text).replace(/\{\{([\s\S]+?)\}\}/g, (_, inner) => {
  const parts = inner.split("::");
  let ans, hint;
  if (/^c\d+$/i.test(parts[0]?.trim()) && parts.length > 1) {
    // Anki-style cloze: {{c1::answer}} or {{c1::answer::hint}}
    ans = parts[1];
    hint = parts.slice(2).join("::");
  } else {
    // Standard Etude cloze: {{answer}} or {{answer::hint}}
    ans = parts[0];
    hint = parts.slice(1).join("::");
  }
  const answers = ans.split("|").map((s) => s.trim()).filter(Boolean);
  let cleanHint = (hint ?? "").trim();
  // Ensure the hint never accidentally leaks any of the accepted answers
  if (answers.some((a) => std.looseEqual(a, cleanHint))) {
    cleanHint = "";
  }
  const i = blanks.length;
  blanks.push({ answers, hint: cleanHint });
  return `⟦${i}⟧`;
});
return {
  view: { text, blanks: blanks.map((b, i) => ({ id: i, hint: b.hint, size: Math.max(4, ...b.answers.map((a) => a.length)) })) },
  key: { answers: blanks.map((b) => b.answers), explanation: fields.explanation ?? "" },
};
