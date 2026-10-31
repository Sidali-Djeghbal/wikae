import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, type FieldSpec, type ItemEditProposal } from "@/lib/api";
import { t } from "@/lib/i18n";

const display = (value: unknown) => value === undefined ? t("(not set)") : typeof value === "string" ? value || t("(empty)") : JSON.stringify(value, null, 2);

export function ItemAiEdit({ id, fields, specs, onApply }: { id: string; fields: Record<string, unknown>; specs: FieldSpec[]; onApply(fields: Record<string, unknown>): void }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ItemEditProposal | null>(null);
  const [before, setBefore] = useState<Record<string, unknown>>({});
  const request = useRef(0);
  const running = useRef(false);
  const inputId = useId();

  useEffect(() => () => { request.current++; }, []);

  const changeOpen = (value: boolean) => {
    request.current++;
    running.current = false;
    setOpen(value);
    setInstruction("");
    setProposal(null);
    setError(null);
    setBusy(false);
  };

  const generate = async () => {
    if (running.current || !instruction.trim()) return;
    running.current = true;
    const token = ++request.current;
    const snapshot = structuredClone(fields);
    setBefore(snapshot);
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const result = await api.suggestItemEdit(id, instruction, snapshot);
      if (request.current === token) setProposal(result);
    } catch (e) {
      if (request.current === token) setError((e as Error).message);
    } finally {
      if (request.current === token) {
        running.current = false;
        setBusy(false);
      }
    }
  };

  const stale = !!proposal && JSON.stringify(fields) !== JSON.stringify(before);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => changeOpen(true)}>{t("Edit for me")}</Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-3xl" onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            e.stopPropagation();
          }
        }}>
          <DialogHeader>
            <DialogTitle>{t("Edit for me")}</DialogTitle>
            <DialogDescription>{t("Ask AI to change this card. Review the result, then use it in the editor and save when ready.")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-medium">{t("What would you like to change?")}</label>
            <Textarea id={inputId} autoFocus value={instruction} disabled={busy} className="min-h-24" placeholder={t("Make the answer shorter and add a concrete example.")} onChange={(e) => { setInstruction(e.target.value); setProposal(null); setError(null); }} onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void generate();
              }
            }} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {proposal && !proposal.changed.length && <p role="status" className="text-sm text-muted-foreground">{t("No changes suggested. Try describing the change in more detail.")}</p>}
          {proposal && proposal.changed.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t("Review {fields}.", { fields: proposal.changed.length === 1 ? t("the changed field") : t("the {n} changed fields", { n: proposal.changed.length }) })}</p>
              {proposal.changed.map((name) => (
                <section key={name} className="overflow-hidden rounded-lg border">
                  <h3 className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">{specs.find((s) => s.name === name)?.label ?? name}</h3>
                  <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    {[{ label: t("Before"), value: before[name] }, { label: t("After"), value: proposal.fields[name] }].map(({ label, value }) => (
                      <div key={label} className="min-w-0 p-3">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
                        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{display(value)}</pre>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {stale && <p role="alert" className="text-sm text-destructive">{t("The card changed while this edit was being prepared. Generate a new suggestion to use the latest version.")}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => changeOpen(false)}>{t("Cancel")}</Button>
            <Button variant={proposal?.changed.length ? "outline" : "default"} className="gap-1.5" disabled={busy || !instruction.trim()} onClick={generate}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? t("Editing…") : proposal ? t("Try again") : t("Suggest changes")}
            </Button>
            {!!proposal?.changed.length && <Button disabled={stale} onClick={() => {
              onApply(proposal.fields);
              changeOpen(false);
              toast.success(t("Changes added to the editor. Save when ready."));
            }}>{t("Use changes")}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
