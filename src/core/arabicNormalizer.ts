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
  /** Convert Uthmani Dagger Alef (\u0670) to standard Alef (ا) when normalizing Uthmani script */
  convertDaggerAlef?: boolean;
  /** Normalize isolated Hamza followed by Alef (ءا -> ا) */
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
export const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
export const PUNCTUATION_REGEX = /[.,/#!$%^&*;:{}=\-_`~()؟،؛۝۞]/g;

/**
 * Normalizes an Arabic string according to the provided options.
 */
export function normalizeArabic(text: string | null | undefined, options: NormalizerOptions = {}): string {
  if (!text) return "";
  const opts: Required<NormalizerOptions> = { ...DEFAULT_OPTIONS, ...options };
  let s = String(text);

  // 1. Convert Dagger Alef (\u0670) to standard Alef if requested.
  // In Uthmani script (e.g. إِمْلَـٰقٍ or هَـٰذَا or ٱلرَّحْمَـٰنِ), the dagger alef
  // represents the long vowel Alef that users type on a standard keyboard.
  if (opts.convertDaggerAlef) {
    s = s.replace(/\u0670/g, "ا");
  }

  // 2. Strip Tatweel / Kashida (ـ)
  if (opts.stripTatweel) {
    s = s.replace(TATWEEL_REGEX, "");
  }

  // 3. Strip Tashkeel, Harakat, and Quranic annotations
  if (opts.stripTashkeel) {
    s = s.replace(TASHKEEL_REGEX, "");
  }

  // 4. Normalize Alef variants: [أإآٱٲٳ] -> ا
  if (opts.normalizeAlef) {
    s = s.replace(ALEF_VARIANTS_REGEX, "ا");
  }

  // 5. Handle isolated Hamza + Alef: ءا -> ا (e.g. ءَامِنًا -> ءامنا -> امنا)
  if (opts.normalizeHamzaAlef) {
    s = s.replace(/ءا/g, "ا");
  }

  // 6. Collapse duplicate consecutive Alefs resulting from conversions
  s = s.replace(/ا{2,}/g, "ا");

  // 7. Normalize Alef Maksura: ى -> ي
  if (opts.normalizeAlefMaksura) {
    s = s.replace(/ى/g, "ي");
  }

  // 8. Normalize Teh Marbuta: ة -> ه
  if (opts.normalizeTehMarbuta) {
    s = s.replace(/ة/g, "ه");
  }

  // 9. Strip zero-width characters and punctuation
  s = s.replace(ZERO_WIDTH_REGEX, "");
  if (opts.stripPunctuation) {
    s = s.replace(PUNCTUATION_REGEX, " ");
  }

  // 10. Normalize whitespace
  if (opts.normalizeWhitespace) {
    s = s.replace(/\s+/g, " ").trim();
  }

  return s;
}

/**
 * Strips only Tashkeel / Harakat and Quranic marks, preserving letter forms and Tatweel.
 */
export function stripTashkeel(text: string | null | undefined): string {
  if (!text) return "";
  return String(text).replace(TASHKEEL_REGEX, "");
}

/**
 * Compares user input with a target verse or phrase using intelligent Arabic normalization.
 */
export function areArabicTokensEqual(
  userInput: string | null | undefined,
  target: string | null | undefined,
  options?: NormalizerOptions
): boolean {
  const normInput = normalizeArabic(userInput, options);
  const normTarget = normalizeArabic(target, options);
  return normInput === normTarget && normInput.length > 0;
}

