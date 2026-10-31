// Authentic Quran 114 Surahs lookup table
const SURAH_NAMES = [
  "الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس",
  "هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه",
  "الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم",
  "لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر",
  "فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق",
  "الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة",
  "الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج",
  "نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس",
  "التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد",
  "الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات",
  "القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر",
  "المسد","الإخلاص","الفلق","الناس"
];

function normSurah(s) {
  return String(s || "")
    .replace(/^سورة\s+/, "")
    .replace(/[أإآٱٲٳ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "")
    .trim();
}

function findSurah(val) {
  if (typeof val === "number" && val >= 1 && val <= 114) {
    return { number: val, nameAr: SURAH_NAMES[val - 1] };
  }
  const str = String(val || "").trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 114 && String(num) === str) {
    return { number: num, nameAr: SURAH_NAMES[num - 1] };
  }
  const n = normSurah(str);
  const idx = SURAH_NAMES.findIndex((name) => normSurah(name) === n);
  if (idx !== -1) return { number: idx + 1, nameAr: SURAH_NAMES[idx] };
  return null;
}

function normalizeArabicSimple(text) {
  return String(text || "")
    .replace(/\u0670/g, "ا")
    .replace(/\u0640/g, "")
    .replace(/[\u0610-\u061A\u061C\u064B-\u065F\u0670\u06D6-\u06ED\u06DD\u06DE\u08D4-\u08ED\u08EF-\u08F3]/g, "")
    .replace(/[أإآٱٲٳ]/g, "ا")
    .replace(/ءا/g, "ا")
    .replace(/ا{2,}/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟،؛۝۞]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSibling(input, index) {
  if (!input) throw new Error("sibling " + (index + 1) + " is empty");

  // If already a complete node with prefix/pivotal/suffix
  if (typeof input === "object" && input.pivotalUthmani && input.surahNumber && input.surahNameAr) {
    return {
      ...input,
      id: input.id || (input.surahNumber + "_" + input.ayahNumber),
      textUthmani: input.textUthmani || [input.prefixUthmani, input.pivotalUthmani, input.suffixUthmani].filter(Boolean).join(" "),
      pivotalNormalized: input.pivotalNormalized || normalizeArabicSimple(input.pivotalUthmani),
    };
  }

  let surahRef = "";
  let ayahRef = 0;
  let verseText = "";

  if (typeof input === "string") {
    let raw = input.trim();
    const bracketHeader = raw.match(/^\[([^\]:]+)[:\s]+(\d+)\]\s*(.*)$/);
    if (bracketHeader) {
      surahRef = bracketHeader[1];
      ayahRef = parseInt(bracketHeader[2], 10);
      verseText = bracketHeader[3];
    } else {
      const pipeMatch = raw.match(/^([^|:]+)[:\s]+(\d+)\s*\|\s*(.*)$/);
      if (pipeMatch) {
        surahRef = pipeMatch[1];
        ayahRef = parseInt(pipeMatch[2], 10);
        verseText = pipeMatch[3];
      } else {
        const colonMatch = raw.match(/^([^\d:]+?)[:\s]+(\d+)[:\s]+(.*)$/);
        if (colonMatch) {
          surahRef = colonMatch[1];
          ayahRef = parseInt(colonMatch[2], 10);
          verseText = colonMatch[3];
        } else {
          verseText = raw;
        }
      }
    }
  } else if (typeof input === "object") {
    surahRef = input.surah || input.surahNameAr || input.surahNumber || "";
    ayahRef = parseInt(input.ayah || input.ayahNumber, 10) || 0;
    verseText = input.text || input.textUthmani || "";
    if (!verseText && input.pivotalUthmani) {
      verseText = [input.prefixUthmani, "[" + input.pivotalUthmani + "]", input.suffixUthmani].filter(Boolean).join(" ");
    }
  }

  const surahInfo = findSurah(surahRef);
  const surahNumber = surahInfo ? surahInfo.number : (parseInt(surahRef, 10) || (index + 1));
  const surahNameAr = surahInfo ? surahInfo.nameAr : (String(surahRef) || ("سورة " + surahNumber));
  const ayahNumber = ayahRef || 1;

  const bStart = verseText.indexOf("[");
  const bEnd = verseText.indexOf("]", bStart + 1);
  if (bStart === -1 || bEnd === -1) {
    throw new Error("آية " + surahNameAr + " (" + ayahNumber + "): يجب وضع اللفظ المفصلي المختلف بين قوسين [هكذا]");
  }

  const prefixUthmani = verseText.slice(0, bStart).trim();
  const pivotalUthmani = verseText.slice(bStart + 1, bEnd).trim();
  const suffixUthmani = verseText.slice(bEnd + 1).trim();
  const textUthmani = [prefixUthmani, pivotalUthmani, suffixUthmani].filter(Boolean).join(" ");
  const pivotalNormalized = normalizeArabicSimple(pivotalUthmani);
  const id = (input && input.id) ? input.id : (surahNumber + "_" + ayahNumber);

  return {
    id,
    surahNumber,
    surahNameAr,
    ayahNumber,
    prefixUthmani,
    pivotalUthmani,
    suffixUthmani,
    textUthmani,
    pivotalNormalized,
  };
}

const rawSiblings = Array.isArray(fields.siblings) ? fields.siblings : [];
const siblings = rawSiblings.map((s, i) => parseSibling(s, i));

if (siblings.length < 2) throw new Error("a Mutashabihat cluster needs at least two sibling verses");

let target;
if (fields.targetVerseId) {
  target = siblings.find((s) => s.id === fields.targetVerseId);
  if (!target) throw new Error(`targetVerseId "${fields.targetVerseId}" is not one of the siblings`);
} else {
  target = siblings[0];
}

for (const s of siblings) {
  if (!s || !s.id || !s.surahNumber || !s.surahNameAr || !s.ayahNumber) {
    throw new Error("each sibling needs id, surahNumber, surahNameAr and ayahNumber");
  }
}
if (!target.pivotalUthmani) throw new Error("the target sibling is missing pivotalUthmani");
const mode = fields.mode === "surah_identification" ? "surah_identification" : "pivotal_completion";
const inputSubmode = fields.inputSubmode === "typing" ? "typing" : "choice";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function arabicDigits(value) {
  return String(value == null ? "" : value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

function fullText(s) {
  if (s.textUthmani) return s.textUthmani;
  return [s.prefixUthmani, s.pivotalUthmani, s.suffixUthmani].filter(Boolean).join(" ");
}

function surahLabel(s) {
  return "سورة " + (s.surahNameAr || "") + " (" + arabicDigits(s.ayahNumber) + ")";
}

// Pivotal options: the target plus up to three distinct distractors. The target is always present.
const targetPivotal = target.pivotalUthmani || "";
const seenPivotal = new Set([targetPivotal]);
const distractorPivots = [];
for (const s of siblings) {
  if (s.id === target.id || !s.pivotalUthmani || seenPivotal.has(s.pivotalUthmani)) continue;
  seenPivotal.add(s.pivotalUthmani);
  distractorPivots.push({ textUthmani: s.pivotalUthmani, isTarget: false });
}
if (Array.isArray(fields.extraDistractorsUthmani)) {
  for (const d of fields.extraDistractorsUthmani) {
    if (d && !seenPivotal.has(d)) {
      seenPivotal.add(d);
      distractorPivots.push({ textUthmani: d, isTarget: false });
    }
  }
}
const pivotalRaw = rng.shuffle([
  { textUthmani: targetPivotal, isTarget: true },
  ...rng.shuffle(distractorPivots).slice(0, 3),
]);
// Opaque option ids keep the answer out of the DOM and the view payload.
const pivotalOptions = pivotalRaw.map((o, i) => ({ id: "p" + i, textUthmani: o.textUthmani }));
const correctPivotalOptionId = "p" + pivotalRaw.findIndex((o) => o.isTarget);
if (mode === "pivotal_completion" && pivotalOptions.length < 2) {
  throw new Error("pivotal_completion needs at least two distinct pivotal phrases");
}

// Surah options: the target plus up to three other distinct Surahs, shuffled and capped at four.
const seenSurahs = new Set([target.surahNumber]);
const otherSurahs = [];
for (const s of siblings) {
  if (s.id === target.id || !s.surahNameAr || seenSurahs.has(s.surahNumber)) continue;
  seenSurahs.add(s.surahNumber);
  otherSurahs.push(s);
}
if (mode === "surah_identification" && otherSurahs.length === 0) {
  throw new Error("surah_identification needs siblings from at least two different Surahs");
}
const surahRaw = rng.shuffle([target, ...rng.shuffle(otherSurahs).slice(0, 3)]);
const surahOptions = surahRaw.map((s, i) => ({
  id: "s" + i,
  surahNumber: s.surahNumber,
  surahNameAr: s.surahNameAr,
  ayahNumber: s.ayahNumber,
  labelAr: surahLabel(s),
}));
const correctSurahOptionId = "s" + surahRaw.findIndex((s) => s.id === target.id);

const view = {
  mode,
  inputSubmode,
  hintAr: fields.hintAr || "",
  prefixUthmani: target.prefixUthmani || "",
  suffixUthmani: target.suffixUthmani || "",
};

// Each card renders only the mode it was generated for, so the view never carries the other
// mode's answer material (the target Surah name or the unmasked pivotal phrase).
if (mode === "surah_identification") {
  view.pivotalUthmani = target.pivotalUthmani || "";
  view.fullTextUthmani = fullText(target);
  view.surahOptions = surahOptions;
} else {
  view.targetSurahNumber = target.surahNumber;
  view.targetSurahNameAr = target.surahNameAr || "";
  view.targetAyahNumber = target.ayahNumber;
  view.targetAyahLabel = arabicDigits(target.ayahNumber);
  view.pivotalOptions = pivotalOptions;
}

return {
  view,
  key: {
    targetVerseId: target.id,
    correctOptionId: mode === "surah_identification" ? correctSurahOptionId : correctPivotalOptionId,
    correctOptionTextUthmani:
      mode === "surah_identification" ? surahLabel(target) : target.pivotalUthmani || "",
    correctPivotalUthmani: target.pivotalUthmani || "",
    correctPivotalNormalized: target.pivotalNormalized || "",
    correctSurahNameAr: target.surahNameAr || "",
    correctAyahNumber: target.ayahNumber,
    correctAyahLabel: arabicDigits(target.ayahNumber),
    correctSurahLabelAr: surahLabel(target),
    mnemonicRuleAr: fields.mnemonicRuleAr || "",
    siblings: siblings.map((s) => ({
      id: s.id,
      surahNumber: s.surahNumber,
      surahNameAr: s.surahNameAr,
      ayahNumber: s.ayahNumber,
      ayahLabel: arabicDigits(s.ayahNumber),
      prefixUthmani: s.prefixUthmani || "",
      pivotalUthmani: s.pivotalUthmani || "",
      suffixUthmani: s.suffixUthmani || "",
      textUthmani: fullText(s),
      pivotalNormalized: s.pivotalNormalized || "",
    })),
  },
};
