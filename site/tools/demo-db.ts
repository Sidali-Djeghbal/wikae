// Builds a demo collection for website screenshots: Quranic and Islamic study decks,
// with three months of simulated review history so Stats, Decks and Browse look lived in.
// node site/tools/demo-db.ts <out.db>
import { rmSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Etude } from "../../src/core/engine.ts";
import { loadTypeDir } from "../../src/core/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = process.argv[2];
if (!out) throw new Error("usage: demo-db.ts <out.db>");
for (const f of [out, `${out}-wal`, `${out}-shm`]) rmSync(f, { force: true });

const etude = await Etude.open(out);
const variants = JSON.parse(readFileSync(join(root, "site/variants.json"), "utf8")) as any[];
const quranVariants = variants.filter((v) => String(v.id).startsWith("showcase.quran.") || String(v.id).startsWith("showcase.order.") || String(v.id).startsWith("showcase.match.")).map((v) => ({
  ...v,
  tags: String(v.id).startsWith("showcase.quran.")
    ? ["متشابهات-القرآن", "سورة-البقرة", "سورة-الأعراف"]
    : String(v.id).startsWith("showcase.order.")
      ? ["ترتيب-الآيات", "جزء-عم"]
      : ["غريب-القرآن", "جزء-عم"],
  deck: String(v.id).startsWith("showcase.quran.")
    ? "متشابهات القرآن::سورة البقرة وآل عمران"
    : String(v.id).startsWith("showcase.order.")
      ? "ترتيب الآيات::جزء عمّ"
      : "غريب القرآن وتفسيره::جزء عمّ",
}));

const items: any[] = [...quranVariants];
const add = (deck: string, id: string, type: string, fields: Record<string, unknown>, tags: string[] = []) => items.push({ id, type, deck, fields, tags });

const tajweed = [
  ["ما حكم النون الساكنة إذا أتى بعدها حرف الباء؟", "الإقلاب (قلب النون الساكنة ميماً مخفاة مع الغنة بمقدار حركتين)."],
  ["ما حروف الإظهار الحلقي الستة في تحفة الأطفال؟", "همز فهاء ثم عين حاء · مهملتان ثم غين خاء."],
  ["ما حروف الإدغام بغنة المجموعة في قول الناظم؟", "مجموعة في لفظ «ينمو» (الياء والنون والميم والواو)."],
  ["ما مقدار مد الواجب المتصل والمد الجائز المنفصل من طريق الشاطبية؟", "أربع أو خمس حركات (التوسط أو فويق التوسط)."],
  ["ما الفرق بين مخرج الضاد ومخرج الظاء في المقدمة الجزرية؟", "الضاد من حافة اللسان مع ما يليها من الأضراس، والظاء من طرف اللسان مع أطراف الثنايا العليا."],
  ["ما حروف القلقلة المجموعة في قول ابن الجزري؟", "مجموعة في قوله: «قطب جد» (القاف والطاء والباء والجيم والدال)."],
];
tajweed.forEach(([q, a], i) => add("متون التجويد::تحفة الأطفال والجزرية", `demo.tajweed.${i}`, "basic", { front: q, back: a }, ["أحكام-التجويد", "تحفة-الأطفال"]));

const nawawi = [
  ["الحديث الأول: بمَ تُوزن الأعمال في الإسلام؟", "«إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى» — متفق عليه."],
  ["الحديث الثالث: على كم بُني الإسلام؟", "على خمس: شهادة أن لا إله إلا الله وأن محمداً رسول الله، وإقام الصلاة، وإيتاء الزكاة، وحج البيت، وصوم رمضان."],
  ["الحديث الخامس: ما حكم من أحدث في أمرنا هذا ما ليس منه؟", "«مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ» — متفق عليه."],
  ["الحديث السادس: ما المضغة التي إذا صلحت صلح الجسد كله؟", "القلب: «أَلاَ وَإِنَّ فِي الْجَسَدِ مُضْغَةً إِذَا صَلَحَتْ صَلَحَ الْجَسَدُ كُلُّهُ... أَلاَ وَهِيَ الْقَلْبُ»."],
  ["الحديث السابع: ما جامع الدين كما في حديث تميم الداري؟", "«الدِّينُ النَّصِيحَةُ» قلنا: لمن؟ قال: «لِلَّهِ وَلِكِتَابِهِ وَلِرَسُولِهِ وَلأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ»."],
  ["الحديث الثاني عشر: ما من حُسن إسلام المرء؟", "«مِنْ حُسْنِ إِسْلاَمِ الْمَرْءِ تَرْكُهُ مَا لاَ يَعْنِيهِ» — حديث حسن."],
];
nawawi.forEach(([q, a], i) => add("الحديث الشريف::الأربعون النووية", `demo.nawawi.${i}`, "basic", { front: q, back: a }, ["الأربعون-النووية", "الحديث-الشريف"]));

const gharib = [
  ["ما معنى قوله تعالى ﴿وَهَّاجًا﴾ في سورة النبأ؟", "مضيئاً متوقداً جامعاً بين النور والحرارة"],
  ["ما معنى قوله تعالى ﴿غُثَاءً أَحْوَىٰ﴾ في سورة الأعلى؟", "هشيماً يابساً أسود بعد خضرته"],
  ["ما معنى قوله تعالى ﴿لِذِي حِجْرٍ﴾ في سورة الفجر؟", "لصاحب عقل ولبّ يمنعه عما لا ينبغي"],
  ["ما معنى قوله تعالى ﴿عَسْعَسَ﴾ في سورة التكوير؟", "أقبل بظلامه أو أدبر وذهب"],
  ["ما معنى قوله تعالى ﴿كَالْعِهْنِ الْمَنْفُوشِ﴾ في سورة القارعة؟", "كالصوف المصبوغ المتطاير"],
];
gharib.forEach(([q, a], i) => add("غريب القرآن وتفسيره::جزء عمّ", `demo.gharib.${i}`, "basic", { front: q, back: a }, ["غريب-القرآن", "جزء-عم"]));

etude.importPack({ etude: "pack/1", name: "Wikae Demo", items });

// Three months of history: each card is introduced on some day, then reviewed whenever it came
// due, with ratings drawn so retention lands near 90%.
let s = 7;
const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const DAY = 86400_000;
const start = Date.now() - 92 * DAY;
const pool = (etude.search("", { limit: 2000 }) as any).rows as { cardId: number }[];
const intro = new Map(pool.map((c) => [c.cardId, start + Math.floor(rand() * 80) * DAY + Math.floor(rand() * 10) * 3600_000]));
const HOURS = [5, 6, 8, 17, 19, 20, 20, 21, 21, 22, 22, 23];
for (let day = 0; day <= 92; day++) {
  if (day < 86 && rand() < 0.1) continue;
  const midnight = new Date(start + day * DAY);
  midnight.setHours(0, 0, 0, 0);
  const t0 = midnight.getTime() + HOURS[Math.floor(rand() * HOURS.length)] * 3600_000 + Math.floor(rand() * 40) * 60_000;
  let k = 0;
  for (const c of pool) {
    const row = etude.cardSchedule(c.cardId) as any;
    const due = row?.due ? new Date(row.due).getTime() : 0;
    const introduced = intro.get(c.cardId)!;
    const isNew = !row || row.state === 0;
    if ((isNew && introduced <= t0 && introduced > t0 - DAY) || (!isNew && due <= t0 + 3600_000)) {
      const r = rand();
      const rating = (r < 0.08 ? 1 : r < 0.18 ? 2 : r < 0.92 ? 3 : 4) as 1 | 2 | 3 | 4;
      etude.rate(c.cardId, rating, { at: new Date(t0 + k++ * 47_000), durationMs: 4000 + Math.floor(rand() * 20000) });
    }
  }
}
etude.updateDeck("متشابهات القرآن", { config: { deadline: new Date(Date.now() + 16 * DAY).toISOString() } });
const quranCard = (etude.search("type:quran-mutashabihat", { limit: 1 }) as any).rows?.[0]?.cardId ?? 1;
console.log(JSON.stringify({ cards: pool.length, quranCard, reviews: (etude as any).db.get("SELECT COUNT(*) AS n FROM reviews").n }));
etude.close();
