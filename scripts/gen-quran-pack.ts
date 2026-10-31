// Builds examples/quran-mutashabihat.pack.json from the verified seed clusters.
// node scripts/gen-quran-pack.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_SEED_CLUSTERS, generateEtudeItemsFromCluster } from "../src/core/mutashabihat.ts";

const deck = "متشابهات القرآن الكريم";
const source = "القرآن الكريم - مصحف المدينة النبوية (مجمع الملك فهد)";

const items = VERIFIED_SEED_CLUSTERS.flatMap((cluster) => {
  const surahs = [...new Set(cluster.siblings.map((s) => s.surahNameAr))];
  return generateEtudeItemsFromCluster(cluster, deck).map((item) => ({
    id: item.id,
    type: item.type,
    deck: item.deck,
    // Surah tags would reveal the answer on Surah-identification cards.
    tags: item.fields.mode === "surah_identification" ? ["قرآن", "متشابهات"] : ["قرآن", "متشابهات", ...surahs],
    fields: item.fields,
    source,
  }));
});

const pack = {
  etude: "pack/1",
  name: deck,
  description:
    "حزمة تدريب الحفاظ على إكمال الآيات واكتشاف المتشابهات اللفظية والضبط بالقواعد البلاغية والسياقية",
  decks: [
    {
      name: deck,
      description: "مجموعة بطاقات تدريبية تفاعلية لاكتشاف المتشابهات وضبط الفروق اللفظية الدقيقة",
    },
  ],
  items,
};

const out = join(import.meta.dirname, "..", "examples", "quran-mutashabihat.pack.json");
writeFileSync(out, JSON.stringify(pack, null, 2) + "\n");
console.log(`${out}: ${items.length} items`);
