// A drill: the card comes back on every practice day, `perDay` times, and keeps a small record.
// Nothing here tries to predict forgetting; the grader's results are the data.
const prev = card.state ?? {};
const score = attempt.score;
const state = {
  sessions: (prev.sessions ?? 0) + 1,
  best: score == null ? (prev.best ?? null) : Math.max(prev.best ?? 0, score),
  last: score,
};
const doneToday = ctx.doneToday + 1;
if (options.perDay === 0 || doneToday < options.perDay) return { due: ctx.now, state };
const days = Math.min(Math.max(1, Math.floor(Number(options.everyDays) || 1)), ctx.day.length - 1);
return { due: ctx.day[days], state };
