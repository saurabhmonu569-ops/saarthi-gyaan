/**
 * SAARTHI — hint me naam ke kitne roop chhoot rahe hain?     (2026-08-12)
 * =====================================================================
 * KYUN: 1,250 sawaalon ki naap ne ek hi baat sabse saaf dikhayi —
 *
 *     hint SAHI laga  →  452/452  = 100%   sahi granth
 *     hint NAHI laga  →   83/283  =  29%
 *
 * Yaani jab user granth ka naam leta hai aur hamara hint use pehchan
 * leta hai, hum galti karte hi nahi. Saari galtiyan wahan hain jahan
 * naam likha hua THA par hint ne pehchana NAHI.
 *
 * Aur wo chookna aksar EK AKSHAR ka hota hai:
 *     hamara hint  "yoga vasishtha"   (t-h-a)
 *     sawaal me    "Yoga Vasishta"    (t-a)
 * Is ek 'h' se 50 me se 49 sawaal chhoot gaye.
 *
 * YE SCRIPT KYA KARTI HAI: har granth ke naam ke roop apne aap banati
 * hai — Indic lipyantaran me jo farak aam hain, unhi niyamon se —
 * aur poochhti hai ki har roop sahi granth par jaata hai ya nahi.
 *
 * ⚠️ YE "TEST KE LIYE TUNING" NAHI HAI. Niyam ye hai: agar user granth
 * ka naam le raha hai, to us granth par jaana sahi vyavhaar hai — chahe
 * koi test ho ya na ho. Isliye roop yahan SAWAALON SE NAHI, bhasha ke
 * niyamon se bante hain. Kisi test-file ko ye script chhooti tak nahi.
 *
 * CHALAO:
 *   node scripts/20_hint_coverage.mjs           # sirf chhed dikhao
 *   node scripts/20_hint_coverage.mjs --code    # jodne layak code chhapo
 */

const { BOOK_HINTS, detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { BOOK_META } = await import("../src/data/bookMeta.js");

/**
 * Har granth ka naam — jaise log likhte hain.
 * Ye SAWAALON SE NAHI liye gaye; ye us granth ka aam prachalit naam hai.
 */
const NAAM = {
  bhagavad_gita_shankar: ["bhagavad gita", "shrimad bhagavad gita", "gita"],
  mahabharata:           ["mahabharata", "mahabharat"],
  ramcharitmanas:        ["ramcharitmanas", "shri ramcharitmanas", "ram charit manas"],
  yoga_vasishtha:        ["yoga vasishtha", "yog vasishtha", "yoga vasishta maharamayana"],
  yoga_sutra:            ["patanjali yoga sutra", "yoga sutra", "patanjal yoga sutra"],
  rigveda_1:             ["rigveda", "rig veda"],
  samaveda:              ["samaveda", "sama veda"],
  yajurveda:             ["yajurveda", "yajur veda"],
  atharvaveda_1:         ["atharvaveda", "atharva veda"],
  shiva_purana_1:        ["shiva purana", "shiv purana"],
  shiva_purana_2:        ["shiva purana khand 2", "shiv purana khand 2"],
  vishnu_purana_1:       ["vishnu purana"],
  garuda_purana_1:       ["garuda purana", "garud purana"],
  narasimha_purana:      ["narasimha purana", "narsimha purana"],
  bhavishya_purana:      ["bhavishya purana"],
  agni_purana:           ["agni purana"],
  ishadi_upanishad:      ["isha upanishad", "ishavasya upanishad", "ishadi upanishad"],
  kathopanishad:         ["katha upanishad", "kathopanishad", "katho upanishad"],
  guru_granth_sahib:     ["guru granth sahib"],
  chanakya_neeti:        ["chanakya neeti"],
  ekadashi_mahatmya:     ["ekadashi mahatmya"],
  mantra_maha_sagar:     ["mantra maha sagar"],
  nitya_karm_pooja:      ["nitya karm pooja"],
  lal_kitab:             ["lal kitab"],
  rashi_muhurt_vigyan:   ["rashi aur muhurt vigyan", "rashi muhurt vigyan"],
};

/**
 * Indic naam Roman me likhte waqt jo farak AAM hain.
 * Har niyam dono taraf lagta hai — "puran"→"purana" aur ulta bhi.
 */
const NIYAM = [
  // aakhri "a" — Sanskrit me hai, Hindi bolchaal me gir jaata hai
  [/purana\b/g, "puran"],   [/veda\b/g, "ved"],      [/gita\b/g, "geeta"],
  [/sutra\b/g, "sutr"],
  // sh / s   — "vasishtha" ↔ "vasistha"
  [/sh/g, "s"],
  // th / t   — "vasishtha" ↔ "vasishta"   ← yahi 'h' Yoga Vasishtha ko le dooba
  [/th/g, "t"],
  // v / w    — "vishnu" ↔ "wishnu"
  [/v/g, "w"],
  // ee / i   — "neeti" ↔ "niti"
  [/ee/g, "i"],
  // oo / u   — "pooja" ↔ "puja"
  [/oo/g, "u"],
  // aa / a
  [/aa/g, "a"],
  // space hatao — "shivpuran", "ramcharitmanas"
  [/ /g, ""],
];

function roopBanao(naam) {
  const set = new Set([naam]);
  // ek-ek niyam alag se (do niyam saath lagane par ajeeb roop bante hain)
  for (const [re, to] of NIYAM) {
    for (const x of [...set]) {
      const y = x.replace(re, to);
      if (y !== x && y.length > 4) set.add(y);
    }
  }
  return [...set];
}

console.log(`\n  Har granth ke naam ke roop jaanche ja rahe hain.`);
console.log(`  ⚠️ Roop bhasha ke niyam se bante hain, kisi test-file se NAHI.\n`);

const chhed = {};
let kulRoop = 0, kulChhed = 0;

for (const [book, naamList] of Object.entries(NAAM)) {
  const gayab = [];
  for (const naam of naamList) {
    for (const roop of roopBanao(naam)) {
      kulRoop++;
      // sawaal ke andar rakhkar dekho — waise hi jaise asli sawaal me hota
      const mila = detectHintedBook(`${roop} mein is vishay par kya kaha gaya hai`);
      if (mila !== book) { gayab.push([roop, mila]); kulChhed++; }
    }
  }
  if (gayab.length) chhed[book] = gayab;
}

const naamOf = id => (BOOK_META[id]?.en || id);
console.log(`  ${kulRoop} roop jaanche — ${kulChhed} chhoot rahe hain\n`);
console.log(`  ${"GRANTH".padEnd(24)} chhoote  jo roop chhoot rahe hain`);
console.log(`  ${"─".repeat(76)}`);

for (const [book, g] of Object.entries(chhed).sort((a, b) => b[1].length - a[1].length)) {
  const dikhao = g.slice(0, 4).map(([r, m]) => m ? `${r}→${m}` : r).join(", ");
  console.log(`  ${naamOf(book).slice(0, 22).padEnd(24)} ${String(g.length).padStart(4)}   ${dikhao}${g.length > 4 ? " …" : ""}`);
}

// ⚠️ SABSE KHATARNAK: roop kisi DOOSRE granth par ja raha hai.
// Khaali lautna kami hai; galat granth par jaana JHOOTHI CITATION hai.
const galat = [];
for (const [book, g] of Object.entries(chhed))
  for (const [roop, mila] of g) if (mila) galat.push([book, roop, mila]);

if (galat.length) {
  console.log(`\n  ⚠️  ${galat.length} roop DOOSRE granth par ja rahe hain — ye khaali lautne se bura hai:`);
  for (const [b, r, m] of galat.slice(0, 15)) console.log(`     "${r}"  →  ${m}   (chahiye tha ${b})`);
}

if (process.argv.includes("--code")) {
  console.log(`\n\n  ── bookHints.js me jodne layak ──\n`);
  for (const [book, g] of Object.entries(chhed)) {
    // sirf wo roop jo KAHIN nahi ja rahe — jo galat jagah ja rahe hain unhe
    // haath se dekhna zaroori hai, warna hum ek galti ki jagah doosri karenge
    const surakshit = g.filter(([, m]) => !m).map(([r]) => r);
    if (!surakshit.length) continue;
    console.log(`  // ${naamOf(book)}`);
    console.log(`  ${surakshit.map(r => `"${r}": "${book}"`).join(", ")},`);
  }
}
console.log();
