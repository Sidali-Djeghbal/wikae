// Edits an item's fields from its type's schema. Common JSON shapes get real forms;
// anything else falls back to a JSON editor, so every type stays editable.
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Brackets, Check, EyeOff, MoreVertical, Plus, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/code-editor";
import { AnyCodeEditor, LiveMarkdown } from "@/components/live-editor";
import type { FieldSpec } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MediaPasteProvider } from "@/components/media-paste";
import { MediaTextInput, useMediaInput } from "@/components/media-input";
import { OcclusionEditor, type OcclusionBox } from "@/components/occlusion-editor";
import { t } from "@/lib/i18n";
import { SURAH_NAMES, getSurahName } from "@/lib/quran-meta";

type Fields = Record<string, unknown>;

/** A code field's language: fixed (`"python"`), or read from another field (`"field:language"`). */
function codeLanguage(spec: FieldSpec, fields: Fields, specs: FieldSpec[]): string {
  const l = spec.language ?? "js";
  if (!l.startsWith("field:")) return l;
  const name = l.slice(6);
  const v = fields[name] ?? specs.find((f) => f.name === name)?.default;
  return typeof v === "string" ? v : "";
}

export function FieldEditor({ fields: specs, value, onChange, onMediaPendingChange }: { fields: FieldSpec[]; value: Fields; onChange(v: Fields): void; onMediaPendingChange?(pending: boolean): void }) {
  const latest = useRef(value);
  latest.current = value;
  const set = (name: string, v: unknown) => {
    const next = { ...latest.current };
    if (v === undefined || v === "") delete next[name];
    else next[name] = v;
    latest.current = next;
    onChange(next);
  };
  const generator = typeof value.generator === "string";
  // An occlusion editor owns its sibling `image` and `mode` fields: they're edited on the image itself.
  const occlusion = specs.find((f) => f.editor === "occlusion");
  const owned = new Set(occlusion ? ["image", "mode"].filter((n) => specs.some((f) => f.name === n)) : []);
  const patch = (p: Record<string, unknown>) => {
    const next = { ...latest.current };
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined || v === "") delete next[k];
      else next[k] = v;
    }
    latest.current = next;
    onChange(next);
  };
  return (
    <MediaPasteProvider onPendingChange={onMediaPendingChange}><div className="flex flex-col gap-5">
      {specs.filter((f) => !owned.has(f.name)).map((f) =>
        f.editor === "occlusion" ? (
          <div key={f.name} className="flex flex-col gap-1.5">
            <OcclusionEditor
              image={String(value.image ?? "")}
              boxes={(Array.isArray(value[f.name]) ? value[f.name] : []) as OcclusionBox[]}
              mode={String(value.mode ?? "")}
              onChange={(p) => patch({ ...(p.image !== undefined ? { image: p.image } : {}), ...(p.boxes !== undefined ? { [f.name]: p.boxes } : {}), ...(p.mode !== undefined ? { mode: p.mode === "hide-all" ? undefined : p.mode } : {}) })}
              onPendingChange={onMediaPendingChange}
            />
          </div>
        ) : (
          <FieldRow key={f.name} spec={f}>
            <FieldInput spec={f} value={value[f.name]} language={f.kind === "code" ? codeLanguage(f, value, specs) : undefined} onChange={(v) => set(f.name, v)} />
          </FieldRow>
        ),
      )}
      <FieldRow spec={{ name: "generator", kind: "code", label: t("Generator"), description: t("Optional. The body of a function that receives rng and returns field overrides, so each review shows a new variant.") }}>
        {generator || value.generator !== undefined ? (
          <div className="flex flex-col gap-2">
            <CodeEditor lang="js" value={String(value.generator ?? "")} onChange={(v) => set("generator", v)} minHeight={140} />
            <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => set("generator", undefined)}>{t("Remove generator")}</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="self-start gap-1.5" onClick={() => set("generator", "// rng.int(a, b), rng.pick([...]), rng.float(a, b, digits)\nreturn {};\n")}>
            <Plus className="size-4" /> {t("Add generator")}
          </Button>
        )}
      </FieldRow>
    </div></MediaPasteProvider>
  );
}

function FieldRow({ spec, children }: { spec: FieldSpec; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-sm font-medium">{t(spec.label ?? spec.name)}</label>
        {spec.required && <span className="text-xs text-muted-foreground">{t("required")}</span>}
        {spec.private && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" title={t("Hidden from the card until it's graded")}>
            <EyeOff className="size-3" /> {t("hidden until answered")}
          </span>
        )}
      </div>
      {spec.description && <p className="-mt-1 text-xs text-muted-foreground">{t(spec.description)}</p>}
      {children}
    </div>
  );
}

function FieldInput({ spec, value, onChange, language }: { spec: FieldSpec; value: unknown; onChange(v: unknown): void; language?: string }) {
  if (spec.editor === "choices") return <ChoicesEditor value={(value as any[]) ?? []} onChange={onChange} />;
  if (spec.editor === "pairs") return <PairsEditor value={(value as any[]) ?? []} onChange={onChange} />;
  if (spec.editor === "parts") return <PartsEditor value={value as any[] | undefined} onChange={onChange} />;
  if (spec.editor === "mutashabihat" || (spec.kind === "json" && spec.name === "siblings")) {
    return <MutashabihatEditor value={value} onChange={onChange} />;
  }
  switch (spec.kind) {
    case "markdown":
      return <LiveMarkdown value={String(value ?? "")} onChange={(v) => onChange(v)} placeholder={spec.default !== undefined ? String(spec.default) : "Markdown, $math$ and ```code``` render as you type"} />;
    case "code":
      return <AnyCodeEditor language={language ?? "js"} value={String(value ?? "")} onChange={onChange} minLines={4} />;
    case "html":
      return <AutoTextarea value={String(value ?? "")} onChange={(v) => onChange(v)} mono placeholder="HTML" mediaFormat="html" />;
    case "text":
      return <MediaTextInput value={String(value ?? "")} placeholder={spec.default !== undefined ? `default: ${spec.default}` : ""} onChange={onChange} />;
    case "number":
      return <NumberInput value={value as number | undefined} placeholder={spec.default !== undefined ? `default: ${spec.default}` : ""} onChange={onChange} />;
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch checked={value === undefined ? !!spec.default : !!value} onCheckedChange={(v) => onChange(v)} />
          {value === undefined && <span className="text-xs text-muted-foreground">{t("default")}</span>}
        </div>
      );
    case "list":
      return <ListEditor value={(value as string[]) ?? []} onChange={(v) => onChange(v.length ? v : undefined)} />;
    default:
      return <JsonInput value={value} onChange={onChange} />;
  }
}

export function AutoTextarea({ value, onChange, mono, placeholder, className, mediaFormat }: { value: string; onChange(v: string): void; mono?: boolean; placeholder?: string; className?: string; mediaFormat?: "html" }) {
  const media = useMediaInput(value, onChange, mediaFormat);
  return (
    <Textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => media.change(e.target.value)}
      onPaste={media.paste}
      className={cn("field-sizing-content min-h-16 resize-y", mono && "font-mono text-[13px]", className)}
    />
  );
}

function NumberInput({ value, onChange, placeholder, className }: { value: number | undefined; onChange(v: number | undefined): void; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(value === undefined ? "" : String(value));
  }, [value]);
  return (
    <Input
      className={cn("font-mono", className)}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.trim();
        if (t === "") onChange(undefined);
        else if (Number.isFinite(Number(t))) onChange(Number(t));
      }}
    />
  );
}

function JsonInput({ value, onChange }: { value: unknown; onChange(v: unknown): void }) {
  const [text, setText] = useState(() => (value === undefined ? "" : JSON.stringify(value, null, 2)));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <CodeEditor
        lang="json"
        value={text}
        lineNumbers={false}
        minHeight={60}
        onChange={(t) => {
          setText(t);
          if (!t.trim()) {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(t));
            setError(null);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

function Rows<T>({ items, onChange, render, empty, add }: { items: T[]; onChange(v: T[]): void; render(item: T, set: (v: T) => void, i: number): React.ReactNode; empty: T; add: string }) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="group flex items-start gap-1.5">
          <div className="min-w-0 flex-1">{render(it, (v) => onChange(items.map((x, k) => (k === i ? v : x))), i)}</div>
          {/* Desktop: inline icons. Phone: one menu button, so rows stay one line tall. */}
          <div className="hidden shrink-0 gap-0.5 pt-1 opacity-40 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:flex">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("Move up")}><ArrowUp className="size-3.5" /></Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t("Move down")}><ArrowDown className="size-3.5" /></Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(i)} aria-label={t("Remove")}><Trash2 className="size-3.5" /></Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground sm:hidden" aria-label={t("Row actions")}><MoreVertical className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp />{t("Move up")}</DropdownMenuItem>
              <DropdownMenuItem disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown />{t("Move down")}</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => remove(i)}><Trash2 />{t("Remove")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-10 self-start gap-1.5 sm:h-8" onClick={() => onChange([...items, structuredClone(empty)])}>
        <Plus className="size-4" /> {t(add)}
      </Button>
    </div>
  );
}

function ListEditor({ value, onChange }: { value: string[]; onChange(v: string[]): void }) {
  return <Rows items={value} onChange={onChange} empty="" add={t("Add")} render={(v, set, i) => <Input value={v} onChange={(e) => set(e.target.value)} placeholder={`#${i + 1}`} />} />;
}

function ChoicesEditor({ value, onChange }: { value: { text: string; correct?: boolean; why?: string }[]; onChange(v: unknown): void }) {
  return (
    <Rows
      items={value}
      onChange={onChange}
      empty={{ text: "" }}
      add={t("Add option")}
      render={(o, set) => (
        <div className={cn("flex flex-col gap-1.5 rounded-md border p-2", o.correct && "border-good/50 bg-good/5")}>
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => set({ ...o, correct: !o.correct || undefined })}
              className={cn("mt-1.5 flex size-5 shrink-0 items-center justify-center rounded border", o.correct ? "border-good bg-good text-background" : "border-input")}
              title={o.correct ? t("Correct") : t("Mark as correct")}
            >
              {o.correct && <Check className="size-3.5" />}
            </button>
            <LiveMarkdown className="min-w-0 flex-1 border-0 shadow-none focus-within:shadow-none" minLines={1} value={o.text} onChange={(t) => set({ ...o, text: t })} placeholder={t("Option text (markdown and $math$)")} />
          </div>
          <Input className="h-8 border-dashed text-sm" value={o.why ?? ""} onChange={(e) => set({ ...o, why: e.target.value || undefined })} placeholder={t("Why (shown after answering, optional)")} />
        </div>
      )}
    />
  );
}

function PairsEditor({ value, onChange }: { value: [string, string][]; onChange(v: unknown): void }) {
  return (
    <Rows
      items={value}
      onChange={onChange}
      empty={["", ""] as [string, string]}
      add={t("Add pair")}
      render={(p, set) => (
        <div className="grid gap-1.5 rounded-md border p-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:border-0 sm:p-0">
          <LiveMarkdown minLines={1} value={p[0]} onChange={(v) => set([v, p[1]])} placeholder={t("Left")} />
          <LiveMarkdown minLines={1} value={p[1]} onChange={(v) => set([p[0], v])} placeholder={t("Right")} />
        </div>
      )}
    />
  );
}

function PartsEditor({ value, onChange }: { value: { label: string; answer: number; unit?: string; tolerance?: number }[] | undefined; onChange(v: unknown): void }) {
  if (!value?.length)
    return (
      <Button variant="outline" size="sm" className="self-start gap-1.5" onClick={() => onChange([{ label: "", answer: 0 }])}>
        <Plus className="size-4" /> {t("Make it multi-part")}
      </Button>
    );
  return (
    <Rows
      items={value}
      onChange={(v) => onChange(v.length ? v : undefined)}
      empty={{ label: "", answer: 0 }}
      add={t("Add part")}
      render={(p, set) => (
        <div className="grid grid-cols-3 gap-1.5 rounded-md border p-1.5 sm:grid-cols-[1fr_7rem_5rem_5rem] sm:gap-2 sm:border-0 sm:p-0">
          <Input className="col-span-3 sm:col-span-1" value={p.label} onChange={(e) => set({ ...p, label: e.target.value })} placeholder={t("Label, e.g. Area")} />
          <NumberInput value={p.answer} onChange={(v) => set({ ...p, answer: v ?? 0 })} placeholder={t("Answer")} />
          <Input value={p.unit ?? ""} onChange={(e) => set({ ...p, unit: e.target.value || undefined })} placeholder={t("Unit")} />
          <NumberInput value={p.tolerance} onChange={(v) => set({ ...p, tolerance: v })} placeholder={t("Tolerance")} />
        </div>
      )}
    />
  );
}

interface MutashabihDraft {
  surahNumber: number;
  ayahNumber: number;
  text: string;
}

function MutashabihRow({
  item,
  onChange,
}: {
  item: MutashabihDraft;
  onChange(v: MutashabihDraft): void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const bStart = item.text.indexOf("[");
  const bEnd = item.text.indexOf("]", bStart + 1);
  const pivotal = bStart !== -1 && bEnd !== -1 ? item.text.slice(bStart + 1, bEnd).trim() : null;

  const handleWrap = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const current = item.text ?? "";
    if (start !== end) {
      const selected = current.slice(start, end);
      const next = current.slice(0, start) + `[${selected}]` + current.slice(end);
      onChange({ ...item, text: next });
    } else {
      const next = current.slice(0, start) + `[ ]` + current.slice(start);
      onChange({ ...item, text: next });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card/60 p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("Surah")}:</span>
            <Select
              value={String(item.surahNumber || 2)}
              onValueChange={(v) => onChange({ ...item, surahNumber: Number(v) })}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {SURAH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {idx + 1}. {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("Ayah")}:</span>
            <Input
              type="number"
              min={1}
              max={286}
              className="h-8 w-20 font-mono text-xs"
              value={item.ayahNumber || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({ ...item, ayahNumber: isNaN(val) ? 1 : val });
              }}
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs font-medium"
          onClick={handleWrap}
          title={t("Wrap selected word or phrase in brackets [ ]")}
        >
          <Brackets className="size-3.5" />
          <span>{t("[ اللفظ المفصلي ]")}</span>
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          ref={textareaRef}
          rows={3}
          dir="rtl"
          className="resize-y font-serif text-base leading-relaxed tracking-wide"
          placeholder={t("اكتب نص الآية وضع اللفظ المفصلي المختلف بين قوسين [هكذا]...")}
          value={item.text}
          onChange={(e) => onChange({ ...item, text: e.target.value })}
        />

        <div className="flex items-center justify-between min-h-5 px-0.5">
          {pivotal ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" />
              <span>{t("Pivotal phrase:")}</span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-serif font-bold text-foreground">
                {pivotal}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-3.5" />
              <span>{t("Put the distinguishing word/phrase in brackets [like this]")}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MutashabihatEditor({ value, onChange }: { value: unknown; onChange(v: unknown): void }) {
  const parseRawItems = (raw: unknown): MutashabihDraft[] => {
    if (!Array.isArray(raw) || raw.length === 0) {
      return [
        { surahNumber: 2, ayahNumber: 126, text: "" },
        { surahNumber: 14, ayahNumber: 35, text: "" },
      ];
    }
    return raw.map((entry, idx) => {
      let surahNumber = idx === 0 ? 2 : 14;
      let ayahNumber = 1;
      let text = "";

      if (typeof entry === "string") {
        const rawStr = entry.trim();
        const bracketHeader = rawStr.match(/^\[([^\]:]+)[:\s]+(\d+)\]\s*(.*)$/);
        if (bracketHeader) {
          const num = findSurahIdx(bracketHeader[1]);
          if (num) surahNumber = num;
          ayahNumber = parseInt(bracketHeader[2], 10) || 1;
          text = bracketHeader[3];
        } else {
          const pipeMatch = rawStr.match(/^([^|:]+)[:\s]+(\d+)\s*\|\s*(.*)$/);
          if (pipeMatch) {
            const num = findSurahIdx(pipeMatch[1]);
            if (num) surahNumber = num;
            ayahNumber = parseInt(pipeMatch[2], 10) || 1;
            text = pipeMatch[3];
          } else {
            text = rawStr;
          }
        }
      } else if (typeof entry === "object" && entry !== null) {
        const obj = entry as Record<string, unknown>;
        if (obj.surahNumber) surahNumber = Number(obj.surahNumber);
        else if (obj.surah || obj.surahNameAr) {
          const s = findSurahIdx(String(obj.surah || obj.surahNameAr));
          if (s) surahNumber = s;
        }
        if (obj.ayahNumber) ayahNumber = Number(obj.ayahNumber);
        else if (obj.ayah) ayahNumber = Number(obj.ayah);

        if (obj.text) {
          text = String(obj.text);
        } else if (obj.pivotalUthmani) {
          text = [obj.prefixUthmani, `[${obj.pivotalUthmani}]`, obj.suffixUthmani].filter(Boolean).join(" ");
        } else if (obj.textUthmani) {
          text = String(obj.textUthmani);
        }
      }
      return { surahNumber, ayahNumber, text };
    });
  };

  const toOutput = (drafts: MutashabihDraft[]) => {
    return drafts.map((d) => {
      const surahNameAr = getSurahName(d.surahNumber);
      const id = `${d.surahNumber}_${d.ayahNumber}`;
      const text = d.text || "";
      const bStart = text.indexOf("[");
      const bEnd = text.indexOf("]", bStart + 1);

      if (bStart !== -1 && bEnd !== -1) {
        const prefixUthmani = text.slice(0, bStart).trim();
        const pivotalUthmani = text.slice(bStart + 1, bEnd).trim();
        const suffixUthmani = text.slice(bEnd + 1).trim();
        const textUthmani = [prefixUthmani, pivotalUthmani, suffixUthmani].filter(Boolean).join(" ");
        return {
          id,
          surahNumber: d.surahNumber,
          surahNameAr,
          ayahNumber: d.ayahNumber,
          prefixUthmani,
          pivotalUthmani,
          suffixUthmani,
          textUthmani,
          text,
        };
      }

      return {
        id,
        surahNumber: d.surahNumber,
        surahNameAr,
        ayahNumber: d.ayahNumber,
        text,
      };
    });
  };

  const drafts = parseRawItems(value);

  const handleUpdate = (updated: MutashabihDraft[]) => {
    onChange(toOutput(updated));
  };

  return (
    <Rows
      items={drafts}
      onChange={handleUpdate}
      empty={{ surahNumber: 2, ayahNumber: 1, text: "" }}
      add={t("Add sibling verse")}
      render={(d, set) => (
        <MutashabihRow item={d} onChange={set} />
      )}
    />
  );
}

function findSurahIdx(str: string): number | null {
  const norm = (s: string) =>
    s
      .replace(/^سورة\s+/, "")
      .replace(/[أإآٱٲٳ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, "")
      .trim();
  const rawNum = parseInt(str.trim(), 10);
  if (!isNaN(rawNum) && rawNum >= 1 && rawNum <= 114) return rawNum;
  const n = norm(str);
  const idx = SURAH_NAMES.findIndex((name) => norm(name) === n);
  if (idx !== -1) return idx + 1;
  return null;
}
