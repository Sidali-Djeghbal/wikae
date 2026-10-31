import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, ChevronRight, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Heatmap, ShareBar, fmtDay, fmtDuration, parseDay } from "@/components/stats-charts";
import { Donut, ForgettingCurve, Histogram, ProgressChart, RecallRing, SERIF, Sparkline, StudyClock, recallColor } from "@/components/stats-viz";
import { api, type DeckNode, type LearnerSummary, type PracticeCard, type StatsScheduler, type Stats } from "@/lib/api";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";
import { PHONE_H1 } from "@/components/page";
import { useLocale } from "@/lib/useLocale";
import { locale, t } from "@/lib/i18n";

/** The engine window: ratings, verdicts and the heatmap cover this many weeks. */
const WEEKS = 26;
const pct = (v: number | null, digits = 0) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`);

export function StatsPage({ deck }: { deck?: string }) {
  const { t } = useLocale();
  const [stats, setStats] = useState<Stats | null>(null);
  const [decks, setDecks] = useState<DeckNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.decks().then(setDecks).catch(() => {});
  }, []);
  useEffect(() => {
    setStats(null);
    api
      .stats({ deck }, WEEKS * 7)
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch((e) => {
        setError((e as Error).message);
        toast.error((e as Error).message);
      });
  }, [deck]);

  const scope = (v: string) => navigate(v === "__all" ? "/stats" : `/stats?deck=${encodeURIComponent(v)}`, { replace: true });

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 max-md:pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={cn("text-2xl font-semibold tracking-tight", PHONE_H1)}>{t("Stats")}</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground max-md:hidden">{deck ? deck.replace(/::/g, " › ") : t("All decks")}</p>
        </div>
        <Select value={deck ?? "__all"} onValueChange={scope}>
          <SelectTrigger className="h-10 w-full sm:w-72" aria-label="Scope"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="__all">{t("All decks")}</SelectItem>
            {decks.length > 0 && <SelectSeparator />}
            {decks.map((d) => (
              <SelectItem key={d.id} value={d.name}>
                <span style={{ paddingLeft: d.depth * 12 }}>{d.name.split("::").pop()}</span>
              </SelectItem>
            ))}
            {deck && !decks.some((d) => d.name === deck) && <SelectItem value={deck}>{deck}</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {error && !stats && <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{error}</div>}
      {!stats && !error && <Loading />}
      {stats && deck && <Skills deck={deck} />}
      {stats && <Body stats={stats} deck={deck} />}
    </div>
  );
}

/** Adaptive decks: what the deck estimates about each skill. Computed from the graded history. */
function Skills({ deck }: { deck: string }) {
  const [summary, setSummary] = useState<LearnerSummary | null>(null);
  useEffect(() => {
    setSummary(null);
    api.skills(deck).then(setSummary, () => setSummary(null));
  }, [deck]);
  if (!summary?.adaptive) return null;
  const pct = (x: number | null) => (x == null ? "–" : `${Math.round(x * 100)}%`);
  return (
    <div className="mb-6">
      <Panel title={t("Skills")} aside={summary.pace ? `${summary.pace.value} new cards today · ${summary.pace.reason}` : `Target ${pct(summary.settings.targetSuccess)} right`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground rtl:text-right">
              <tr>
                <th className="pb-2 font-normal">{t("Skill")}</th>
                <th className="pb-2 font-normal">{t("Answers")}</th>
                <th className="pb-2 font-normal" title={t("Share of the last 50 graded answers that were right")}>{t("Recently right")}</th>
                <th className="pb-2 font-normal" title={t("Predicted chance of getting a card of middling difficulty right")}>{t("Typical card")}</th>
                {summary.settings.levels.length > 0 && <th className="pb-2 font-normal">{t("Level")}</th>}
                <th className="pb-2 font-normal">{t("Placement")}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {summary.skills.map((s) => (
                <tr key={s.skill} className="border-t">
                  <td className="py-2 font-medium">{s.skill}</td>
                  <td className="py-2">{s.answers}</td>
                  <td className="py-2">{pct(s.success)}</td>
                  <td className="py-2">{pct(s.typical)}</td>
                  {summary.settings.levels.length > 0 && (
                    <td className="py-2">{s.level ? `${s.level.tag.split("::").pop()} · ${pct(s.level.progress)} stable${s.level.nextOpen ? " · next level open" : ""}${s.level.done ? " · all done" : ""}` : "–"}</td>
                  )}
                  <td className="py-2 text-muted-foreground" title={s.placement?.checks.done ? `${s.placement.checks.passed} of ${s.placement.checks.done} quick checks right` : undefined}>
                    {s.placement ? `${s.placement.frontier}${s.placement.revised ? " (lowered by quick checks)" : ""}${s.placement.done ? "" : " (in progress)"}` : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" />)}</div>
      <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      <div className="h-56 animate-pulse rounded-xl bg-muted/40" />
    </div>
  );
}

function Body({ stats, deck }: { stats: Stats; deck?: string }) {
  const s = stats;
  const totalReviews = s.days.reduce((a, d) => a + d.reviews, 0);
  // Every answer, a drill's runs included: what the heatmap and the clock count.
  const totalAnswers = totalReviews + s.days.reduce((a, d) => a + (d.runs ?? 0), 0);
  const totalMs = s.days.reduce((a, d) => a + d.ms, 0);
  const target = s.desiredRetention ?? 0.9;
  const scope = deck ? `deck:"${deck}" ` : "";

  // Every card in scope, whatever schedules it (s.cards counts FSRS cards only).
  const allCards = s.schedulers.reduce((a, x) => a + x.cards, 0);
  const kind = s.scheduler ? (s.schedulers.find((x) => x.id === s.scheduler)?.kind ?? (s.scheduler === "fsrs" ? "fsrs" : null)) : null;
  const others = s.schedulers.filter((x) => x.kind !== "fsrs");

  if (allCards === 0)
    return (
      <div className="rounded-xl border border-dashed px-6 py-14 text-center">
        <p className="font-medium">No cards here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Import a pack or add cards, then study for a few days. Retention, the forecast and your weakest tags show up here.</p>
        <Button variant="outline" className="mt-5 h-10" onClick={() => navigate("/")}>Go to decks</Button>
      </div>
    );

  const studied = s.cards.total - s.cards.new;
  const young = s.cards.review - s.cards.mature;
  // The heatmap starts a little before the first study day instead of showing months of nothing.
  const first = s.days.find((d) => d.reviews + (d.runs ?? 0) > 0)?.day;
  const activeWeeks = first ? Math.min(WEEKS, Math.max(16, Math.ceil((parseDay(s.today.day).getTime() - parseDay(first).getTime()) / (7 * 86400_000)) + 2)) : WEEKS;

  // A deck on a rated script scheduler (Leitner, a user's own): ratings, due dates and whatever its state
  // groups cards by, but no memory model.
  if (kind === "rated") return <RatedBody stats={s} deck={deck!} summary={s.schedulers[0]} />;

  // A deck on a drill has no memory model and nothing to forecast: its stats are what it measured.
  if (s.scheduler && s.scheduler !== "fsrs")
    return (
      <div className="flex flex-col gap-6">
        {s.practice.length ? s.practice.map((p) => <PracticePanel key={p.cardId} card={p} />) : <Empty>{t("Every run you do here is measured. Practice once and your results show up.")}</Empty>}
        <Panel title={t("Practice days")} aside={totalAnswers ? t("Runs per day") : undefined}>
          {totalAnswers ? <Heatmap days={s.days} weeks={activeWeeks} today={s.today.day} /> : <Empty>{t("Each practice day fills a square here.")}</Empty>}
          {totalMs > 0 && <TimeSpent days={s.days} today={s.today.day} />}
        </Panel>
        {totalAnswers > 0 && (
          <Panel title={t("When you practice")} aside={t("Last {weeks} weeks", { weeks: WEEKS })}>
            <StudyClock hours={s.hours} target={target} />
          </Panel>
        )}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <Overview stats={s} deck={deck} />

      {others.length > 0 && <Schedulers list={s.schedulers} />}

      {s.practice.length > 0 && (
        <div className="flex flex-col gap-6">
          {s.practice.slice(0, 4).map((p) => <PracticePanel key={p.cardId} card={p} />)}
        </div>
      )}

      {s.curve.length > 0 && (
        <Panel title={t("If you stopped today")} aside={t("Average predicted recall, no more reviews")}>
          <ForgettingCurve curve={s.curve} target={target} />
        </Panel>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Cards" aside={<span className="tabular">{s.cards.total} {others.length ? t("on FSRS") : t("total")}</span>}>
          <Donut
            center={s.cards.total}
            sub={t("cards")}
            parts={[
              { key: "new", label: t("New"), value: s.cards.new, color: "var(--new)" },
              { key: "learning", label: t("Learning"), value: s.cards.learning, color: "var(--learn)" },
              { key: "young", label: t("Young"), value: young, color: "var(--chart-3)" },
              { key: "mature", label: t("Mature"), value: s.cards.mature, color: "var(--review)" },
            ]}
            onPick={(i) => navigate(`/browse?q=${encodeURIComponent(scope + ["is:new", "is:learning", "is:review prop:stability<21", "is:review prop:stability>=21"][i])}`)}
          />
          <p className="mt-3 text-xs text-muted-foreground">{t("Mature cards hold for 21 days or more. Pick a row to browse those cards.")}</p>
        </Panel>
        <Panel title={t("Memory strength")} aside={t("Days until each card falls to 90% recall")}>
          {studied ? (
            <>
              <Histogram
                label={t("Studied cards by stability")}
                height={104}
                bars={s.stability.map((b, i) => {
                  const lo = i ? s.stability[i - 1].upTo! : 0;
                  const name = b.upTo == null ? `${lo}d+` : i === 0 ? "<1d" : `${lo}–${b.upTo}d`;
                  const localizedName = b.upTo == null ? `${lo}${t("d")}+` : i === 0 ? t("<1d") : `${lo}–${b.upTo}${t("d")}`;
                  const cardCount = b.cards === 0 ? t("0 cards") : b.cards === 1 ? t("1 card") : b.cards === 2 ? t("2 cards") : t("{n} cards", { n: b.cards });
                  return { key: name, value: b.cards, label: name.replace(/d\+?$/, (m) => (m === "d+" ? "+" : "")), color: "var(--review)", tip: `${cardCount} · ${t("stability")} ${localizedName}` };
                })}
                onPick={(i) => {
                  const lo = i ? s.stability[i - 1].upTo! : 0, hi = s.stability[i].upTo;
                  navigate(`/browse?q=${encodeURIComponent(`${scope}-is:new prop:stability>=${lo}${hi == null ? "" : ` prop:stability<${hi}`}`)}`);
                }}
              />
            </>
          ) : (
            <Empty>{t("Study a few cards and FSRS starts estimating how long each one stays in memory.")}</Empty>
          )}
        </Panel>
      </div>

      <Panel title={t("Review activity")} aside={totalAnswers ? t("Answers per day") : undefined}>
        {totalAnswers ? (
          <Heatmap days={s.days} weeks={activeWeeks} today={s.today.day} />
        ) : (
          <Empty>{t("No reviews in the last {weeks} weeks. Each study day fills a square here.", { weeks: WEEKS })}</Empty>
        )}
        {totalMs > 0 && <TimeSpent days={s.days} today={s.today.day} />}
      </Panel>

      <Panel title={t("Forecast")} aside={t("Next 30 days")}>
        <Forecast stats={s} deck={deck} />
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title={t("When you study")} aside={t("Last {weeks} weeks", { weeks: WEEKS })}>
          {totalAnswers ? <StudyClock hours={s.hours} target={target} /> : <Empty>{t("Your study hours show up after your first reviews.")}</Empty>}
        </Panel>
        <Panel title={t("Ratings")} aside={t("Last {weeks} weeks", { weeks: WEEKS })}>
          {totalReviews ? (
            <Donut
              center={totalReviews}
              sub={t("ratings")}
              parts={[
                { key: "again", label: t("Again"), value: s.ratings.again, color: "var(--again)" },
                { key: "hard", label: t("Hard"), value: s.ratings.hard, color: "var(--hard)" },
                { key: "good", label: t("Good"), value: s.ratings.good, color: "var(--good)" },
                { key: "easy", label: t("Easy"), value: s.ratings.easy, color: "var(--easy)" },
              ]}
            />
          ) : (
            <Empty>{t("Ratings appear after your first reviews.")}</Empty>
          )}
          {s.verdicts.correct + s.verdicts.partial + s.verdicts.incorrect + s.verdicts.ungraded > 0 && (
            <div className="mt-5 border-t pt-4">
              <div className="mb-3 text-xs font-medium">{t("Graded answers")}</div>
              <ShareBar
                label={t("Grading verdicts")}
                parts={[
                  { key: "correct", label: t("Correct"), value: s.verdicts.correct, color: "var(--good)" },
                  { key: "partial", label: t("Partial"), value: s.verdicts.partial, color: "var(--hard)" },
                  { key: "incorrect", label: t("Incorrect"), value: s.verdicts.incorrect, color: "var(--again)" },
                  { key: "ungraded", label: t("Ungraded"), value: s.verdicts.ungraded, color: "var(--muted-foreground)" },
                ]}
              />
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t("Weakest tags")} aside={t("Predicted recall now · the line is your {target}% target", { target: Math.round(target * 100) })}>
        <WeakTags tree={s.tagTree} target={target} />
      </Panel>
    </div>
  );
}

/** Hero: memory now, what's due, and the trend tiles. */
export function Overview({ stats: s, deck, ring }: { stats: Stats; deck?: string; ring?: number }) {
  const target = s.desiredRetention ?? 0.9;
  const totalReviews = s.days.reduce((a, d) => a + d.reviews, 0);
  const totalMs = s.days.reduce((a, d) => a + d.ms, 0);
  const drillsReady = s.schedulers.filter((x) => x.kind === "drill").reduce((a, x) => a + x.due, 0);
  const recent = s.weeks.slice(-12);
  // Weekly retention only says something once a few weeks have review answers.
  const rateWeeks = recent.filter((w) => w.reviewed > 0).length;
  // Volume and time read best per day over the last two weeks.
  const daily = (() => {
    const by = new Map(s.days.map((d) => [d.day, d]));
    const end = parseDay(s.today.day);
    return Array.from({ length: 14 }, (_, k) => {
      const d = new Date(end);
      d.setDate(d.getDate() - (13 - k));
      return by.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`) ?? { reviews: 0, ms: 0 };
    });
  })();
  const week = daily.slice(7).reduce((a, d) => ({ reviews: a.reviews + d.reviews, ms: a.ms + d.ms }), { reviews: 0, ms: 0 });
  const dueToday = s.forecast[0]?.due ?? 0;
  return (
    <section aria-label={t("Overview")} className="rounded-xl border bg-card/40">
      <div className="flex flex-col gap-6 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5 sm:gap-6">
          <RecallRing value={s.recall} target={target} size={ring} label={t("Recall now")} sub={s.recall == null ? undefined : t("target {target}%", { target: Math.round(target * 100) })} />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{t("Due today")}</div>
            <div className="tabular text-5xl leading-none tracking-tight" style={SERIF}>{dueToday}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {s.overdue ? <span className="text-again">{t("{n} overdue", { n: s.overdue })}</span> : dueToday ? t("all on time") : t("nothing waiting")}
              {s.today.reviews > 0 && <> · {t("{n} done today", { n: s.today.reviews })}</>}
              {drillsReady > 0 && <> · {drillsReady === 1 ? t("1 drill ready") : t("{n} drills ready", { n: drillsReady })}</>}
            </div>
            <Button size="sm" className="mt-3 h-9 gap-1.5" disabled={!dueToday} onClick={() => navigate(deck ? `/study?deck=${encodeURIComponent(deck)}` : "/study")}>
              <Play className="size-3.5" />{t("Review now")}
            </Button>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-5 lg:border-l lg:pl-6 rtl:lg:border-l-0 rtl:lg:border-r rtl:lg:pl-0 rtl:lg:pr-6">
          <Trend
            label={t("True retention")}
            value={pct(s.trueRetention.rate, 1)}
            tone={tone(s.trueRetention.rate)}
            sub={s.trueRetention.reviewed ? t("{passed}/{reviewed} passed · 30 days", { passed: s.trueRetention.passed, reviewed: s.trueRetention.reviewed }) : t("No review answers in 30 days")}
            spark={rateWeeks >= 3 ? recent.map((w) => w.rate) : undefined}
            note={rateWeeks >= 3 ? undefined : t("Trend after 3 weeks of reviews")}
            color={s.trueRetention.rate == null ? undefined : recallColor(s.trueRetention.rate, target)}
            domain={[0.5, 1]}
          />
          <Trend label={t("Reviews, last 7 days")} value={String(week.reviews)} sub={t("{n} in {weeks} weeks", { n: totalReviews, weeks: WEEKS })} bars={daily.map((d) => d.reviews)} color="var(--chart-2)" />
          <Trend label={t("Streak")} value={s.streak === 1 ? t("1 day") : t("{n} days", { n: s.streak })} sub={s.bestStreak ? t("Best {best} in {weeks} weeks", { best: s.bestStreak, weeks: WEEKS }) : t("Study today to start one")} streak={s.days} today={s.today.day} />
          <Trend label={t("Time, last 7 days")} value={fmtDuration(week.ms)} sub={totalMs ? t("{duration} in {weeks} weeks", { duration: fmtDuration(totalMs), weeks: WEEKS }) : t("Time per answer is recorded as you study")} bars={daily.map((d) => d.ms)} color="var(--chart-3)" />
        </div>
      </div>
    </section>
  );
}

/** A headline number with a 12-week sparkline, or, for the streak, the last 14 days as dots. */
export function Trend({ label, value, sub, tone: t, spark, bars, note, color, domain, streak, today }: { label: string; value: string; sub: string; tone?: keyof typeof TONE; spark?: (number | null)[]; bars?: number[]; note?: string; color?: string; domain?: [number, number]; streak?: Stats["days"]; today?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className={cn("tabular mt-0.5 text-2xl leading-tight tracking-tight", t ? TONE[t] : value === "—" && "text-muted-foreground/50")} style={SERIF}>{value}</div>
      <div className="mt-1.5 h-[30px]">
        {spark && <Sparkline values={spark} color={color} height={30} domain={domain} />}
        {bars && <MiniBars values={bars} color={color} />}
        {note && <div className="flex h-full items-center text-[11px] text-muted-foreground/70">{note}</div>}
        {streak && today && <StreakDots days={streak} today={today} />}
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</div>
    </div>
  );
}

/** Tiny daily bars, newest on the right; today is the brightest. */
function MiniBars({ values, color = "var(--chart-2)" }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-full items-end gap-[2px]" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-[2px]" style={{ height: `${v ? Math.max(12, (v / max) * 100) : 6}%`, background: v ? color : "var(--muted)", opacity: v ? (i === values.length - 1 ? 1 : 0.75) : 0.6 }} />
      ))}
    </div>
  );
}

function StreakDots({ days, today }: { days: Stats["days"]; today: string }) {
  const by = new Set(days.filter((d) => d.reviews + (d.runs ?? 0) > 0).map((d) => d.day));
  const end = parseDay(today);
  const cells = Array.from({ length: 14 }, (_, k) => {
    const d = new Date(end);
    d.setDate(d.getDate() - (13 - k));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, on: by.has(key), today: k === 13 };
  });
  return (
    <div className="flex h-full items-center gap-[3px]" aria-label={t("Study days, last two weeks")}>
      {cells.map((c) => (
        <span key={c.key} title={fmtDay(c.key)} className={cn("h-3.5 flex-1 rounded-[3px]", c.today && "ring-1 ring-foreground/60")} style={{ background: c.on ? "var(--highlight)" : "var(--muted)", opacity: c.on ? 0.9 : 0.6 }} />
      ))}
    </div>
  );
}

/** Cards on schedulers other than FSRS, one row each: they have no memory model, so they're counted apart. */
export function Schedulers({ list }: { list: StatsScheduler[] }) {
  const max = Math.max(1, ...list.map((x) => x.cards));
  const word = { fsrs: t("Memory model"), rated: t("Rated, no recall model"), drill: t("Measured, always ready") } as const;
  return (
    <Panel title={t("By scheduler")} aside={t("Recall, card states and memory strength count FSRS cards only")}>
      <ul className="flex flex-col divide-y">
        {list.map((x) => {
          const go = () => (x.decks.length === 1 ? navigate(`/stats?deck=${encodeURIComponent(x.decks[0])}`) : undefined);
          const status = x.kind === "drill" ? (x.due ? t("{n} ready", { n: x.due }) : t("none ready")) : t("{n} due", { n: x.due });
          const extra = x.kind === "drill" ? (x.answers ? (x.answers === 1 ? t("1 run") : t("{n} runs", { n: x.answers })) : "") : x.passRate != null ? `${pct(x.passRate)} ${t("pass")}` : "";
          const deckName = x.decks.length === 1 ? t(x.decks[0].split("::").pop()!) : t("{n} decks", { n: x.decks.length });
          return (
            <li key={x.id} className="py-3 first:pt-0 last:pb-0">
              <button type="button" onClick={go} disabled={x.decks.length !== 1} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 text-left rtl:text-right enabled:cursor-pointer enabled:hover:opacity-80 sm:grid-cols-[13rem_minmax(0,1fr)_auto]">
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <div className="truncate text-sm font-medium">{t(x.name)}</div>
                  <div className="truncate text-[11px] text-muted-foreground" title={x.decks.join(", ")}>
                    {word[x.kind]} · {deckName}
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (x.cards / max) * 100)}%`, background: x.kind === "fsrs" ? "var(--review)" : x.kind === "drill" ? "var(--chart-2)" : "var(--chart-3)" }} />
                </div>
                <div className="tabular grid grid-cols-[4.5rem_3.75rem_4.25rem] items-baseline text-right rtl:text-left text-xs whitespace-nowrap text-muted-foreground sm:grid-cols-[4.75rem_4.5rem_4.5rem]">
                  <span><span className="text-sm text-foreground">{x.cards}</span> {t(x.cards === 1 ? "card" : "cards")}</span>
                  <span>{status}</span>
                  <span>{extra}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** A deck on a rated script scheduler: what's due, how answers went, and what its state groups cards by. */
function RatedBody({ stats: s, deck, summary }: { stats: Stats; deck: string; summary: StatsScheduler }) {
  const totalReviews = s.days.reduce((a, d) => a + d.reviews, 0);
  const totalMs = s.days.reduce((a, d) => a + d.ms, 0);
  const target = s.desiredRetention ?? 0.9;
  const first = s.days.find((d) => d.reviews + (d.runs ?? 0) > 0)?.day;
  const activeWeeks = first ? Math.min(WEEKS, Math.max(16, Math.ceil((parseDay(s.today.day).getTime() - parseDay(first).getTime()) / (7 * 86400_000)) + 2)) : WEEKS;
  const dueToday = s.forecast[0]?.due ?? 0;
  const g = summary.groups;
  const groupTotal = g ? g.bins.reduce((a, b) => a + b.cards, 0) + g.other : 0;
  const ratedTotal = s.ratings.again + s.ratings.hard + s.ratings.good + s.ratings.easy;
  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("Overview")} className="rounded-xl border bg-card/40">
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 p-4 sm:grid-cols-4 sm:p-5">
          <div>
            <div className="text-xs text-muted-foreground">{t("Due today")}</div>
            <div className="tabular text-5xl leading-none tracking-tight" style={SERIF}>{dueToday}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">{s.overdue ? <span className="text-again">{t("{n} overdue", { n: s.overdue })}</span> : dueToday ? t("all on time") : t("nothing waiting")}</div>
            <Button size="sm" className="mt-3 h-9 gap-1.5" disabled={!dueToday && !summary.new} onClick={() => navigate(`/study?deck=${encodeURIComponent(deck)}`)}>
              <Play className="size-3.5" />{t("Practice")}
            </Button>
          </div>
          <Stat label={t("Pass rate")} value={pct(summary.passRate)} sub={summary.rated ? t("{passed}/{rated} not Again · {weeks} weeks", { passed: summary.passed, rated: summary.rated, weeks: WEEKS }) : t("No answers yet")} tone={tone(summary.passRate)} />
          <Stat label={t("Cards")} value={String(summary.cards)} sub={summary.new ? t("{n} not seen yet", { n: summary.new }) : t("all seen")} />
          <Stat label={t("Streak")} value={s.streak === 1 ? t("1 day") : t("{n} days", { n: s.streak })} sub={s.bestStreak ? t("Best {best} in {weeks} weeks", { best: s.bestStreak, weeks: WEEKS }) : t("Practice today to start one")} />
        </div>
        <p className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">{t("Scheduled by {name}. It decides when cards come back without predicting recall, so there's no forgetting curve here.", { name: summary.name })}</p>
      </section>

      {g && (
        <Panel title={t("Cards by {label}", { label: g.label.toLowerCase() })} aside={<span className="tabular">{t("{n} seen", { n: groupTotal })}</span>}>
          {groupTotal ? (
            <>
              <Histogram
                label={t("Seen cards by {label}", { label: g.label })}
                height={120}
                bars={g.bins.map((b) => {
                  const cardCount = b.cards === 0 ? t("0 cards") : b.cards === 1 ? t("1 card") : b.cards === 2 ? t("2 cards") : t("{n} cards", { n: b.cards });
                  return { key: b.key, value: b.cards, label: b.key, color: "var(--chart-3)", tip: `${g.label} ${b.key}: ${cardCount}` };
                })}
              />
              {g.other > 0 && <p className="mt-3 text-xs text-muted-foreground">{t("{n} cards without a {label} yet.", { n: g.other, label: g.label.toLowerCase() })}</p>}
            </>
          ) : (
            <Empty>{t("Answer a few cards and they spread across the {label}.", { label: g.label.toLowerCase() })}</Empty>
          )}
        </Panel>
      )}

      <Panel title={t("Forecast")} aside={t("Next 30 days")}>
        <Forecast stats={s} deck={deck} />
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title={t("Ratings")} aside={t("Last {weeks} weeks", { weeks: WEEKS })}>
          {ratedTotal ? (
            <Donut
              center={ratedTotal}
              sub={t("ratings")}
              parts={[
                { key: "again", label: t("Again"), value: s.ratings.again, color: "var(--again)" },
                { key: "hard", label: t("Hard"), value: s.ratings.hard, color: "var(--hard)" },
                { key: "good", label: t("Good"), value: s.ratings.good, color: "var(--good)" },
                { key: "easy", label: t("Easy"), value: s.ratings.easy, color: "var(--easy)" },
              ]}
            />
          ) : (
            <Empty>{t("Ratings appear after your first answers.")}</Empty>
          )}
        </Panel>
        <Panel title={t("When you practice")} aside={t("Last {weeks} weeks", { weeks: WEEKS })}>
          {totalReviews ? <StudyClock hours={s.hours} target={target} /> : <Empty>{t("Your practice hours show up after your first answers.")}</Empty>}
        </Panel>
      </div>

      <Panel title={t("Practice days")} aside={totalReviews ? t("Answers per day") : undefined}>
        {totalReviews ? <Heatmap days={s.days} weeks={activeWeeks} today={s.today.day} /> : <Empty>{t("Each practice day fills a square here.")}</Empty>}
        {totalMs > 0 && <TimeSpent days={s.days} today={s.today.day} />}
      </Panel>
    </div>
  );
}

function Stat({ label, value, sub, tone: t }: { label: string; value: string; sub: string; tone?: keyof typeof TONE }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className={cn("tabular mt-0.5 text-3xl leading-tight tracking-tight", t ? TONE[t] : value === "—" && "text-muted-foreground/50")} style={SERIF}>{value}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</div>
    </div>
  );
}

/** One measured card: pick a metric, see it over every session. */
export function PracticePanel({ card }: { card: PracticeCard }) {
  const [key, setKey] = useState(card.metrics[0]?.key);
  const m = card.metrics.find((x) => x.key === key) ?? card.metrics[0];
  if (!m) return null;
  const fmt = (v: number | null) => (v == null ? "—" : `${v.toFixed(m.digits)}${m.unit === "%" ? "%" : m.unit ? ` ${m.unit}` : ""}`);
  const shown = (v: number) => Number(v.toFixed(m.digits));
  const delta = m.first != null && m.last != null && m.points.length > 1 ? shown(m.last) - shown(m.first) : null;
  const up = delta != null && (m.better === "lower" ? delta < 0 : delta > 0);
  const deckTitle = t(card.deck.split("::").pop() ?? "");
  const sessionText = card.sessions === 1 ? t("1 session") : t("{n} sessions", { n: card.sessions });
  return (
    <Panel title={t(card.title || "ضبط المتشابهات")} aside={<span className="tabular">{sessionText} · {deckTitle}</span>}>
      {card.metrics.length > 1 && (
        <div className="-mt-1 mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label={t("Metric")}>
          {card.metrics.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={x.key === m.key}
              onClick={() => setKey(x.key)}
              className={cn("h-8 rounded-md border px-2.5 text-xs", x.key === m.key ? "border-foreground/25 bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50")}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{t("Last")}</div>
          <div className="tabular text-3xl leading-tight tracking-tight" style={SERIF}>{fmt(m.last)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("Best")}</div>
          <div className="tabular text-3xl leading-tight tracking-tight text-good" style={SERIF}>{fmt(m.best)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("Since the first")}</div>
          <div className={cn("tabular text-3xl leading-tight tracking-tight", delta == null ? "text-muted-foreground/50" : up ? "text-good" : delta === 0 ? "" : "text-again")} style={SERIF}>
            {delta == null ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toFixed(m.digits)}`}
          </div>
        </div>
      </div>
      <ProgressChart points={m.points} better={m.better} unit={m.unit} digits={m.digits} />
    </Panel>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="shrink-0 text-sm font-medium">{t(title)}</h2>
        {aside && <div className="min-w-0 text-xs text-muted-foreground">{typeof aside === "string" ? t(aside) : aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{typeof children === "string" ? t(children) : children}</div>;
}

const TONE = { good: "text-good", hard: "text-hard", again: "text-again" } as const;
export const tone = (v: number | null): keyof typeof TONE | undefined => (v == null ? undefined : v >= 0.85 ? "good" : v >= 0.7 ? "hard" : "again");

function TimeSpent({ days, today }: { days: Stats["days"]; today: string }) {
  const series = useMemo(() => {
    const by = new Map(days.map((d) => [d.day, d]));
    const end = parseDay(today);
    const out: { key: string; value: number; label: string; reviews: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const e = by.get(k);
      out.push({ key: k, value: Math.round(((e?.ms ?? 0) / 60000) * 10) / 10, label: i === 0 ? t("today") : fmtDay(k, { month: "short", day: "numeric" }), reviews: e?.reviews ?? 0 });
    }
    return out;
  }, [days, today, t]);
  const total = series.reduce((a, d) => a + d.value, 0);
  if (!total) return null;
  return (
    <div className="mt-6 border-t pt-5">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{t("Time studying")}</span>
        <span className="tabular">{t("{duration} in 30 days", { duration: fmtDuration(total * 60000) })}</span>
      </div>
      <BarChart
        data={series}
        height={120}
        color="var(--chart-2)"
        highlight={series.length - 1}
        ticks={[1, 8, 15, 22, 29]}
        format={(v) => t("{v}m", { v })}
        label={t("Minutes studied per day, last 30 days: {total} minutes total", { total: Math.round(total) })}
        valueLabel={(v, i) => [
          fmtDay(series[i].key),
          `${fmtDuration(v * 60000)} · ${
            series[i].reviews === 0
              ? t("0 reviews")
              : series[i].reviews === 1
              ? t("1 review")
              : series[i].reviews === 2
              ? t("2 reviews")
              : t("{n} reviews", { n: series[i].reviews })
          }`,
        ]}
      />
    </div>
  );
}

export function Forecast({ stats, deck, height = 170 }: { stats: Stats; deck?: string; height?: number }) {
  const f = stats.forecast;
  const total = f.reduce((a, d) => a + d.due, 0);
  const data = f.map((d, i) => ({ key: d.day, value: d.due, label: i === 0 ? t("today") : fmtDay(d.day, { month: "short", day: "numeric" }) }));
  // The deadline falls on a forecast day: place the marker at the matching fraction of that day.
  let mark: { at: number; label: string } | null = null;
  let after = false;
  if (stats.deadline) {
    const dl = new Date(stats.deadline);
    const first = parseDay(f[0].day);
    for (let i = 0; i < f.length; i++) {
      const start = parseDay(f[i].day);
      if (dl < start) break;
      const next = new Date(start);
      next.setDate(next.getDate() + 1);
      if (dl < next) {
        mark = { at: i + (dl.getTime() - start.getTime()) / (next.getTime() - start.getTime()), label: t("Exam") };
        break;
      }
    }
    after = !mark && dl > first;
  }
  const busiest = f.reduce((m, d, i) => (d.due > f[m].due ? i : m), 0);
  // With an exam inside the window nothing is due after it, so the chart stops a few days past it.
  let last = -1;
  f.forEach((d, i) => d.due > 0 && (last = i));
  const span = mark ? Math.min(f.length, Math.max(10, Math.ceil(mark.at) + 4, last + 2)) : f.length;
  const shown = data.slice(0, span);
  const ticks = span <= 14 ? Array.from({ length: span }, (_, i) => i).filter((i) => i === 0 || i % 2 === 0) : [0, 7, 14, 21, 28];
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm sm:max-w-md">
        <Mini label={t("Due today")} value={f[0].due} sub={stats.overdue ? `${stats.overdue} ${t("overdue")}` : undefined} />
        <Mini label={t("Next 7 days")} value={f.slice(0, 7).reduce((a, d) => a + d.due, 0)} />
        <Mini label={t("Next 30 days")} value={total} />
      </div>
      {total ? (
        <BarChart
          data={shown}
          height={height}
          color="var(--review)"
          highlight={0}
          ticks={ticks}
          mark={mark}
          label={t("Cards due per day for the next 30 days: {total} total, busiest {busiest} with {due}", { total, busiest: fmtDay(f[busiest].day), due: f[busiest].due })}
          valueLabel={(v, i) => {
            const dueText = v === 0 ? t("No cards due") : v === 1 ? t("1 card due") : v === 2 ? t("2 cards due") : t("{n} cards due", { n: v });
            const overdueText = i === 0 && stats.overdue ? ` (${stats.overdue === 1 ? t("1 overdue") : stats.overdue === 2 ? t("2 overdue") : t("{n} overdue", { n: stats.overdue })})` : "";
            return [
              i === 0 ? `${t("Today")} · ${fmtDay(f[i].day)}` : fmtDay(f[i].day),
              `${dueText}${overdueText}`,
            ];
          }}
        />
      ) : (
        <Empty>{t("Nothing is scheduled in the next 30 days. New cards enter the forecast once you study them.")}</Empty>
      )}
      {total > 0 && (stats.overdue > 0 || span < f.length) && (
        <p className="mt-3 text-xs text-muted-foreground">
          {stats.overdue > 0 && <><span className="mr-1.5 rtl:mr-0 rtl:ml-1.5 inline-block size-2 rounded-full bg-highlight" />{stats.overdue === 1 ? t("Today includes 1 overdue card.") : t("Today includes {n} overdue cards.", { n: stats.overdue })} </>}
          {span < f.length && t("Showing {span} days; nothing else is due in the next 30.", { span })}
        </p>
      )}
      {stats.deadline && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-balance text-muted-foreground">
          <CalendarClock className="mt-px size-3.5 shrink-0 text-highlight" />
          {t("Exam")} {new Date(stats.deadline).toLocaleString(locale() === "ar" ? "ar-EG" : undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          {new Date(stats.deadline) < new Date() ? ` (${t("passed")})` : after ? ` (${t("after this window")})` : ""} · {t("last reviews at least {margin}h before", { margin: stats.deadlineMargin })}
        </p>
      )}
      {!deck && <p className="mt-3 text-xs text-muted-foreground">{t("Pick a deck to see its exam deadline on the forecast.")}</p>}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <div className="tabular text-2xl leading-tight" style={SERIF}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-again">{sub}</div>}
    </div>
  );
}

export function WeakTags({ tree, target, limit = 10 }: { tree: Stats["tagTree"]; target: number; limit?: number }) {
  const { t } = useLocale();
  const roots = useMemo(() => tree.filter((t) => t.depth === 0).sort((a, b) => b.cards - a.cards), [tree]);
  const [group, setGroup] = useState<string>("__leaf");
  const [all, setAll] = useState(false);

  if (!tree.length) return <Empty>{t("No tags in this scope. Tag items (for example exam::core) to see which topics are weakest.")}</Empty>;

  const inGroup = group === "__leaf" ? tree.filter((t) => t.direct) : tree.filter((t) => t.tag.startsWith(group + "::"));
  const seen = inGroup.filter((t) => t.seen > 0).sort((a, b) => a.recall! - b.recall! || b.seen - a.seen);
  const unseen = inGroup.filter((t) => t.seen === 0);
  const shown = all ? seen : seen.slice(0, limit);
  // The meters share one scale that starts a little under the weakest tag, so 89% and 95% look different.
  const lo = Math.max(0, Math.min(0.6, Math.floor(((seen[0]?.recall ?? 0.6) - 0.05) * 20) / 20));
  const head = group === "__leaf" ? null : tree.find((t) => t.tag === group);

  return (
    <div>
      <div className="-mx-1 mb-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Tag group")}>
        <Chip active={group === "__leaf"} onClick={() => setGroup("__leaf")}>{t("Every tag")}</Chip>
        {roots.filter((r) => tree.some((t) => t.tag.startsWith(r.tag + "::"))).map((r) => (
          <Chip key={r.tag} active={group === r.tag} onClick={() => setGroup(r.tag)}>{r.tag}</Chip>
        ))}
      </div>
      {head && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
          <span className="font-mono text-[13px]">{head.tag}</span>
          <span className="text-xs text-muted-foreground">{t("all {cards} cards · {seen} studied", { cards: head.cards, seen: head.seen })}</span>
          <span className="tabular ml-auto font-medium">{pct(head.recall)}</span>
        </div>
      )}
      {seen.length === 0 ? (
        <Empty>{t("None of these tags has a studied card yet. Recall per tag appears after your first reviews.")}</Empty>
      ) : (
        <ul className="-mx-2">
          {shown.map((t) => {
            const label = group === "__leaf" ? t.tag : t.tag.slice(group.length + 2);
            const cut = label.lastIndexOf("::");
            return (
              <li key={t.tag}>
                <button
                  onClick={() => navigate(`/browse?q=${encodeURIComponent(`tag:${t.tag}`)}`)}
                  className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1.5 rounded-md px-2 py-2 text-left rtl:text-right hover:bg-accent/40 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_3.5rem_1rem]"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 truncate font-mono text-[13px]">
                      {cut > 0 && <span className="text-muted-foreground">{label.slice(0, cut + 2)}</span>}
                      {label.slice(cut > 0 ? cut + 2 : 0)}
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">{t.seen === t.cards ? t.cards : `${t.seen}/${t.cards}`}</span>
                  </span>
                  <span className="tabular text-right rtl:text-left text-sm font-medium sm:order-3" style={{ color: recallColor(t.recall!, target) }}>{pct(t.recall)}</span>
                  <span className="col-span-2 sm:order-2 sm:col-span-1"><TargetMeter value={t.recall!} target={target} lo={lo} /></span>
                  <ChevronRight className="hidden size-4 text-muted-foreground sm:order-4 sm:block rtl-flip" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {seen.length > limit && (
          <button className="h-10 rounded-md border px-3 text-foreground hover:bg-accent/50" onClick={() => setAll(!all)}>{all ? t("Show fewer") : t("Show all {n}", { n: seen.length })}</button>
        )}
        {unseen.length > 0 && <span>{unseen.length === 1 ? t("1 tag not studied yet") : t("{n} tags not studied yet", { n: unseen.length })}</span>}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn("h-10 rounded-full border px-4 text-[13px] text-muted-foreground transition-colors hover:text-foreground", active && "border-foreground/30 bg-accent text-foreground")}
    >
      {children}
    </button>
  );
}

/** A recall meter on a shared [lo, 1] scale with the target as a tick; under-target values turn warm. */
function TargetMeter({ value, target, lo }: { value: number; target: number; lo: number }) {
  const at = (v: number) => `${Math.max(0, Math.min(1, (v - lo) / (1 - lo))) * 100}%`;
  const color = recallColor(value, target);
  return (
    <div className="relative h-2 w-full rounded-full bg-muted">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: at(value), background: color }} />
      <div className="absolute -inset-y-1 w-px bg-foreground/60" style={{ left: at(target) }} />
    </div>
  );
}
