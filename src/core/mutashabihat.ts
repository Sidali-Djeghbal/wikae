export interface MutashabihVerseNode {
  id: string;
  surahNumber: number;
  surahNameAr: string;
  ayahNumber: number;
  /** Full verse or segment in authentic Uthmani script */
  textUthmani: string;
  /** Text before the pivotal segment */
  prefixUthmani: string;
  /** The exact distinguishing word/phrase in Uthmani script */
  pivotalUthmani: string;
  /** Text after the pivotal segment */
  suffixUthmani: string;
  /** Simplified Arabic string of the pivotal segment for typing fallback */
  pivotalNormalized: string;
}

export interface MutashabihatClusterCard {
  id: string;
  type: "quran_mutashabihat" | "quran-mutashabihat";
  mode: "pivotal_completion" | "surah_identification";
  /** ID of the target verse in `siblings` being tested in this card instance */
  targetVerseId: string;
  /** All similar verses in this Mutashabihat group (minimum 2) */
  siblings: MutashabihVerseNode[];
  /** Extra distractor phrases if needed */
  extraDistractorsUthmani?: string[];
  /** Traditional mnemonic rule (قاعدة الضبط) */
  mnemonicRuleAr?: string;
  /** Optional contextual hint shown before answering if requested */
  hintAr?: string;
}

export interface MutashabihatClusterInput {
  id: string;
  type?: "quran_mutashabihat" | "quran-mutashabihat";
  siblings: MutashabihVerseNode[];
  extraDistractorsUthmani?: string[];
  mnemonicRuleAr?: string;
  hintAr?: string;
}

/**
 * Validates a MutashabihVerseNode. Returns an array of error messages (empty if valid).
 */
export function validateVerseNode(node: unknown, index = 0): string[] {
  const errs: string[] = [];
  const n = node as Partial<MutashabihVerseNode>;
  if (!n || typeof n !== "object") return [`sibling[${index}] must be an object`];
  if (!n.id || typeof n.id !== "string") errs.push(`sibling[${index}].id is required`);
  if (typeof n.surahNumber !== "number" || !Number.isInteger(n.surahNumber) || n.surahNumber < 1 || n.surahNumber > 114) {
    errs.push(`sibling[${index}].surahNumber must be 1..114`);
  }
  if (!n.surahNameAr || typeof n.surahNameAr !== "string") {
    errs.push(`sibling[${index}].surahNameAr is required`);
  }
  if (typeof n.ayahNumber !== "number" || !Number.isInteger(n.ayahNumber) || n.ayahNumber < 1) {
    errs.push(`sibling[${index}].ayahNumber must be a positive integer`);
  }
  for (const key of ["prefixUthmani", "suffixUthmani"] as const) {
    if (typeof n[key] !== "string") errs.push(`sibling[${index}].${key} must be a string`);
  }
  for (const key of ["textUthmani", "pivotalUthmani", "pivotalNormalized"] as const) {
    if (!n[key] || typeof n[key] !== "string") errs.push(`sibling[${index}].${key} is required`);
  }
  return errs;
}

export function validateMutashabihatCard(card: unknown): string[] {
  const errs: string[] = [];
  const c = card as Partial<MutashabihatClusterCard>;
  if (!c || typeof c !== "object") return ["card must be an object"];
  if (!c.id || typeof c.id !== "string") errs.push("card id is required");
  if (c.type !== "quran_mutashabihat" && c.type !== "quran-mutashabihat") {
    errs.push('type must be "quran_mutashabihat" or "quran-mutashabihat"');
  }
  if (c.mode !== "pivotal_completion" && c.mode !== "surah_identification") {
    errs.push('mode must be "pivotal_completion" or "surah_identification"');
  }
  if (!Array.isArray(c.siblings) || c.siblings.length < 2) {
    errs.push("siblings must be an array of at least 2 verses");
  } else {
    c.siblings.forEach((s, idx) => errs.push(...validateVerseNode(s, idx)));
    if (!c.targetVerseId || typeof c.targetVerseId !== "string") {
      errs.push("targetVerseId is required");
    } else if (!c.siblings.some((s) => s.id === c.targetVerseId)) {
      errs.push(`targetVerseId "${c.targetVerseId}" not found in siblings`);
    }
  }
  if (c.extraDistractorsUthmani !== undefined) {
    if (!Array.isArray(c.extraDistractorsUthmani) || c.extraDistractorsUthmani.some((x) => typeof x !== "string")) {
      errs.push("extraDistractorsUthmani must be an array of strings");
    }
  }
  for (const key of ["mnemonicRuleAr", "hintAr"] as const) {
    if (c[key] !== undefined && typeof c[key] !== "string") errs.push(`${key} must be a string`);
  }
  return errs;
}

/**
 * Validates and provides schema metadata for Mutashabihat cards.
 */
export const MutashabihatCardSchema = {
  validate: validateMutashabihatCard,
  validateNode: validateVerseNode,
};

/**
 * Generates atomic FSRS flashcards from a single Mutashabihat cluster.
 * Expands each sibling verse into two bidirectional cards:
 * 1. pivotal_completion (masks the distinguishing word/phrase in context)
 * 2. surah_identification (asks which Surah features this exact wording)
 * 
 * For N siblings, produces exactly 2 * N atomic cards.
 */
export function generateCardsFromMutashabihatCluster(
  cluster: MutashabihatClusterCard | MutashabihatClusterInput
): MutashabihatClusterCard[] {
  if (!cluster.id || typeof cluster.id !== "string") throw new Error("cluster id is required");
  const siblings = cluster.siblings;
  if (!Array.isArray(siblings) || siblings.length < 2) {
    throw new Error("a Mutashabihat cluster needs at least two sibling verses");
  }
  const errs = siblings.flatMap((s, idx) => validateVerseNode(s, idx));
  if (errs.length) throw new Error(errs.join("; "));

  const cards: MutashabihatClusterCard[] = [];
  const baseType = cluster.type ?? "quran-mutashabihat";

  for (const sibling of siblings) {
    // 1. Mode A: Pivotal Word/Phrase Completion
    cards.push({
      id: `${cluster.id}_${sibling.id}_completion`,
      type: baseType,
      mode: "pivotal_completion",
      targetVerseId: sibling.id,
      siblings,
      extraDistractorsUthmani: cluster.extraDistractorsUthmani,
      mnemonicRuleAr: cluster.mnemonicRuleAr,
      hintAr: cluster.hintAr,
    });

    // 2. Mode B: Surah & Position Identification
    cards.push({
      id: `${cluster.id}_${sibling.id}_surah`,
      type: baseType,
      mode: "surah_identification",
      targetVerseId: sibling.id,
      siblings,
      extraDistractorsUthmani: cluster.extraDistractorsUthmani,
      mnemonicRuleAr: cluster.mnemonicRuleAr,
      hintAr: cluster.hintAr,
    });
  }

  return cards;
}

/** Arabic-Indic digits, as used in Mushaf references. */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/**
 * Converts atomic Mutashabihat cards into Etude collection item shapes.
 */
export function generateEtudeItemsFromCluster(
  cluster: MutashabihatClusterCard | MutashabihatClusterInput,
  deck = "متشابهات القرآن الكريم"
) {
  const cards = generateCardsFromMutashabihatCluster(cluster);
  return cards.map((card) => {
    const target = card.siblings.find((s) => s.id === card.targetVerseId) ?? card.siblings[0];
    const modeLabel = card.mode === "surah_identification" ? "تحديد السورة" : "إكمال";
    // In Surah mode the Surah name and ayah are the answer, so the list title uses the prompt.
    const titleAr = card.mode === "surah_identification"
      ? `${modeLabel} · ${target.pivotalUthmani}`
      : `سورة ${target.surahNameAr} · آية ${toArabicDigits(target.ayahNumber)} · ${modeLabel}`;
    return {
      id: card.id.replace(/_/g, "."),
      type: "quran-mutashabihat",
      deck,
      fields: {
        titleAr,
        mode: card.mode,
        targetVerseId: card.targetVerseId,
        siblings: card.siblings,
        extraDistractorsUthmani: card.extraDistractorsUthmani ?? [],
        mnemonicRuleAr: card.mnemonicRuleAr ?? "",
        hintAr: card.hintAr ?? "",
        inputSubmode: "choice",
      },
    };
  });
}

/**
 * Verified seed clusters with exact Uthmani text.
 */
export const VERIFIED_SEED_CLUSTERS: MutashabihatClusterCard[] = [
  // Cluster 1: البقرة (126) vs إبراهيم (35)
  {
    id: "cluster_baqarah_126_ibrahim_35",
    type: "quran-mutashabihat",
    mode: "pivotal_completion",
    targetVerseId: "baqarah_126",
    siblings: [
      {
        id: "baqarah_126",
        surahNumber: 2,
        surahNameAr: "البقرة",
        ayahNumber: 126,
        prefixUthmani: "وَإِذْ قَالَ إِبْرَٰهِـۧمُ رَبِّ ٱجْعَلْ هَـٰذَا",
        pivotalUthmani: "بَلَدًا ءَامِنًا",
        suffixUthmani: "وَٱرْزُقْ أَهْلَهُۥ مِنَ ٱلثَّمَرَٰتِ",
        textUthmani: "وَإِذْ قَالَ إِبْرَٰهِـۧمُ رَبِّ ٱجْعَلْ هَـٰذَا بَلَدًا ءَامِنًا وَٱرْزُقْ أَهْلَهُۥ مِنَ ٱلثَّمَرَٰتِ",
        pivotalNormalized: "بلدا آمنا",
      },
      {
        id: "ibrahim_35",
        surahNumber: 14,
        surahNameAr: "إبراهيم",
        ayahNumber: 35,
        prefixUthmani: "وَإِذْ قَالَ إِبْرَٰهِيمُ رَبِّ ٱجْعَلْ هَـٰذَا",
        pivotalUthmani: "ٱلْبَلَدَ ءَامِنًا",
        suffixUthmani: "وَٱجْنُبْنِى وَبَنِىَّ أَن نَّعْبُدَ ٱلْأَصْنَامَ",
        textUthmani: "وَإِذْ قَالَ إِبْرَٰهِيمُ رَبِّ ٱجْعَلْ هَـٰذَا ٱلْبَلَدَ ءَامِنًا وَٱجْنُبْنِى وَبَنِىَّ أَن نَّعْبُدَ ٱلْأَصْنَامَ",
        pivotalNormalized: "البلد آمنا",
      },
    ],
    mnemonicRuleAr:
      "في سورة البقرة جاءت نكرة (بَلَدًا ءَامِنًا) لأن الدعوة كانت قبل عمارة مكة واستقرار الناس فيها، وفي سورة إبراهيم جاءت معرفة بالألف واللام (ٱلْبَلَدَ ءَامِنًا) بعد أن أصبحت مكة بلداً معموراً ومستقراً.",
    hintAr: "تذكر التدرج الزمني لعمارة مكة بين التنكير والتعريف.",
  },

  // Cluster 2: الأنعام (151) vs الإسراء (31)
  {
    id: "cluster_anam_151_isra_31",
    type: "quran-mutashabihat",
    mode: "pivotal_completion",
    targetVerseId: "anam_151",
    siblings: [
      {
        id: "anam_151",
        surahNumber: 6,
        surahNameAr: "الأنعام",
        ayahNumber: 151,
        prefixUthmani: "وَلَا تَقْتُلُوٓا۟ أَوْلَـٰدَكُم",
        pivotalUthmani: "مِّنْ إِمْلَـٰقٍ ۖ نَّحْنُ نَرْزُقُكُمْ وَإِيَّاهُمْ",
        suffixUthmani: "وَلَا تَقْرَبُوا۟ ٱلْفَوَٰحِشَ مَا ظَهَرَ مِنْهَا وَمَا بَطَنَ",
        textUthmani: "وَلَا تَقْتُلُوٓا۟ أَوْلَـٰدَكُم مِّنْ إِمْلَـٰقٍ ۖ نَّحْنُ نَرْزُقُكُمْ وَإِيَّاهُمْ وَلَا تَقْرَبُوا۟ ٱلْفَوَٰحِشَ مَا ظَهَرَ مِنْهَا وَمَا بَطَنَ",
        pivotalNormalized: "من إملاق نحن نرزقكم وإياهم",
      },
      {
        id: "isra_31",
        surahNumber: 17,
        surahNameAr: "الإسراء",
        ayahNumber: 31,
        prefixUthmani: "وَلَا تَقْتُلُوٓا۟ أَوْلَـٰدَكُمْ",
        pivotalUthmani: "خَشْيَةَ إِمْلَـٰقٍ ۖ نَّحْنُ نَرْزُقُهُمْ وَإِيَّاهُمْ",
        suffixUthmani: "إِنَّ قَتْلَهُمْ كَانَ خِطْـًٔا كَبِيرًا",
        textUthmani: "وَلَا تَقْتُلُوٓا۟ أَوْلَـٰدَكُمْ خَشْيَةَ إِمْلَـٰقٍ ۖ نَّحْنُ نَرْزُقُهُمْ وَإِيَّاهُمْ إِنَّ قَتْلَهُمْ كَانَ خِطْـًٔا كَبِيرًا",
        pivotalNormalized: "خشية إملاق نحن نرزقهم وإياهم",
      },
    ],
    mnemonicRuleAr:
      "في سورة الأنعام الفقر واقع فعلاً (مِّنْ إِمْلَاقٍ) فناسب تقديم رزق الآباء الجائعين (نَرْزُقُكُمْ وَإِيَّاهُمْ)، أما في سورة الإسراء فالفقر متوقع مستقبلاً بسبب الأبناء (خَشْيَةَ إِمْلَاقٍ) فناسب تقديم رزق الأبناء (نَرْزُقُهُمْ وَإِيَّاهُمْ).",
    hintAr: "اربط بين حضور الفقر الفعلي (مِّنْ) وبين الخوف منه مستقبلاً (خَشْيَةَ) في تقديم ضمير المخاطب أو الغائب.",
  },
];

