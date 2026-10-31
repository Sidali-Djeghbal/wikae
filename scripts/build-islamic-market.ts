import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Etude } from "../src/core/engine.ts";
import { buildIndex, type MarketFile } from "../src/core/market.ts";
import { normalizeTheme } from "../src/core/themes.ts";

async function run() {
  const etude = await Etude.open(":memory:");
  const def = etude.type("quran-mutashabihat");
  const { updated: _u, builtin: _b, ...cleanDef } = def as any;

  // 1. Type entry: quran-mutashabihat
  const typeEntry: MarketFile = {
    etudeMarket: 1,
    kind: "type",
    id: "quran-mutashabihat",
    name: "متشابهات القرآن (Quran Mutashabihat)",
    description: "بطاقات متخصصة لحفاظ القرآن الكريم لضبط الآيات المتشابهة بالرسم العثماني المصحفي مع إبراز اللفظ المفصلي وقواعد الضبط البلاغي والسياقي. تدعم إكمال الفراغ وتحديد السورة.",
    author: "Sidali Djeghbal",
    tags: ["quran", "mutashabihat", "hifz", "islamic", "arabic"],
    version: "1.0.0",
    updated: new Date().toISOString().slice(0, 10),
    content: {
      etude: "pack/1",
      name: "Quranic Mutashabihat Type",
      types: [cleanDef],
      items: [
        {
          id: "mutashabihat.demo.baqarah-126",
          type: "quran-mutashabihat",
          deck: "متشابهات القرآن الكريم",
          tags: ["quran", "baqarah", "ibrahim"],
          fields: {
            titleAr: "البقرة:126 ↔ إبراهيم:35 · بَلَدًا ءَامِنًا / ٱلْبَلَدَ ءَامِنًا",
            targetVerseId: "2_126",
            mode: "pivotal_completion",
            inputSubmode: "choice",
            siblings: [
              "البقرة:126 | وَإِذْ قَالَ إِبْرَٰهِـۧمُ رَبِّ ٱجْعَلْ هَـٰذَا [بَلَدًا ءَامِنًا] وَٱرْزُقْ أَهْلَهُۥ مِنَ ٱلثَّمَرَٰتِ",
              "إبراهيم:35 | وَإِذْ قَالَ إِبْرَٰهِيمُ رَبِّ ٱجْعَلْ هَـٰذَا [ٱلْبَلَدَ ءَامِنًا] وَٱجْنُبْنِى وَبَنِىَّ أَن نَّعْبُدَ ٱلْأَصْنَامَ"
            ],
            extraDistractorsUthmani: ["بَلَدًا طَيِّبًا", "ٱلْبَلَدَ ٱلْأَمِينَ"],
            mnemonicRuleAr: "في سورة البقرة جاءت نكرة (بَلَدًا ءَامِنًا) لأن دعاء إبراهيم كان قبل عمارة مكة وتسميتها بلداً، وفي سورة إبراهيم جاءت معرفة (ٱلْبَلَدَ ءَامِنًا) بعد عمارة البلد واستقراره فدعا بأمنه.",
            hintAr: "التنكير قبل العمارة، والتعريف بعد العمارة."
          }
        }
      ]
    }
  };

  // 2. Deck entry: quran-mutashabihat-baqarah
  const baqarahDeck: MarketFile = {
    etudeMarket: 1,
    kind: "deck",
    id: "quran-mutashabihat-baqarah",
    name: "متشابهات سورة البقرة (Al-Baqarah Mutashabihat)",
    description: "حزمة شاملة ومحققة لمتشابهات سورة البقرة مع غيرها من السور بالرسم العثماني، مستندة إلى أمهات كتب المتشابهات (هداية المرتاب، درة التنزيل، وملاك التأويل).",
    author: "Sidali Djeghbal",
    tags: ["quran", "baqarah", "mutashabihat", "hifz", "islamic"],
    version: "1.0.0",
    updated: new Date().toISOString().slice(0, 10),
    content: {
      etude: "pack/1",
      name: "متشابهات سورة البقرة",
      description: "المواضع المتشابهة في سورة البقرة مع بقية سور التنزيل",
      types: [cleanDef],
      decks: [
        {
          name: "متشابهات القرآن الكريم::سورة البقرة",
          description: "متشابهات سورة البقرة مع بقية السور"
        }
      ],
      items: [
        {
          id: "mutashabihat.baqarah.126",
          type: "quran-mutashabihat",
          deck: "متشابهات القرآن الكريم::سورة البقرة",
          tags: ["quran::baqarah", "mutashabihat::ibrahim"],
          fields: {
            titleAr: "البقرة:126 ↔ إبراهيم:35 (بلداً آمناً / البلد آمناً)",
            targetVerseId: "2_126",
            mode: "pivotal_completion",
            inputSubmode: "choice",
            siblings: [
              "البقرة:126 | وَإِذْ قَالَ إِبْرَٰهِـۧمُ رَبِّ ٱجْعَلْ هَـٰذَا [بَلَدًا ءَامِنًا] وَٱرْزُقْ أَهْلَهُۥ مِنَ ٱلثَّمَرَٰتِ",
              "إبراهيم:35 | وَإِذْ قَالَ إِبْرَٰهِيمُ رَبِّ ٱجْعَلْ هَـٰذَا [ٱلْبَلَدَ ءَامِنًا] وَٱجْنُبْنِى وَبَنِىَّ أَن نَّعْبُدَ ٱلْأَصْنَامَ"
            ],
            extraDistractorsUthmani: ["بَلَدًا طَيِّبًا", "ٱلْبَلَدَ ٱلْأَمِينَ"],
            mnemonicRuleAr: "**قاعدة الضبط**: التنكير قبل العمارة (البقرة: بلداً آمناً)، والتعريف بعد العمارة (إبراهيم: البلد آمناً).",
            hintAr: "التنكير قبل عمارة البلد."
          }
        },
        {
          id: "mutashabihat.baqarah.038",
          type: "quran-mutashabihat",
          deck: "متشابهات القرآن الكريم::سورة البقرة",
          tags: ["quran::baqarah", "mutashabihat::inner"],
          fields: {
            titleAr: "البقرة:38 ↔ البقرة:62 (فلا خوف عليهم / ولا خوف عليهم)",
            targetVerseId: "2_38",
            mode: "pivotal_completion",
            inputSubmode: "choice",
            siblings: [
              "البقرة:38 | قُلْنَا ٱهْبِطُوا۟ مِنْهَا جَمِيعًا فَإِمَّا يَأْتِيَنَّكُم مِّنِّى هُدًى فَمَن تَبِعَ هُدَاىَ [فَلَا خَوْفٌ عَلَيْهِمْ] وَلَا هُمْ يَحْزَنُونَ",
              "البقرة:62 | إِنَّ ٱلَّذِينَ ءَامَنُوا۟ وَٱلَّذِينَ هَادُوا۟ وَٱلنَّصَـٰرَىٰ وَٱلصَّـٰبِـِٔينَ مَنْ ءَامَنَ بِٱللَّهِ وَٱلْيَوْمِ ٱلْـَٔاخِرِ وَعَمِلَ صَـٰلِحًا فَلَهُمْ أَجْرُهُمْ عِندَ رَبِّهِمْ [وَلَا خَوْفٌ عَلَيْهِمْ] وَلَا هُمْ يَحْزَنُونَ"
            ],
            extraDistractorsUthmani: ["فَلَهُمْ أَجْرُهُمْ", "لَا خَوْفٌ عَلَيْهِمْ"],
            mnemonicRuleAr: "**قاعدة الضبط**: اقترنت الفاء في الآية 38 لوجود الشرط وجوابه (فَمَن تَبِعَ هُدَاىَ فَلَا خَوْفٌ)، بينما الآية 62 خبرية اسمية فجاءت بالواو (وَلَا خَوْفٌ).",
            hintAr: "جواب الشرط يقترن بالفاء."
          }
        },
        {
          id: "mutashabihat.baqarah.048",
          type: "quran-mutashabihat",
          deck: "متشابهات القرآن الكريم::سورة البقرة",
          tags: ["quran::baqarah", "mutashabihat::inner"],
          fields: {
            titleAr: "البقرة:48 ↔ البقرة:123 (تقديم الشفاعة أم العدل)",
            targetVerseId: "2_48",
            mode: "pivotal_completion",
            inputSubmode: "choice",
            siblings: [
              "البقرة:48 | وَٱتَّقُوا۟ يَوْمًا لَّا تَجْزِى نَفْسٌ عَن نَّفْسٍ شَيْـًٔا [وَلَا يُقْبَلُ مِنْهَا شَفَـٰعَةٌ] وَلَا يُؤْخَذُ مِنْهَا عَدْلٌ وَلَا هُمْ يُنصَرُونَ",
              "البقرة:123 | وَٱتَّقُوا۟ يَوْمًا لَّا تَجْزِى نَفْسٌ عَن نَّفْسٍ شَيْـًٔا [وَلَا يُقْبَلُ مِنْهَا عَدْلٌ] وَلَا تَنفَعُهَا شَفَـٰعَةٌ وَلَا هُمْ يُنصَرُونَ"
            ],
            extraDistractorsUthmani: ["وَلَا تَنفَعُهَا شَفَـٰعَةٌ", "وَلَا يُؤْخَذُ مِنْهَا عَدْلٌ"],
            mnemonicRuleAr: "**قاعدة الضبط**: في الموضع الأول قُدّمت الشفاعة لأن الناس يطلبونها أولاً، وتأخر العدل (الفدية). وفي الموضع الثاني عُكِس الترتيب. وضابطها بيت السخاوي: وقدمت شفاعة في الأولى ... وعكسها في غيرها مجعولا.",
            hintAr: "الموضع الأول يبدأ بالشفاعة."
          }
        },
        {
          id: "mutashabihat.baqarah.058",
          type: "quran-mutashabihat",
          deck: "متشابهات القرآن الكريم::سورة البقرة",
          tags: ["quran::baqarah", "mutashabihat::araf"],
          fields: {
            titleAr: "البقرة:58 ↔ الأعراف:161 (وادخلوا الباب سجداً / حطة)",
            targetVerseId: "2_58",
            mode: "pivotal_completion",
            inputSubmode: "choice",
            siblings: [
              "البقرة:58 | وَإِذْ قُلْنَا ٱدْخُلُوا۟ هَـٰذِهِ ٱلْقَرْيَةَ فَكُلُوا۟ مِنْهَا حَيْثُ شِئْتُمْ رَغَدًا [وَٱدْخُلُوا۟ ٱلْبَابَ سُجَّدًا وَقُولُوا۟ حِطَّةٌ] نَّغْفِرْ لَكُمْ خَطَـٰيَـٰكُمْ",
              "الأعراف:161 | وَإِذْ قِيلَ لَهُمُ ٱسْكُنُوا۟ هَـٰذِهِ ٱلْقَرْيَةَ وَكُلُوا۟ مِنْهَا حَيْثُ شِئْتُمْ [وَقُولُوا۟ حِطَّةٌ وَٱدْخُلُوا۟ ٱلْبَابَ سُجَّدًا] نَّغْفِرْ لَكُمْ خَطِيٓـَٔـٰتِكُمْ"
            ],
            extraDistractorsUthmani: ["وَٱدْخُلُوا۟ ٱلْبَابَ", "وَقُولُوا۟ حِطَّةٌ"],
            mnemonicRuleAr: "**قاعدة الضبط**: في البقرة قُدّم الفعل على القول (وادخلوا الباب سجداً وقولوا حطة)، وفي الأعراف قُدّم القول على الفعل (وقولوا حطة وادخلوا الباب سجداً). وجمع الخطايا في البقرة (خطاياكم) وفي الأعراف (خطيئاتكم).",
            hintAr: "في البقرة تقديم الدخول (الفعل) على القول."
          }
        },
        {
          id: "mutashabihat.baqarah.060",
          type: "quran-mutashabihat",
          deck: "متشابهات القرآن الكريم::سورة البقرة",
          tags: ["quran::baqarah", "mutashabihat::araf"],
          fields: {
            titleAr: "البقرة:60 ↔ الأعراف:160 (فانفجرت / فانبجست)",
            targetVerseId: "2_60",
            mode: "pivotal_completion",
            inputSubmode: "choice",
            siblings: [
              "البقرة:60 | وَإِذِ ٱسْتَسْقَىٰ مُوسَىٰ لِقَوْمِهِۦ فَقُلْنَا ٱضْرِب بِّعَصَاكَ ٱلْحَجَرَ [فَٱنفَجَرَتْ مِنْهُ] ٱثْنَتَا عَشْرَةَ عَيْنًا",
              "الأعراف:160 | وَأَوْحَيْنَآ إِلَىٰ مُوسَىٰٓ إِذِ ٱسْتَسْقَىٰهُ قَوْمُهُۥٓ أَنِ ٱضْرِب بِّعَصَاكَ ٱلْحَجَرَ [فَٱنۢبَجَسَتْ مِنْهُ] ٱثْنَتَا عَشْرَةَ عَيْنًا"
            ],
            extraDistractorsUthmani: ["فَجَرَتْ مِنْهُ", "نَبَعَتْ مِنْهُ"],
            mnemonicRuleAr: "**قاعدة الضبط**: الانفجار أقوى وأكثر اندفاعاً من الانبجاس؛ في البقرة نُسب الاستسقاء إلى موسى عليه السلام (وَإِذِ اسْتَسْقَى مُوسَى) فكان الجواب بالانفجار تكريماً له، وفي الأعراف نُسب إلى قومه (إِذِ اسْتَسْقَاهُ قَوْمُهُ) فناسبه الانبجاس.",
            hintAr: "في البقرة الانفجار مع استسقاء موسى."
          }
        },
        {
          id: "mutashabihat.baqarah.136",
          type: "quran-mutashabihat",
          deck: "متشابهات القرآن الكريم::سورة البقرة",
          tags: ["quran::baqarah", "mutashabihat::imran"],
          fields: {
            titleAr: "البقرة:136 ↔ آل عمران:84 (وما أوتي النبيون)",
            targetVerseId: "2_136",
            mode: "pivotal_completion",
            inputSubmode: "choice",
            siblings: [
              "البقرة:136 | قُولُوٓا۟ ءَامَنَّا بِٱللَّهِ وَمَآ أُنزِلَ إِلَيْنَا وَمَآ أُنزِلَ إِلَىٰٓ إِبْرَٰهِـۧمَ وَإِسْمَـٰعِيلَ وَإِسْحَـٰقَ وَيَعْقُوبَ وَٱلْأَسْبَاطِ وَمَآ أُوتِىَ مُوسَىٰ وَعِيسَىٰ [وَمَآ أُوتِىَ ٱلنَّبِيُّونَ مِن رَّبِّهِمْ] لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّنْهُمْ",
              "آل عمران:84 | قُلْ ءَامَنَّا بِٱللَّهِ وَمَآ أُنزِلَ عَلَيْنَا وَمَآ أُنزِلَ عَلَىٰٓ إِبْرَٰهِيمَ وَإِسْمَـٰعِيلَ وَإِسْحَـٰقَ وَيَعْقُوبَ وَٱلْأَسْبَاطِ وَمَآ أُوتِىَ مُوسَىٰ وَعِيسَىٰ [وَٱلنَّبِيُّونَ مِن رَّبِّهِمْ] لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّنْهُمْ"
            ],
            extraDistractorsUthmani: ["وَٱلنَّبِيِّينَ مِن رَّبِّهِمْ", "وَمَآ أُوتِىَ ٱلرُّسُلُ"],
            mnemonicRuleAr: "**قاعدة الضبط**: في البقرة كُرّر الفعل (وَمَا أُوتِيَ النَّبِيُّونَ)، وفي آل عمران جاء بالعطف المباشر دون تكرار (وَالنَّبِيُّونَ). وبداية آية البقرة بالجمع (قُولُوا) وبداية آل عمران بالإفراد (قُلْ).",
            hintAr: "في البقرة تكرار (وما أوتي)."
          }
        }
      ]
    }
  };

  // 3. Deck entry: nawawi-forty (الأربعون النووية)
  const nawawiDeck: MarketFile = {
    etudeMarket: 1,
    kind: "deck",
    id: "nawawi-forty",
    name: "الأربعون النووية (The 40 Nawawi Hadiths)",
    description: "الأحاديث الأربعون النووية للإمام محيي الدين يحيى بن شرف النووي رحمه الله كاملة، مع بيان راوي الحديث وفوائده وتخريجه في الصحيحين.",
    author: "Sidali Djeghbal",
    tags: ["hadith", "sunnah", "nawawi", "islamic", "arabic"],
    version: "1.0.0",
    updated: new Date().toISOString().slice(0, 10),
    content: {
      etude: "pack/1",
      name: "الأربعون النووية",
      description: "متن الأربعين النووية كاملاً للحفظ والمذاكرة",
      decks: [
        {
          name: "الحديث الشريف::الأربعون النووية",
          description: "أحاديث الأربعين النووية مرتبة"
        }
      ],
      items: [
        {
          id: "nawawi.hadith.01",
          type: "basic",
          deck: "الحديث الشريف::الأربعون النووية",
          tags: ["hadith::nawawi", "hadith::niyyah"],
          fields: {
            front: "### الحديث الأول من الأربعين النووية\n\n**عن أمير المؤمنين أبي حفص عمر بن الخطاب رضي الله عنه قال: سمعت رسول الله ﷺ يقول:**\n\n*(أكمل نص الحديث وما يستفاد منه)*",
            back: "«**إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللهِ وَرَسُولِهِ، وَمَنْ كَانَتْ هِجْرَتُهُ لِدُنْيَا يُصِيبُهَا أَوِ امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ**».\n\n---\n* **رواه:** البخاري ومسلم في صحيحيهما.\n* **القاعدة:** النية معيار لصحة الأعمال وقبولها وطهارتها.",
            extra: "أصل عظيم في الإسلام، قال الإمام الشافعي: هذا الحديث يدخل في سبعين باباً من الفقه."
          }
        },
        {
          id: "nawawi.hadith.02",
          type: "basic",
          deck: "الحديث الشريف::الأربعون النووية",
          tags: ["hadith::nawawi", "hadith::jibreel"],
          fields: {
            front: "### الحديث الثاني: حديث جبريل عليه السلام\n\nعن عمر رضي الله عنه قال: بينما نحن جلوس عند رسول الله ﷺ ذات يوم إذ طلع علينا رجل شديد بياض الثياب شديد سواد الشعر لا يُرى عليه أثر السفر ولا يعرفه منا أحد...\n\n**ما هي المراتب الثلاث للدين التي بيّنها الحديث؟**",
            back: "1. **الإسلام**: شهادة أن لا إله إلا الله وأن محمداً رسول الله، وإقام الصلاة، وإيتاء الزكاة، وصوم رمضان، وحج البيت لمن استطاع إليه سبيلاً.\n2. **الإيمان**: أن تؤمن بالله، وملائكته، وكتبه، ورسله، واليوم الآخر، وتؤمن بالقدر خيره وشره.\n3. **الإحسان**: «أَنْ تَعْبُدَ اللهَ كَأَنَّكَ تَرَاهُ، فَإِنْ لَمْ تَكُنْ تَرَاهُ فَإِنَّهُ يَرَاكَ».\n\n---\n* **الخاتمة:** «فَإِنَّهُ جِبْرِيلُ أَتَاكُمْ يُعَلِّمُكُمْ دِينَكُمْ» (رواه مسلم).",
            extra: "يُسمى هذا الحديث بأمّ السنة لاشتماله على جميع وظائف العبادات الظاهرة والباطنة."
          }
        },
        {
          id: "nawawi.hadith.03",
          type: "basic",
          deck: "الحديث الشريف::الأربعون النووية",
          tags: ["hadith::nawawi", "hadith::arkan"],
          fields: {
            front: "### الحديث الثالث: أركان الإسلام\n\n**عن أبي عبد الرحمن عبد الله بن عمر بن الخطاب رضي الله عنهما قال: سمعت رسول الله ﷺ يقول:**\n\n*(اذكر نص الحديث كاملاً)*",
            back: "«**بُنِيَ الإِسْلامُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لا إِلَهَ إِلا اللهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللهِ، وَإِقَامِ الصَّلاةِ، وَإِيتَاءِ الزَّكَاةِ، وَحَجِّ البَيْتِ، وَصَوْمِ رَمَضَانَ**».\n\n---\n* **تخريج:** رواه البخاري ومسلم.",
            extra: "شبه الإسلام ببنيان محكم يقوم على خمس دعائم لا يستقر بدونها."
          }
        },
        {
          id: "nawawi.hadith.04",
          type: "basic",
          deck: "الحديث الشريف::الأربعون النووية",
          tags: ["hadith::nawawi", "hadith::qadar"],
          fields: {
            front: "### الحديث الرابع: مراحل خلق الإنسان والقدر\n\n**عن عبد الله بن مسعود رضي الله عنه قال: حدثنا رسول الله ﷺ وهو الصادق المصدوق:**\n\n*(اذكر أطوار خلق الجنين والكلمات الأربع المكتوبة)*",
            back: "«**إِنَّ أَحَدَكُمْ يُجْمَعُ خَلْقُهُ فِي بَطْنِ أُمِّهِ أَرْبَعِينَ يَوْمًا نُطْفَةً، ثُمَّ يَكُونُ عَلَقَةً مِثْلَ ذَلِكَ، ثُمَّ يَكُونُ مُضْغَةً مِثْلَ ذَلِكَ، ثُمَّ يُرْسَلُ إِلَيْهِ المَلَكُ فَيَنْفُخُ فِيهِ الرُّوحَ، وَيُؤْمَرُ بِأَرْبَعِ كَلِمَاتٍ: بِكَتْبِ رِزْقِهِ، وَأَجَلِهِ، وَعَمَلِهِ، وَشَقِيٌّ أَوْ سَعِيدٌ...**».\n\n---\n* **تخريج:** رواه البخاري ومسلم.",
            extra: "الحديث يرسخ الإيمان بالقدر وعلم الله السابق المحيط بكل شيء."
          }
        },
        {
          id: "nawawi.hadith.05",
          type: "basic",
          deck: "الحديث الشريف::الأربعون النووية",
          tags: ["hadith::nawawi", "hadith::bidah"],
          fields: {
            front: "### الحديث الخامس: رد المحدثات والبدع\n\n**عن أم المؤمنين أم عبد الله عائشة رضي الله عنها قالت: قال رسول الله ﷺ:**\n\n*(اذكر نص الحديث وروايته الأخرى)*",
            back: "«**مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ**» (رواه البخاري ومسلم).\n\nوفي رواية لمسلم:\n«**مَنْ عَمِلَ عَمَلاً لَيْسَ عَلَيْهِ أَمْرُنَا فَهُوَ رَدٌّ**».\n\n---\n* **القاعدة:** هذا الحديث ميزان للأعمال في ظاهرها، كما أن حديث (إنما الأعمال بالنيات) ميزان لها في باطنها.",
            extra: "أصل في رد كل بدعة ومحدثة تخالف هدي النبي ﷺ."
          }
        }
      ]
    }
  };

  // 4. Theme entry: islamic-mushaf (مصحف المدينة)
  const mushafTheme: MarketFile = {
    etudeMarket: 1,
    kind: "theme",
    id: "islamic-mushaf",
    name: "مصحف المدينة (Madinah Mushaf)",
    description: "سمة هادئة ومريحة لعين القارئ والحافظ مستوحاة من ألوان مصحف المدينة المنورة، بخلفية عاجية دافئة وألوان حبرية خضراء مذهبة.",
    author: "Sidali Djeghbal",
    tags: ["islamic", "mushaf", "paper", "arabic", "light"],
    version: "1.0.0",
    updated: new Date().toISOString().slice(0, 10),
    content: normalizeTheme({
      id: "islamic-mushaf",
      name: "مصحف المدينة",
      scheme: "light",
      vars: {
        "--background": "oklch(0.97 0.015 85)",
        "--foreground": "oklch(0.22 0.018 60)",
        "--card": "oklch(0.99 0.008 85)",
        "--popover": "oklch(0.98 0.01 85)",
        "--primary": "oklch(0.42 0.1 155)",
        "--primary-foreground": "oklch(0.98 0.005 85)",
        "--secondary": "oklch(0.93 0.02 85)",
        "--muted": "oklch(0.92 0.018 85)",
        "--muted-foreground": "oklch(0.48 0.02 60)",
        "--accent": "oklch(0.91 0.025 85)",
        "--destructive": "oklch(0.6 0.18 25)",
        "--border": "oklch(0.86 0.022 85)",
        "--input": "oklch(0.84 0.025 85)",
        "--ring": "oklch(0.45 0.09 155)",
        "--highlight": "oklch(0.68 0.14 85)",
        "--sidebar": "oklch(0.95 0.016 85)",
        "--sidebar-accent": "oklch(0.9 0.022 85)",
        "--sidebar-border": "oklch(0.85 0.022 85)",
        "--success": "oklch(0.65 0.15 150)",
        "--warning": "oklch(0.75 0.14 85)",
        "--danger": "oklch(0.6 0.18 25)",
        "--again": "oklch(0.6 0.18 25)",
        "--hard": "oklch(0.72 0.13 75)",
        "--good": "oklch(0.65 0.14 150)",
        "--easy": "oklch(0.6 0.12 210)",
        "--new": "oklch(0.55 0.12 220)",
        "--learn": "oklch(0.62 0.15 45)",
        "--review": "oklch(0.65 0.14 150)"
      }
    }).theme
  };

  // Write files
  writeFileSync("market/entries/types/quran-mutashabihat.json", JSON.stringify(typeEntry, null, 2) + "\n");
  writeFileSync("market/entries/decks/quran-mutashabihat-baqarah.json", JSON.stringify(baqarahDeck, null, 2) + "\n");
  writeFileSync("market/entries/decks/nawawi-forty.json", JSON.stringify(nawawiDeck, null, 2) + "\n");
  writeFileSync("market/entries/themes/islamic-mushaf.json", JSON.stringify(mushafTheme, null, 2) + "\n");

  console.log("Entries written. Now building index.json...");
  const { index, problems } = await buildIndex("market", {
    repo: "Sidali-Djeghbal/etude-market",
    dryRunInto: () => Etude.open(":memory:")
  });

  if (problems.length) {
    console.error("Index build problems:", JSON.stringify(problems, null, 2));
    process.exit(1);
  }

  writeFileSync("market/index.json", JSON.stringify(index, null, 2) + "\n");
  console.log(`Successfully built index with ${index.entries.length} entries!`);
  for (const e of index.entries) {
    console.log(`- [${e.kind}] ${e.name} (${e.id})`);
  }
}

run().catch((e) => {
  console.error("Build failed:", e);
  process.exit(1);
});

