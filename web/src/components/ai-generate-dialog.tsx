import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeckInput } from "@/components/item-editor";
import { api, type ItemGenerationProposal, type TypeSummary } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AiGenerateDialog({
  open,
  onOpenChange,
  decks,
  types,
  defaultDeck,
  defaultType,
  onGenerated,
}: {
  open: boolean;
  onOpenChange(o: boolean): void;
  decks: string[];
  types: TypeSummary[];
  defaultDeck?: string;
  defaultType?: string;
  onGenerated?(ids: string[]): void;
}) {
  const [type, setType] = useState(() => defaultType || (types.some((t) => t.id === "quran-mutashabihat") ? "quran-mutashabihat" : types[0]?.id || "basic"));
  const [deck, setDeck] = useState(() => defaultDeck || decks[0] || "General");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ItemGenerationProposal[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isMutashabihat = type === "quran-mutashabihat";

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setItems([]);
    setSelected(new Set());
    try {
      const res = await api.aiGenerateItems(type, prompt.trim(), { count });
      setItems(res.items);
      setSelected(new Set(res.items.map((_, i) => i)));
      toast.success(t("Generated cards") + ` (${res.items.length})`);
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!items.length || saving || !deck.trim()) return;
    const toSave = items.filter((_, i) => selected.has(i));
    if (!toSave.length) return;
    setSaving(true);
    setError(null);
    const savedIds: string[] = [];
    try {
      const slug = deck.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
      for (let i = 0; i < toSave.length; i++) {
        const it = toSave[i];
        const id = `${slug}.${Date.now().toString(36)}${i > 0 ? `-${i + 1}` : ""}`;
        await api.saveItem(id, {
          type,
          deck: deck.trim(),
          fields: it.fields,
          tags: ["ai-generated"],
        });
        savedIds.push(id);
      }
      toast.success(t("Cards added successfully") + ` (${savedIds.length})`);
      onOpenChange(false);
      setItems([]);
      setPrompt("");
      onGenerated?.(savedIds);
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <DialogTitle>{t("AI Card Generation")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("Describe what you want to learn, and AI will generate structured cards matching your chosen card type.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Card Type & Target Deck */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("Card Type")}</label>
              <Select value={type} onValueChange={(v) => { setType(v); setItems([]); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id}>
                      {tp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("Deck")}</label>
              <DeckInput value={deck} decks={decks} onChange={setDeck} />
            </div>
          </div>

          {/* Prompt & Count */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("Topic or request")}</label>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{t("Number of cards")}:</span>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded border font-mono text-xs transition-colors",
                      count === n ? "border-primary bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={
                isMutashabihat
                  ? t("e.g. Quran mutashabihat between Baqarah 126 and Ibrahim 35 in (baladan aminan vs al-balada aminan)")
                  : t("e.g. Key concepts of photosynthesis, 5 practice questions...")
              }
              className="resize-none font-sans text-sm"
              dir="auto"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full gap-2 font-medium"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("Generating cards...")}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {t("Generate")}
              </>
            )}
          </Button>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Generated Cards Preview */}
          {items.length > 0 && (
            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{t("Generated cards")} ({items.length})</span>
                <span className="text-xs text-muted-foreground">
                  {selected.size} / {items.length} {t("selected")}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const isChecked = selected.has(idx);
                  const f = item.fields;
                  const title = item.title || String(f.titleAr || f.title || f.prompt || f.front || `Card #${idx + 1}`);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSelect(idx)}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-sm transition-colors",
                        isChecked ? "border-primary/60 bg-primary/5" : "border-border/60 opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="size-4 rounded accent-primary cursor-pointer"
                        />
                        <span className="font-semibold text-foreground line-clamp-1">{title}</span>
                      </div>

                      {/* Quran Mutashabihat preview */}
                      {Boolean(isMutashabihat && Array.isArray(f.siblings)) && (
                        <div className="text-xs text-muted-foreground space-y-1 pl-6 rtl:pl-0 rtl:pr-6" dir="rtl">
                          {(f.siblings as any[]).slice(0, 2).map((s: any, sIdx: number) => (
                            <div key={sIdx} className="line-clamp-1">
                              • {typeof s === "string" ? s : `${s.surahNameAr || s.surahNumber}:${s.ayahNumber} | ${s.textUthmani || s.pivotalUthmani}`}
                            </div>
                          ))}
                          {typeof f.mnemonicRuleAr === "string" && (
                            <div className="text-primary/90 font-medium line-clamp-1">
                              قاعدة: {String(f.mnemonicRuleAr)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Basic card preview */}
                      {Boolean(!isMutashabihat && (f.front || f.prompt)) && (
                        <div className="text-xs text-muted-foreground pl-6 rtl:pl-0 rtl:pr-6 line-clamp-2">
                          <span className="font-medium text-foreground/80">{String(f.front || f.prompt)}</span>
                          {f.back ? ` → ${String(f.back)}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <DialogFooter className="mt-2 border-t pt-3">
            <Button
              onClick={handleSave}
              disabled={saving || selected.size === 0 || !deck.trim()}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("Saving...")}
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {t("Save selected cards")} ({selected.size})
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
