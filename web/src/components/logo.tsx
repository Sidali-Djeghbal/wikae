import { cn } from "@/lib/utils";
import { WikaeMark, WikaeLogo, WikaaMark, WikaaLogo } from "@/components/brand/wikae-logo";

export { WikaeMark, WikaeLogo, WikaaMark, WikaaLogo };

/**
 * Wikae's Brand Emblem Logo:
 * Calligraphic curved "W" cord knot representing "المذاكرةُ وِكاءُ الحِفْظ".
 */
export function Logo({ className, tile = false }: { className?: string; tile?: boolean }) {
  if (tile) {
    return (
      <div className={cn("relative flex items-center justify-center rounded-xl bg-card/80 border border-border/50 p-1.5 shadow-sm overflow-hidden", className)}>
        <WikaeMark size={64} className="size-full" />
      </div>
    );
  }
  return <WikaeMark size={32} className={className} />;
}

/**
 * Wikae Wordmark:
 * Displays the calligraphic "وِكَاء" in Arabic mode and curved serif "Wikae" in English mode.
 */
export function Wordmark({ className }: { className?: string }) {
  return <WikaeLogo variant="wordmark" size="md" className={className} />;
}
