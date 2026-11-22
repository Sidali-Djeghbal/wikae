# وِكَاء — Step 4 Film Production Package

**State:** ADHD mode on. Film wiring done (`index.html` prefers `wikae-film.mp4`, AR/EN VTT tracks ready, fallback `etude-film.mp4` works). **Blocked:** no in-env screen recorder/encoder to produce the final MP4. This package is the "record-ready" blueprint.

**Goal:** Beautiful bilingual (Arabic-led) walkthrough, ~90 s, ≤ 12 MB, 1920×1080, 30 fps, H.264 MP4 + AAC, dark UI.

## 1) Shot list & storyboard (~90 s)

| # | Time | Duration | Screen / Action | Visual notes | Narration focus |
|---|---:|---:|---|---|---|
| 1 | 00:00–00:07 | 7s | **Hero / landing** (`?lang=ar`, dark) | Slow parallax reveal, logo/wordmark وِكَاء crisp, cursor hovers hero proof | What Wikae is: a firm bond for memorization |
| 2 | 00:07–00:14 | 7s | **Mutashabihat proof** (hero card) | Click correct choice → green feedback animates; show Arabic ayah clearly | Mastering Mutashabihat with precise feedback |
| 3 | 00:14–00:28 | 14s | **Live deck / Mutashabihat section** (`#mutashabihat`/`#decks`) | Scroll to cards, answer 1–2 cards (pivotal completion/surah distinction), show rule/context | Active recall on real Mutashabihat, not rote flipping |
| 4 | 00:28–00:40 | 12s | **Study flow** (review session) | Show grading/result moment, FSRS-style "next review" feel, calm pace | Smart scheduling (FSRS-6) reviews before you forget |
| 5 | 00:40–00:52 | 12s | **Browse / collection** | Navigate a deck/list, show card types/organization, clean Arabic RTL UI | Your collection: Quran, matn, hadith, knowledge |
| 6 | 00:52–01:04 | 12s | **Stats** (`#stats`) | Charts animate in, retention/progress visible | Progress you can see, grounded in your history |
| 7 | 01:04–01:16 | 12s | **Anki import & Market** (`#anki`, `#market`) | Show "Import .apkg" mention/screen and free community market decks grid | Bring Anki history; discover free community decks |
| 8 | 01:16–01:30 | 14s | **Closing** (hero/download + offline/privacy) | Return to hero/download, quick flash of "offline/local/self-host" message, end on وِكَاء logo | Free, open-source, 100% offline & yours — Download Wikae |

## 2) Narration script (Arabic-led, bilingual-friendly)

- **AR (VO):**
  1. "وِكَاء… رِباطٌ يُحكِمُ حفظَك، ويُبيّنُ لك متشابهَ القرآن."
  2. "جرّب بطاقة المتشابهات: اختر الموضع الصحيح، وتلقَّ التصحيح فورًا."
  3. "تدرّب بالاستدعاء النشط على آياتٍ متشابهة، مع ضوابط وسياق يُثبّت الفرق."
  4. "تُحدِّد وِكَاء وقت المراجعة قبل النسيان بخوارزمية FSRS-6، فتراجع أقل… وتثبّت أكثر."
  5. "رتّب مجموعتك: قرآن، متون، حديث، وعلوم نافعة — بواجهة عربية واضحة."
  6. "تابع تقدّمك وإحصاءاتك، وشاهد أثر المراجعة مع الوقت."
  7. "استورد حزم Anki بسجلها، واستكشف متجر المجتمع المجاني."
  8. "وِكَاء مجاني ومفتوح المصدر، يعمل دون اتصال وبياناتك على جهازك. حمّل وِكَاء الآن."
- **EN (VO/captions parity):**
  1. "Wikae — a firm bond for your memorization and clear mastery of Mutashabihat."
  2. "Try a Mutashabihat card: pick the right match and get instant feedback."
  3. "Practice active recall on similar verses with rules and context that make the difference stick."
  4. "Wikae schedules reviews before you forget with FSRS-6—review less, retain more."
  5. "Organize your collection: Quran, matn, hadith, and knowledge—in a clear Arabic-first UI."
  6. "Track progress and stats, and see your retention grow over time."
  7. "Import your Anki decks with history and explore the free community market."
  8. "Wikae is free, open source, offline-first—your data stays on your device. Download Wikae."

## 3) Recording recipe (manual, ~60–120 min)

1. **Prep (10 min):** open app/site in Arabic/dark, 1920×1080, hide notifications, use a clean demo collection (Mutashabihat deck + stats populated).
2. **Record (30–60 min):** capture at 30 fps; slow, deliberate cursor moves; pause 1–2 s on key screens; record 2–3 takes per shot.
3. **Edit (20–40 min):** assemble per shot list, add subtle crossfades, keep text legible, normalize audio (if VO) or keep silent with captions.
4. **Export:** `site/src/assets/film/wikae-film.mp4` (H.264, 1080p, ~6–10 Mbps, AAC 128k if audio) target ≤ 12 MB.
5. **Captions:** sync final timings in `wikae-film.ar.vtt` and `wikae-film.en.vtt`.
6. **Ship:** `npm run site`, verify `#film` plays with AR/EN captions, then remove `etude-film.mp4` fallback in `site/src/index.html` if desired.

## 4) Quality checklist
- [ ] Arabic text crisp (Uthmani/Amiri) and RTL correct in every shot
- [ ] Correct Mutashabihat answer + feedback shown clearly
- [ ] No private data/notifications visible
- [ ] AR default captions, EN selectable; timings match audio/actions
- [ ] File ≤ 12 MB, plays inline on mobile & desktop
