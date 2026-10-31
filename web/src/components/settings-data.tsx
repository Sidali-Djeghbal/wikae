// Where the collection lives, importing packs and exporting everything.
import { useState } from "react";
import { CircleAlert, CircleCheck, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Block, CopyValue, Section } from "@/components/settings-ui";
import { t } from "@/lib/i18n";

type Counts = { created: number; updated: number; unchanged: number };
interface ImportReport {
  file: string;
  ok: boolean;
  items?: Counts;
  types?: Counts;
  decks?: number;
  presets?: number;
  tags?: number;
  error?: string;
}

export function DataSection({ dbPath, mediaDir }: { dbPath: string; mediaDir: string }) {
  const [reports, setReports] = useState<ImportReport[]>([]);
  const [busy, setBusy] = useState(false);

  const pick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      setBusy(true);
      const out: ImportReport[] = [];
      for (const f of files) {
        try {
          let pack: unknown;
          try {
            pack = JSON.parse(await f.text());
          } catch (e) {
            throw new Error(`not valid JSON: ${(e as Error).message}`);
          }
          const r = await api.importPack(pack);
          out.push({ file: f.name, ok: true, items: r.items, types: r.types, decks: r.decks, presets: r.presets, tags: r.tags });
        } catch (e) {
          out.push({ file: f.name, ok: false, error: (e as Error).message });
        }
        setReports([...out]);
      }
      setBusy(false);
    };
    input.click();
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <Section id="data" title={t("Data")} description={t("The collection lives in a SQLite file. Pasted images, audio, video, imported media and drawings are copied into Wikae's own media folder next to it.")}>
      <Block>
        <div className="grid gap-4">
          <CopyValue label={t("Database")} value={dbPath} />
          <CopyValue label={t("Media folder")} value={mediaDir} />
          <p className="text-sm text-muted-foreground">{t("Paste media files or local file paths into a card field to copy them here. Cards keep working when the originals are moved or deleted. Back up this folder together with the database.")}</p>
        </div>
      </Block>
      <Block
        title={t("Import packs")}
        description={t("Add or update decks, types and items from pack files. Items are matched by id, so importing an edited pack again updates it and keeps review history.")}
        stackAside
        aside={
          <Button variant="outline" size="sm" className="h-10 gap-1.5 md:h-8" onClick={pick} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{t("Choose files")}
          </Button>
        }
      >
        {reports.length > 0 && (
          <ul className="flex flex-col gap-2">
            {reports.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-lg border px-3.5 py-3 text-sm">
                {r.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />}
                <div className="min-w-0 flex-1">
                  <div className="break-all font-medium">{r.file}</div>
                  {r.ok && r.items ? (
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t("Items")}: <span className="tabular text-foreground/90">{r.items.created}</span> {t("new")}, <span className="tabular text-foreground/90">{r.items.updated}</span> {t("updated")},{" "}
                      <span className="tabular text-foreground/90">{r.items.unchanged}</span> {t("unchanged")}
                      {r.types && r.types.created + r.types.updated > 0 && (
                        <> · {t("Types")}: {r.types.created} {t("new")}, {r.types.updated} {t("updated")}</>
                      )}
                      {!!r.decks && <> · {r.decks} {r.decks === 1 ? t("deck") : t("decks")}</>}
                      {!!r.presets && <> · {r.presets} {r.presets === 1 ? t("preset") : t("presets")}</>}
                    </div>
                  ) : (
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-destructive">{r.error}</pre>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block
        title={t("Export")}
        description={t("One pack with every item, plus the decks, presets, custom card types and tag notes they use. Review history and scheduling are not in packs; back up the database file to keep them.")}
        stackAside
        aside={
          <Button asChild variant="outline" size="sm" className="h-10 gap-1.5 md:h-8">
            <a href={api.exportUrl({})} download={`wikae-${stamp}.pack.json`}>
              <Download className="size-4" />{t("Export pack")}
            </a>
          </Button>
        }
      />
    </Section>
  );
}
