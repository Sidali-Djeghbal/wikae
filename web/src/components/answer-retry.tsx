import { t } from "@/lib/i18n";

export function AnswerRetry({ hint }: { hint: string }) {
  return (
    <div role="status" className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
      <p className="font-medium">{t("Try again")}</p>
      <p className="mt-1">{hint}</p>
      <p className="mt-1 text-muted-foreground">{t("This answer wasn't graded.")}</p>
    </div>
  );
}
