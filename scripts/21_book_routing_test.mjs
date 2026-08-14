/**
 * SAARTHI — KYA "GRANTH PEHLE CHUNO" KAAM KAREGA?   (2026-08-14)
 * =====================================================================
 * YE EK JAANCH HAI, SUDHAAR NAHI. Koi deploy nahi, koi API call nahi,
 * app me kuch nahi badalta. Sirf ek sawaal ka jawab deta hai:
 *
 *     "Agar hum sirf sawaal ke shabdon se granth ka andaaza lagayein,
 *      to sahi granth kitni baar upar aata hai?"
 *
 * KYUN PEHLE YE: 13 Aug ko pool-cap wala badlav seedha banaya gaya tha,
 * 79 minute ki naap ke baad pata chala ki wo bigaad raha hai. Is baar
 * ulta kram — pehle sasti jaanch, phir code.
 *
 * NAAPA HUA AADHAAR (1,250 sawaal, 14 Aug):
 *     hint SAHI laga  →  100.0% sahi granth
 *     hint NAHI laga  →   35.7%
 * Yaani granth pata ho to hum galti karte hi nahi. Poori kami granth
 * CHUNNE me hai. Hint-soochi wo kaam haath se karti hai; ye jaanch
 * poochti hai ki machine wahi kaam kar sakti hai ya nahi.
 *
 * TAREEKA — "har granth ke apne shabd"
 * -------------------------------------
 * Har granth ke liye ginte hain ki kaun se shabd USME zyada aur baaki
 * granthon me KAM aate hain. "है", "और", "में" har jagah hain — unka koi
 * matlab nahi. Par "जाम्बवान", "प्रह्लाद", "क्लेश" gine-chune granthon
 * me hi hain — wahi asli pehchan hain.
 *
 * Phir sawaal ke har shabd ko dekhkar poochte hain: "ye shabd kis granth
 * ki taraf ishara karta hai?"
 *
 * ⚠️ IMAANDARI KI BAAT: granth ke parichay SIRF CORPUS se bante hain.
 * Test ke sawaal isme kabhi nahi jaate — wo sirf naapne ke liye hain.
 * Warna hum apne hi imtihaan ke liye tuning kar rahe honge.
 *
 * CHALAO:
 *   node scripts/21_book_routing_test.mjs
 *   node scripts/21_book_routing_test.mjs --nohint    # sirf wo sawaal
 *                                                      jinme naam nahi
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const EVAL  = join(ROOT, "eval-perbook.json");

if (!existsSync(EVAL)) {
  console.error(`❌ ${EVAL} nahi mili — pehle 19_eval_perbook.mjs chalayein.`);
  process.exit(1);
}

const { normalizeQueryForSearch } = await import("../src/knowledge/translit.js");
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { BOOK_META } = await import("../src/data/bookMeta.js");

/** ⚠️ \p{M} ZAROORI — matra ke bina "कृष्ण" teen tukdon me toot jaata hai */
const tokenize = (t) =>
  (t || "").toLowerCase().split(/[^\p{L}\p{N}\p{M}]+/u).filter(w => w.length >= 3);

// ── 1. Har granth ke shabd gino ────────────────────────────────────────
console.log("\n  corpus padh rahe hain…");
const bookFreq = {};       // book → Map(shabd → ginti)
const bookTotal = {};      // book → kul shabd
const docCount = new Map();// shabd → kitne granth me aaya

for (const f of readdirSync(BOOKS).filter(x => x.endsWith(".json"))) {
  const book = f.replace(/\.json$/, "");
  const m = new Map();
  let tot = 0;
  for (const c of JSON.parse(readFileSync(join(BOOKS, f), "utf8")).chunks || []) {
    for (const w of ((c.text || "").match(/[ऀ-ॿ]+/g) || [])) {
      if (w.length < 3) continue;
      m.set(w, (m.get(w) || 0) + 1);
      tot++;
    }
  }
  bookFreq[book] = m;
  bookTotal[book] = tot;
  for (const w of m.keys()) docCount.set(w, (docCount.get(w) || 0) + 1);
}
const books = Object.keys(bookFreq);
console.log(`  ${books.length} granth, ${docCount.size.toLocaleString()} alag shabd\n`);

/**
 * Shabd `w` granth `b` ki taraf kitna ishara karta hai?
 *
 *   (us granth me kitna aam)  ×  (kitne KAM granthon me hai)
 *
 * Doosra hissa hi asli kaam karta hai — "है" saare 25 me hai, isliye
 * uska ishara zero ke barabar ho jaata hai. "जाम्बवान" ek-do me hai,
 * isliye uska ishara bahut tez hai.
 */
function ishara(w, b) {
  const f = bookFreq[b].get(w);
  if (!f) return 0;
  const tf  = f / bookTotal[b];
  const idf = Math.log(books.length / (docCount.get(w) || 1));
  return tf * idf;
}

// ── 2. Har sawaal par granth ka kram lagao ─────────────────────────────
const rows = JSON.parse(readFileSync(EVAL, "utf8"));
const onlyNoHint = process.argv.includes("--nohint");

let n = 0;
const hit = { top1: 0, top2: 0, top3: 0, top5: 0, miss: 0 };
const perBook = {};
const namoone = [];

for (const r of rows) {
  const hinted = detectHintedBook(r.q);
  if (onlyNoHint && hinted) continue;

  const { query } = normalizeQueryForSearch(r.q);
  const words = [...new Set(tokenize(query))].filter(w => /[ऀ-ॿ]/.test(w));
  if (!words.length) continue;

  const score = books.map(b => [b, words.reduce((s, w) => s + ishara(w, b), 0)]);
  score.sort((a, b) => b[1] - a[1]);
  const kram = score.findIndex(([b]) => b === r.book);   // 0 = sabse upar

  n++;
  if (kram === 0) hit.top1++;
  if (kram >= 0 && kram < 2) hit.top2++;
  if (kram >= 0 && kram < 3) hit.top3++;
  if (kram >= 0 && kram < 5) hit.top5++;
  if (kram < 0 || kram >= 5) hit.miss++;

  (perBook[r.book] ??= []).push(kram);
  if (namoone.length < 8 && kram >= 3)
    namoone.push([r.q, r.book, score.slice(0, 3).map(([b]) => b)]);
}

// ── 3. Nateeja ─────────────────────────────────────────────────────────
const pct = k => `${(100 * k / n).toFixed(1)}%`;
console.log(`  ${onlyNoHint ? "BINA NAAM wale" : "SAARE"} ${n} sawaal\n`);
console.log(`  sahi granth sabse UPAR aaya      : ${String(hit.top1).padStart(4)}  ${pct(hit.top1)}`);
console.log(`  sahi granth TOP-2 me aaya        : ${String(hit.top2).padStart(4)}  ${pct(hit.top2)}`);
console.log(`  sahi granth TOP-3 me aaya        : ${String(hit.top3).padStart(4)}  ${pct(hit.top3)}   ← asli ank`);
console.log(`  sahi granth TOP-5 me aaya        : ${String(hit.top5).padStart(4)}  ${pct(hit.top5)}`);
console.log(`  top-5 me BHI nahi                : ${String(hit.miss).padStart(4)}  ${pct(hit.miss)}\n`);

const naam = id => (BOOK_META[id]?.en || id);
console.log(`  ${"GRANTH".padEnd(24)} top-1   top-3`);
console.log(`  ${"─".repeat(46)}`);
const pb = Object.entries(perBook)
  .map(([b, ks]) => [b, ks.filter(k => k === 0).length / ks.length, ks.filter(k => k >= 0 && k < 3).length / ks.length])
  .sort((a, b) => a[2] - b[2]);
for (const [b, t1, t3] of pb)
  console.log(`  ${naam(b).slice(0, 22).padEnd(24)} ${(100 * t1).toFixed(0).padStart(4)}%  ${(100 * t3).toFixed(0).padStart(5)}%`
    + (t3 < 0.6 ? "  ⚠️" : ""));

if (namoone.length) {
  console.log(`\n  ── kuch sawaal jahan sahi granth top-3 me bhi nahi aaya ──`);
  for (const [q, sahi, top3] of namoone) {
    console.log(`     ${q.slice(0, 62)}`);
    console.log(`       chahiye: ${sahi}   |   mila: ${top3.join(", ")}`);
  }
}

console.log(`
  ─────────────────────────────────────────────────────────────────
  KAISE PADHEIN — kasauti PEHLE se tay:

    top-3  90%+   →  raasta saaf hai, banane layak
    top-3  75-90% →  kaam karega, par akela kaafi nahi
    top-3  75% se kam →  ye tareeka chhod dein, doosra sochein

  ⚠️ Ye jaanch batati hai ki granth CHUNA ja sakta hai ya nahi.
     Ye nahi batati ki us granth se sahi ansh mil jaayega — wo alag
     baat hai, aur wo pehle se 100% par hai (jab granth pata ho).
  ─────────────────────────────────────────────────────────────────
`);
