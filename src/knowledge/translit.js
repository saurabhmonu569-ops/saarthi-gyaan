/**
 * SAARTHI — Hinglish (Roman Hindi) → Devanagari transliteration
 * =====================================================================
 * KYUN (naapa hua, andaaza nahi — 2026-08-03 calibration):
 * Poora corpus Devanagari mein hai. Jab user Roman mein poochta hai
 * ("gussa kaise shant karein"), embedding model use na Hindi maanta hai
 * na English — score girkar shor ke barabar aa jaata hai:
 *
 *     gussa kaise shant karein      →  0.4370
 *     गुस्सा कैसे शांत करें            →  0.6595   (+0.2225)
 *     mrityu ke baad aatma...       →  0.5038
 *     मृत्यु के बाद आत्मा...           →  0.7479   (+0.2441)
 *
 * Aausat faayda +0.1490. Iske bina koi bhi relevance threshold Hinglish
 * sawaalon ke saare granth chheen lega — jabki jawab granthon mein
 * maujood hai. Aur "Ek IAS aspirant baar-baar fail ho raha hai" jaisa
 * andaz SAARTHI ke asli users ka aam tarika hai.
 *
 * DESIGN:
 *  1. Pehle se Devanagari hai? → chhoo mat.
 *  2. Aam Hindi shabdon ki dictionary (sabse zyada aane wale, aur wahi
 *     jinhe akshar-dar-akshar badalna sabse zyada bigaadta hai —
 *     "kaise" → "कैसे", naive tareeke se "कऐसे" ban jaata).
 *  3. Bache hue shabd akshar-dar-akshar (syllable) badle jaate hain.
 *
 * YEH PERFECT NAHI HAI — aur hone ki zaroorat bhi nahi. Iska kaam sirf
 * itna hai ki query embedding space mein corpus ke paas pahunch jaye.
 * "करेइन" aur "करें" ka vector kaafi paas hota hai; "karein" ka nahi.
 */

// ── 1. Aam Hindi shabd (function words + sawaal wale shabd) ───────────
// Yeh sabse zyada aate hain aur syllable-rule inhe sabse zyada bigaadta
// hai, isliye seedha map. Yahi list sabse zyada faayda deti hai.
const WORDS = {
  // ginti / aam
  ek: "एक", do: "दो", teen: "तीन", char: "चार", paanch: "पाँच",
  // sawaal
  kya: "क्या", kyu: "क्यों", kyun: "क्यों", kyon: "क्यों", kaise: "कैसे", kese: "कैसे",
  kaisa: "कैसा", kaisi: "कैसी", kab: "कब", kahan: "कहाँ", kaha: "कहाँ", kaun: "कौन",
  kon: "कौन", kitna: "कितना", kitni: "कितनी", kitne: "कितने", konsa: "कौनसा",
  // hona
  hai: "है", hain: "हैं", tha: "था", thi: "थी", the: "थे", hoga: "होगा", hogi: "होगी",
  ho: "हो", hona: "होना", hota: "होता", hoti: "होती", hote: "होते", huaa: "हुआ",
  hua: "हुआ", hui: "हुई", hue: "हुए",
  // sarvanaam
  main: "मैं", mai: "मैं", mera: "मेरा", meri: "मेरी", mere: "मेरे", mujhe: "मुझे",
  mujhko: "मुझको", hum: "हम", hamara: "हमारा", hamari: "हमारी", humein: "हमें",
  aap: "आप", aapka: "आपका", aapki: "आपकी", aapke: "आपके", tum: "तुम",
  woh: "वह", wo: "वह", yeh: "यह", ye: "यह", uska: "उसका", uski: "उसकी",
  iska: "इसका", iski: "इसकी", unka: "उनका", inka: "इनका", koi: "कोई", kuch: "कुछ",
  sab: "सब", sabhi: "सभी", apna: "अपना", apni: "अपनी", apne: "अपने",
  // vibhakti
  ka: "का", ki: "की", ke: "के", ko: "को", se: "से", mein: "में", me: "में",
  par: "पर", pe: "पे", tak: "तक", liye: "लिए", ke_liye: "के लिए", saath: "साथ",
  bina: "बिना", jaisa: "जैसा", jaise: "जैसे", jaisi: "जैसी",
  // aam kriya
  kar: "कर", karo: "करो", karna: "करना", karta: "करता", karti: "करती",
  karte: "करते", karein: "करें", kare: "करे", karu: "करूँ", karun: "करूँ",
  karunga: "करूँगा", kiya: "किया", kiye: "किए", ki_gayi: "की गई",
  bata: "बता", bataye: "बताइए", bataiye: "बताइए", batao: "बताओ", batana: "बताना",
  samjhaye: "समझाइए", samjhao: "समझाओ", samjhana: "समझाना", samajh: "समझ",
  chahiye: "चाहिए", chahta: "चाहता", chahti: "चाहती", milta: "मिलता", mile: "मिले",
  raha: "रहा", rahi: "रही", rahe: "रहे", rehta: "रहता", rehna: "रहना",
  gaya: "गया", gayi: "गई", jana: "जाना", jata: "जाता", jaati: "जाती",
  dena: "देना", deta: "देता", diya: "दिया", lena: "लेना", lu: "लूँ", lun: "लूँ",
  hoke: "होके", paye: "पाए", sakta: "सकता", sakti: "सकती", sakte: "सकते",
  // aam vishesan / kriya-visheshan
  nahi: "नहीं", nahin: "नहीं", na: "ना", haan: "हाँ", han: "हाँ",
  aur: "और", ya: "या", lekin: "लेकिन", par_lekin: "लेकिन", agar: "अगर",
  toh: "तो", to: "तो", bhi: "भी", hi: "ही", phir: "फिर", fir: "फिर",
  ab: "अब", abhi: "अभी", baad: "बाद", pehle: "पहले", pahle: "पहले",
  bahut: "बहुत", bohot: "बहुत", zyada: "ज़्यादा", jyada: "ज़्यादा", kam: "कम",
  accha: "अच्छा", achha: "अच्छा", bura: "बुरा", sahi: "सही", galat: "ग़लत",
  baar: "बार", roz: "रोज़", hamesha: "हमेशा", kabhi: "कभी", sirf: "सिर्फ़",
  // aatmik / SAARTHI ke aam shabd
  bhagwan: "भगवान", ishwar: "ईश्वर", dharm: "धर्म", karm: "कर्म", karma: "कर्म",
  gyan: "ज्ञान", moksh: "मोक्ष", atma: "आत्मा", aatma: "आत्मा", mann: "मन",
  man: "मन", jeevan: "जीवन", jivan: "जीवन", mrityu: "मृत्यु", janm: "जन्म",
  shanti: "शांति", dhyan: "ध्यान", pooja: "पूजा", puja: "पूजा", mantra: "मंत्र",
  vrat: "व्रत", paap: "पाप", punya: "पुण्य", guru: "गुरु", shishya: "शिष्य",
  gussa: "गुस्सा", krodh: "क्रोध", darr: "डर", dar: "डर", dukh: "दुख",
  sukh: "सुख", prem: "प्रेम", pyar: "प्यार", ahankar: "अहंकार", lobh: "लोभ",
  moh: "मोह", shanti_ke: "शांति के", parivar: "परिवार", ghar: "घर",
  maa: "माँ", pita: "पिता", beta: "बेटा", beti: "बेटी", bhai: "भाई", behen: "बहन",
  shaadi: "शादी", shadi: "शादी", kaam: "काम", paisa: "पैसा", padhai: "पढ़ाई",
  pariksha: "परीक्षा", safal: "सफल", asafal: "असफल", fail: "असफल",
  vidyarthi: "विद्यार्थी", chhatra: "छात्र", jyotish: "ज्योतिष", grah: "ग्रह",
  shani: "शनि", upay: "उपाय", totka: "टोटका", shlok: "श्लोक", shloka: "श्लोक",
  granth: "ग्रंथ", ved: "वेद", puran: "पुराण", gita: "गीता", ramayan: "रामायण",
};

// ── 1b. Corpus se bana lexicon (scripts/build-lexicon.mjs) ────────────
// 24 granthon ke 6,000 sabse aam Devanagari shabd, Roman "fuzzy key" ke
// saath. Yeh hamara "kya yeh shabd sach mein Hindi hai?" detector hai.
import LEXICON from "./lexicon.js";

/**
 * Hijje ke aam farak mita do — "kitab" aur "kitaab" ek hi key par aayein.
 * NOTE: yeh build-lexicon.mjs ke fuzzyKey se HUBAHU milna chahiye, warna
 * lookup fail ho jayega. Dono jagah saath mein badalna.
 */
function fuzzyKey(roman) {
  let s = roman.toLowerCase().replace(/[^a-z]/g, "");
  s = s.replace(/aa/g, "a").replace(/ee/g, "i").replace(/ii/g, "i")
       .replace(/oo/g, "u").replace(/uu/g, "u").replace(/ou/g, "au");
  s = s.replace(/w/g, "v");
  s = s.replace(/(.)\1+/g, "$1");
  s = s.replace(/a$/, "");
  return s;
}

// ── 2. Syllable rules — AB ISTEMAL NAHI HOTE (neeche wajah dekhein) ───
// NAAPA HUA NATEEJA (2026-08-03): har anjaan shabd ko akshar-dar-akshar
// Devanagari mein badalne se asli Hinglish sawaalon ka 89% signal wapas
// aaya — PAR kachre sawaalon ka score bhi utna hi badh gaya:
//     "OCR me error ho to AI kya kare"   0.4541 → 0.5831  (+0.1290)
//     "React useState hook kaise use..."  0.4682 → 0.5411  (+0.0728)
// Kyunki "error" → "एर्रोर" jaisi bematlab Devanagari banti hai, aur
// corpus OCR-scanned hai — usme waisa hi garbled text bhara pada hai.
// Bakwas, kachre se match kar leti hai. Separation ULTA kharab ho gaya.
//
// Isliye ab: sirf pehchane hue Hindi shabd badalte hain. Baaki (English,
// tech, naam) Latin mein hi rehte hain — Devanagari bakwas banti hi nahi.
// Yeh code sirf reference ke liye rakha hai, chalta nahi.
const CONS = [
  ["kshh", "क्ष"], ["ksh", "क्ष"], ["chh", "छ"], ["shh", "ष"], ["gy", "ज्ञ"],
  ["tr", "त्र"], ["dr", "द्र"], ["pr", "प्र"], ["kr", "क्र"], ["br", "ब्र"],
  ["shr", "श्र"], ["str", "स्त्र"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"],
  ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["zh", "झ"],
  ["k", "क"], ["g", "ग"], ["c", "च"], ["j", "ज"], ["t", "त"], ["d", "द"],
  ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"],
  ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ"],
  ["z", "ज़"], ["q", "क"], ["x", "क्स"],
];
// [roman, matra, independent]
const VOW = [
  ["aa", "ा", "आ"], ["ai", "ै", "ऐ"], ["au", "ौ", "औ"], ["ee", "ी", "ई"],
  ["ii", "ी", "ई"], ["oo", "ू", "ऊ"], ["uu", "ू", "ऊ"], ["ou", "ौ", "औ"],
  ["ri", "ृ", "ऋ"],
  ["a", "", "अ"], ["i", "ि", "इ"], ["e", "े", "ए"], ["u", "ु", "उ"], ["o", "ो", "ओ"],
];
const HALANT = "्";

function translitWord(w) {
  const s = w.toLowerCase();
  let out = "";
  let i = 0;
  let lastWasCons = false;

  while (i < s.length) {
    let matched = false;

    // consonant?
    for (const [rom, dev] of CONS) {
      if (s.startsWith(rom, i)) {
        if (lastWasCons) out += HALANT;   // do vyanjan lagatar → halant
        out += dev;
        i += rom.length;
        lastWasCons = true;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // vowel?
    for (const [rom, matra, indep] of VOW) {
      if (s.startsWith(rom, i)) {
        out += lastWasCons ? matra : indep;
        i += rom.length;
        lastWasCons = false;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    out += s[i];   // digit / punctuation / anjaan akshar
    i++;
    lastWasCons = false;
  }
  return out;
}

const DEVA_RE = /[ऀ-ॿ]/;

/**
 * Text mein Devanagari kitna hissa hai (0..1).
 *
 * BUG FIX (2026-08-03, test ne pakda): pehle numerator aur denominator do
 * ALAG cheezein gin rahe the —
 *     denominator: \p{L}      (sirf akshar)
 *     numerator:   [ऀ-ॿ]      (akshar + matra + halant, sab)
 * "नमस्ते" mein 6 Devanagari code points hain par \p{L} sirf 4 ginta hai
 * (् aur े "mark" hain, "letter" nahi) — to ratio 6/4 = 1.5 aa jaata tha.
 * Ratio 1 se upar ja hi nahi sakta.
 *
 * Ab dono taraf ek hi cheez ginte hain: akshar + matra (\p{L} + \p{M}).
 */
export function devanagariRatio(text) {
  const total = (text.match(/[\p{L}\p{M}]/gu) || []).length;
  if (!total) return 0;
  const deva = (text.match(/\p{Script=Devanagari}/gu) || []).length;
  return deva / total;
}

/**
 * Hinglish → Devanagari.
 * Pehle se Devanagari (ya mostly Devanagari) ho toh jaisa hai waisa hi.
 *
 * @param {string} text
 * @returns {string}
 */
export function toDevanagari(text) {
  if (!text || !text.trim()) return text;
  if (devanagariRatio(text) >= 0.3) return text;   // already Hindi script

  // hyphen par bhi todo — "baar-baar" do shabd hain, ek nahi
  return text.split(/(\s+|-)/).map(tok => {
    if (!tok.trim()) return tok;
    // trailing/leading punctuation alag rakho
    const m = tok.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    const [, pre, core, post] = m;
    if (!core) return tok;
    if (DEVA_RE.test(core)) return tok;                 // pehle se Devanagari

    // 1. haath se banayi list — aam function words, jinke hijje niyam se
    //    nahi chalte ("kaise", "mein", "nahi")
    const lower = core.toLowerCase();
    if (WORDS[lower]) return pre + WORDS[lower] + post;

    // 2. corpus se bana lexicon — asli granth-vocabulary
    const hit = LEXICON[fuzzyKey(core)];
    if (hit) return pre + hit + post;

    // 3. NAHI PEHCHANA → Latin mein hi chhod do.
    //    Yahan pehle syllable-transliteration hoti thi. Usi ne kachre
    //    sawaalon ka score +0.13 tak badha diya tha. Ab nahi.
    return tok;
  }).join("");
}

// Aam angrezi shabd jo galti se Hindi lexicon mein match kar jaate hain
// ("to"→तो, "use"→उसे, "me"→में, "hi"→ही). Bhasha pehchante waqt inhe
// Hindi ka saboot mat maano — warna saaf English sawaal "Hinglish" gina
// jayega.
// Hindi ke JODNE WALE shabd (vyakaran). Inme se ek bhi mila toh vaakya ka
// dhaancha Hindi ka hai — yaani Hinglish. Vishay ke shabd angrezi ho sakte
// hain ("mera job chhut gaya hai"), phir bhi vaakya Hindi hi hai.
const HI_GRAMMAR = new Set([
  // hona
  // NOTE: "the" (थे) jaanbujh ke NAHI hai — woh angrezi ka sabse aam shabd
  // hai, aur usse "What happens to the soul after death?" bhi Hinglish gina
  // jaata tha. थे ka nuksaan chhota hai, "the" ka takraav bada.
  "hai","hain","tha","thi","hoga","hogi","hota","hoti","hote","hona","hua","hui","hue",
  // sawaal
  "kya","kyu","kyun","kyon","kaise","kese","kaisa","kaisi","kab","kahan","kaha",
  "kaun","kon","kitna","kitni","kitne","konsa",
  // vibhakti
  "ka","ki","ke","ko","se","mein","par","tak","liye","wala","wali","wale","vala","vali","vale",
  // sarvanaam
  "mera","meri","mere","mujhe","mujhko","hum","hamara","hamari","humein",
  "aap","aapka","aapki","aapke","tum","tumhara","apna","apni","apne",
  "yeh","woh","uska","uski","iska","iski","unka","inka",
  // kriya
  "kar","karo","karna","karta","karti","karte","karein","kare","karu","karun",
  "raha","rahi","rahe","rehta","gaya","gayi","gaye","jata","jaati","jaate",
  "diya","dena","lena","chahiye","sakta","sakti","sakte","batao","bataye","bataiye",
  // aam
  "nahi","nahin","aur","lekin","agar","toh","bhi","phir","abhi","bahut","bohot",
  "kuch","sab","koi","jab","tab","waise","aisa","aise",
]);

// Aam angrezi shabd jo galti se Hindi lexicon mein match kar jaate hain.
// (Ab bhasha-pehchaan HI_GRAMMAR se hoti hai, par yeh list aage kaam aa
// sakti hai — isliye rakhi hai.)
const EN_STOP = new Set([
  "a","an","the","and","or","if","is","are","was","were","be","been","being",
  "to","of","in","on","at","by","for","from","with","as","it","its","this",
  "that","these","those","i","you","he","she","we","they","me","my","your",
  "do","does","did","have","has","had","can","could","will","would","should",
  "not","no","yes","so","up","us","out","get","got","see","new","one","two",
  "what","when","where","who","whom","how","why","which","all","any","some",
  "use","using","used","hi","also","than","then","there","here","about",
]);

// ── CYRILLIC SAFAI (Fix 4) ────────────────────────────────────────────
// Groq ka llama-3.3-70b kabhi-kabhi Devanagari ke beech Cyrillic akshar
// ghusa deta hai — asli mein dekha gaya:
//     "मैं आपको एक नарам सावाल पूछना चाहता हूं"   (नरम hona chahiye tha)
//     "अपनी तैयारी की стратегी को दोबारा देखना"    (रणनीति hona chahiye tha)
// Yeh token-level corruption hai (wahi jad jisse angrezi mein "by" gir
// jaata hai). Us gire hue shabd ko toh code wapas nahi la sakta, PAR
// Cyrillic akshar dikhne mein Devanagari/Latin jaise hi hote hain aur
// unka dhwani-roop wahi hai — isliye unhe wapas badla ja sakta hai:
//     н→न  а→(antarnihit)  р→र  м→म   ⇒  "нарам" → "नरम"  ✅ sahi shabd
const CYR_TO_DEV = {
  "а":"", "б":"ब", "в":"व", "г":"ग", "д":"द", "е":"े", "ж":"झ", "з":"ज",
  "и":"ि", "й":"य", "к":"क", "л":"ल", "м":"म", "н":"न", "о":"ो", "п":"प",
  "р":"र", "с":"स", "т":"त", "у":"ु", "ф":"फ", "х":"ह", "ц":"च", "ч":"च",
  "ш":"श", "щ":"श", "ы":"ी", "э":"े", "ю":"यु", "я":"या", "ъ":"", "ь":"",
};
const CYR_TO_LAT = {
  "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ж":"zh","з":"z","и":"i",
  "й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s",
  "т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sh",
  "ы":"y","э":"e","ю":"yu","я":"ya","ъ":"","ь":"",
};
const CYR_RE = /[Ѐ-ӿ]/;

/**
 * Model ke jawab se Cyrillic corruption hatao.
 * Devanagari-bahul text mein Cyrillic → Devanagari, warna → Latin.
 *
 * IMAANDARI: yeh sirf CYRILLIC ka ilaaj hai. Usi corruption ki doosri
 * shakl — angrezi mein "by"/"of" jaise shabd gir jaana — code se theek
 * NAHI ho sakti. Uske liye behtar engine hi hal hai (Gemini quota).
 *
 * @returns {{ text: string, fixed: number }}
 */
export function stripCyrillic(text) {
  if (!text || !CYR_RE.test(text)) return { text, fixed: 0 };
  const toDev = devanagariRatio(text) >= 0.3;
  const map = toDev ? CYR_TO_DEV : CYR_TO_LAT;
  let fixed = 0;
  const out = text.replace(/[Ѐ-ӿ]/g, ch => {
    const lower = ch.toLowerCase();
    if (map[lower] === undefined) return ch;
    fixed++;
    return map[lower];
  });
  return { text: out, fixed };
}

/**
 * Sawaal ki bhasha pehchano — jawab kis bhasha mein dena hai, yeh tay
 * karne ke liye.
 *
 * KYUN (2026-08-03): pehle sirf app ka Hindi/English toggle faisla karta
 * tha. User ne "मृत्यु के बाद आत्मा का क्या होता है?" poocha, toggle
 * English par tha, aur poora jawab English mein aa gaya — jo saaf galat
 * laga. Ab niyam yeh hai:
 *
 *   saaf Devanagari  → "hi"      (script jeetega, toggle chahe kuch bhi ho)
 *   saaf English     → "en"      (script jeetega)
 *   Hinglish/Roman   → "mixed"   (dhundhla case — yahan toggle faisla kare)
 *
 * Hindi shabd pehchanne ke liye wahi lexicon istemal hota hai jo
 * transliteration ke liye banaya tha — corpus se nikale 6,000 shabd.
 *
 * @returns {"hi"|"en"|"mixed"|"unknown"}
 */
export function detectQueryLanguage(text) {
  if (!text || !text.trim()) return "unknown";
  if (devanagariRatio(text) >= 0.3) return "hi";

  const words = (text.toLowerCase().match(/[a-z]+/g) || []).filter(w => w.length >= 2);
  if (!words.length) return "unknown";

  // ASLI PEHCHAAN: Hindi VYAKARAN, Hindi shabd nahi.
  //
  // Pehla tarika "kitne shabd Hindi lexicon mein hain" ginta tha — par
  // usse "Explain karma yoga to me" bhi Hinglish gina gaya, kyunki karma
  // aur yoga to Hindi shabd hain hi. Woh angrezi vaakya hai jisme sanskrit
  // ke do shabd hain.
  //
  // Hinglish ki asli nishani uske JODNE WALE shabd hain — hai, kya, kaise,
  // ka/ki/ke, mein, se, karo. Ye aate hain toh vaakya ka dhaancha Hindi ka
  // hai, chahe vishay ke shabd angrezi hon ("mera job chhut gaya hai").
  for (const w of words) if (HI_GRAMMAR.has(w)) return "mixed";
  return "en";
}

/**
 * Search ke liye query taiyaar karo. Roman ho toh Devanagari banao,
 * warna jaisa hai waisa hi.
 * @returns {{ query: string, transliterated: boolean, original: string }}
 */
export function normalizeQueryForSearch(text) {
  const original = text;
  const ratio = devanagariRatio(text);
  if (ratio >= 0.3) return { query: text, transliterated: false, original };
  const dev = toDevanagari(text);
  return { query: dev, transliterated: dev !== text, original };
}
