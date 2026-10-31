// The live Stats panels on the website: the app's own components, fed by snapshots of a demo
// collection (site/tools/stats-snapshot.mjs). Each `[data-live]` element on the page gets one panel.
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ForgettingCurve, Histogram, StudyClock, useWidth } from "@/components/stats-viz";
import { Forecast, Overview, PracticePanel, Schedulers, WeakTags } from "@/pages/stats";
import type { Stats } from "@/lib/api";
import { t, setLocale, locale, type LocaleId } from "@/lib/i18n";
import demoSnap from "../src/assets/stats-data/demo.json";
import drillSnap from "../src/assets/stats-data/drill.json";
import "./embed.css";

const initLang = (typeof document !== "undefined" && (document.documentElement.getAttribute("lang") || "ar")) as LocaleId;
if (initLang === "ar" || initLang === "en") {
  setLocale(initLang);
}

const demo = demoSnap.stats as unknown as Stats;
const drill = drillSnap.stats as unknown as Stats;
const target = demo.desiredRetention ?? 0.9;

/** The room a panel has: its width, and the height every No. 5 panel is drawn to so tabs don't jump. */
type Room = { w: number; h: number; phone: boolean };

function Fit({ children }: { children: (r: Room) => ReactNode }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const phone = w > 0 && w < 560;
  const h = phone ? 420 : 420;
  return <div ref={ref}>{w > 0 && children({ w, h, phone })}</div>;
}

function Memory({ h }: Room) {
  const s = demo;
  return (
    <Histogram
      label={t("Studied cards by stability")}
      height={h - 92}
      bars={s.stability.map((b, i) => {
        const lo = i ? s.stability[i - 1].upTo! : 0;
        const name = b.upTo == null ? `${lo}d+` : i === 0 ? "<1d" : `${lo}–${b.upTo}d`;
        const localizedName = b.upTo == null ? `${lo}${t("d")}+` : i === 0 ? t("<1d") : `${lo}–${b.upTo}${t("d")}`;
        const cardCount = b.cards === 0 ? t("0 cards") : b.cards === 1 ? t("1 card") : b.cards === 2 ? t("2 cards") : t("{n} cards", { n: b.cards });
        return {
          key: name,
          value: b.cards,
          label: name.replace(/d\+?$/, (m) => (m === "d+" ? "+" : "")),
          color: "var(--review)",
          tip: `${cardCount} · ${t("stability")} ${localizedName}`,
        };
      })}
    />
  );
}

const PANELS: Record<string, () => ReactNode> = {
  overview: () => <Fit>{({ phone }) => <Overview stats={demo} deck={t("القرآن الكريم")} ring={phone ? 148 : 204} />}</Fit>,
  curve: () => <Fit>{({ h, phone }) => <ForgettingCurve curve={demo.curve} target={target} height={h - (phone ? 90 : 76)} />}</Fit>,
  memory: () => <Fit>{(r) => <Memory {...r} />}</Fit>,
  clock: () => <Fit>{({ w, h, phone }) => <StudyClock hours={demo.hours} target={target} size={phone ? Math.min(w - 16, 320) : Math.min(h - 40, 380)} />}</Fit>,
  tags: () => <Fit>{({ phone }) => <WeakTags tree={demo.tagTree} target={target} limit={phone ? 5 : 7} />}</Fit>,
  forecast: () => <Fit>{({ h, phone }) => <Forecast stats={demo} deck={t("القرآن الكريم")} height={h - (phone ? 130 : 110)} />}</Fit>,
  drill: () => <PracticePanel card={drill.practice[0]} />,
  schedulers: () => <Schedulers list={drill.schedulers} />,
};

const roots = new Map<HTMLElement, ReturnType<typeof createRoot>>();

function renderAll() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-live]")) {
    const panel = PANELS[el.dataset.live!];
    if (!panel) continue;
    el.classList.add("lv", "dark");
    let root = roots.get(el);
    if (!root) {
      el.replaceChildren();
      root = createRoot(el);
      roots.set(el, root);
    }
    root.render(<StrictMode>{panel()}</StrictMode>);
    el.dataset.ready = "";
  }
}

renderAll();

if (typeof window !== "undefined") {
  window.addEventListener("wikae-lang-change", (e: any) => {
    const l = (e.detail?.lang || document.documentElement.getAttribute("lang") || "ar") as LocaleId;
    if (l === "ar" || l === "en") {
      setLocale(l);
      renderAll();
    }
  });
  window.addEventListener("wikae:locale", () => {
    renderAll();
  });
}
