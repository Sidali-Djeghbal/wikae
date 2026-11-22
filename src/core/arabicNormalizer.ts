/**
 * Intelligent Arabic Text Normalization Utility for Quranic Text & Mutashabihat Evaluation.
 * 
 * Display must always remain strict authentic Uthmani script.
 * This normalization is strictly for evaluating user input (typing recall mode)
 * so memorizers are not penalized for lacking specialized Uthmani keyboard characters
 * or omitting optional diacritics.
 */

export interface NormalizerOptions {
  /** Strip all Tashkeel / Harakat and Quranic annotation marks */
  stripTashkeel?: boolean;
  /** Normalize Alef variants: [أإآٱٲٳ] -> ا */
  normalizeAlef?: boolean;
  /** Convert the standard Uthmani dagger-alef forms, and strip the rest as silent alefs */
  convertDaggerAlef?: boolean;
  /** Normalize isolated Hamza followed by Alef at the start of a word (ءا -> ا) */
  normalizeHamzaAlef?: boolean;
  /** Normalize Alef Maksura: ى -> ي */
  normalizeAlefMaksura?: boolean;
  /** Normalize Teh Marbuta: ة -> ه (soft match for typing evaluation) */
  normalizeTehMarbuta?: boolean;
  /** Strip Tatweel / Kashida (ـ) */
  stripTatweel?: boolean;
  /** Strip punctuation marks and Quranic stop marks */
  stripPunctuation?: boolean;
  /** Collapse whitespace and trim */
  normalizeWhitespace?: boolean;
}

const DEFAULT_OPTIONS: Required<NormalizerOptions> = {
  stripTashkeel: true,
  normalizeAlef: true,
  convertDaggerAlef: true,
  normalizeHamzaAlef: true,
  normalizeAlefMaksura: true,
  normalizeTehMarbuta: true,
  stripTatweel: true,
  stripPunctuation: true,
  normalizeWhitespace: true,
};

/**
 * Regex patterns for Arabic Unicode ranges:
 * - \u0610-\u061A: Quranic sign ornaments and honorifics
 * - \u064B-\u065F: Standard Arabic Harakat (Fatha, Damma, Kasra, Tanween, Shadda, Sukun, Maddah)
 * - \u0670: Superscript / Dagger Alef (ألف خنجرية)
 * - \u06D6-\u06ED: Quranic Waqf, Sajda, Rub-el-Hizb, and small high letters
 * - \u06DD-\u06DE: End-of-Ayah and Rub-el-Hizb signs
 * - \u08D4-\u08ED\u08EF-\u08F3: Extended Quranic Arabic diacritics
 * - \u061C: Arabic letter mark
 */
export const TASHKEEL_REGEX = /[\u0610-\u061A\u061C\u064B-\u065F\u0670\u06D6-\u06ED\u06DD\u06DE\u08D4-\u08ED\u08EF-\u08F3]/g;
export const TATWEEL_REGEX = /\u0640/g;
export const ALEF_VARIANTS_REGEX = /[أإآٱٲٳ]/g;
export const ZERO_WIDTH_REGEX = /[\u200B-\u200D\u200E\u200F\uFEFF]/g;
export const PUNCTUATION_REGEX = /[.,/#!$%^&*;:{}=\-_`~()؟،؛۝۞﴿﴾«»]/g;

/**
 * Normalizes an Arabic string according to the provided options.
 *
 * Uthmani dagger alefs are handled by rasm, not by a blanket "add an alef":
 * `ىٰ` keeps its alef maksura, `وٰ` becomes a plain alef (صلاة), and the remaining
 * silent daggers (هذا، ذلك، الرحمن، إله) are dropped. Words where Imla'i writes the
 * alef (إملاق، إبراهيم) still match through `areArabicTokensEqual`'s skeleton fallback.
 */
export function normalizeArabic(text: string | null | undefined, options: NormalizerOptions = {}): string {
  if (!text) return "";
  const opts: Required<NormalizerOptions> = { ...DEFAULT_OPTIONS, ...options };
  let s = String(text);

  // 1. Bidi marks and zero-width characters never carry meaning here.
  s = s.replace(ZERO_WIDTH_REGEX, "");

  // 2. Dagger alef: keep the alef maksura of عَلَىٰ/مُوسَىٰ, and turn the waw of
  // الصلاة into a plain alef. The rest are silent rasm alefs and are stripped below.
  if (opts.convertDaggerAlef) {
    s = s.replace(/\u0649\u0670/g, "\u0649");
    s = s.replace(/\u0648\u0670/g, "\u0627");
    s = s.replace(/[\u06E6\u06E7]/g, "\u064A");
  }

  // 3. Strip Tatweel / Kashida (ـ)
  if (opts.stripTatweel) {
    s = s.replace(TATWEEL_REGEX, "");
  }

  // 4. Strip Tashkeel, Harakat, Quranic annotations and any remaining dagger alef
  if (opts.stripTashkeel) {
    s = s.replace(TASHKEEL_REGEX, "");
  }

  // 5. Handle a word-initial hamza + plain alef before alef variants are folded,
  // so ءَامَنُوا matches آمَنُوا while ءَأَنتُمْ stays distinct from أَنتُمْ.
  if (opts.normalizeHamzaAlef) {
    s = s.replace(/(^|[\s])ءا/g, "$1ا");
  }

  // 6. Normalize Alef variants: [أإآٱٲٳ] -> ا
  if (opts.normalizeAlef) {
    s = s.replace(ALEF_VARIANTS_REGEX, "ا");
  }

  // 7. Normalize Alef Maksura: ى -> ي
  if (opts.normalizeAlefMaksura) {
    s = s.replace(/ى/g, "ي");
  }

  // 8. Normalize Teh Marbuta: ة -> ه
  if (opts.normalizeTehMarbuta) {
    s = s.replace(/ة/g, "ه");
  }

  // 9. Strip punctuation
  if (opts.stripPunctuation) {
    s = s.replace(PUNCTUATION_REGEX, " ");
  }

  // 10. Normalize whitespace
  if (opts.normalizeWhitespace) {
    s = s.replace(/\s+/g, " ").trim();
  }

  return s;
}

/** Removes long-vowel alefs after the primary normalization, for Uthmani/Imla'i spelling differences. */
export function arabicSkeleton(normalized: string): string {
  return normalized.replace(/ا/g, "");
}

const HAS_UTHMANI_AMBIGUITY = /[\u0670\u06E6\u06E7]/;

/**
 * Strips only Tashkeel / Harakat and Quranic marks, preserving letter forms and Tatweel.
 */
export function stripTashkeel(text: string | null | undefined): string {
  if (!text) return "";
  return String(text).replace(TASHKEEL_REGEX, "");
}

/**
 * Compares user input with a target verse or phrase using intelligent Arabic normalization.
 * A second pass ignores long-vowel alefs when either side uses an Uthmani dagger or small yeh.
 */
export function areArabicTokensEqual(
  userInput: string | null | undefined,
  target: string | null | undefined,
  options?: NormalizerOptions
): boolean {
  const normInput = normalizeArabic(userInput, options);
  const normTarget = normalizeArabic(target, options);
  if (!normInput || !normTarget) return false;
  if (normInput === normTarget) return true;
  if (!HAS_UTHMANI_AMBIGUITY.test(String(userInput ?? "")) && !HAS_UTHMANI_AMBIGUITY.test(String(target ?? ""))) return false;
  const inputSkeleton = arabicSkeleton(normInput);
  return inputSkeleton.length > 0 && inputSkeleton === arabicSkeleton(normTarget);
}
