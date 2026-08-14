/**
 * SAARTHI — OCR `र्` (repha) giraata hai ya nahi                (2026-08-14)
 * =====================================================================
 * YE NAAP HAI. Corpus me kuch nahi badalta.
 *
 * KYUN — 25_paath_jaanch.mjs ISE NAHI PAKAD SAKTI
 * ------------------------------------------------
 * Wo naap un dhaanchon ko ginti hai jo Devanagari vyakaran me ASAMBHAV
 * hain (matra se shuru hone wala shabd, do matra, do halant). Par jab
 * OCR `र्` GIRA deta hai:
 *
 *     प्रार्थना  →  प्राथना
 *     पदार्थ    →  पदाथ
 *
 * to jo bacha, wo poori tarah vaidh Devanagari hai. Koi niyam nahi
 * tootta. Isliye 25_paath_jaanch Ekadashi ko "1.1 — theek" batati hai,
 * jabki uske har teen me se ek repha gir chuka hai.
 *
 * Yahi wajah hai ki ye alag file hai, us file me ek aur jaanch nahi.
 * Do alag kism ki kharabi hain aur unke pakadne ke tareeke bhi alag hain.
 *
 * TAREEKA — GINE HUE JODE, ANDAZA NAHI
 * -------------------------------------
 * Har jode me: [sahi shabd, repha-gira hua roop]. Phir dono ki ginti se
 * galti ka anupaat.
 *
 * ⚠️ JODE CHUNNE KA NIYAM — gira hua roop koi ASLI SHABD NA HO.
 * Isiliye ye teen jaan-boojhkar CHHODE gaye hain:
 *       कर्म → कम    ("kam" asli shabd hai)
 *       अर्थ → अथ    ("ath" Sanskrit ka asli shabd hai)
 *       कार्य → काय  ("kaay" asli shabd hai — shareer)
 * Inhe rakhne par har granth jhootha "bigda" dikhta.
 *
 * ⚠️ Aur `(?<![ऀ-ॿ])...(?![ऀ-ॿ])` zaroori hai — warna "वष" शब्द "वर्षा" ke
 *    andar bhi gin jaata aur ginti oopar chali jaati.
 *
 * NAAPA HUA (14 Aug, Ekadashi ke naye OCR ke baad):
 *       ekadashi_mahatmya      29.5%   ← naya OCR
 *       bhagavad_gita_shankar   8.7%
 *       kathopanishad           7.6%
 *       narasimha_purana        5.7%
 *       guru_granth_sahib       2.8%
 *       baaki 20 granth        ~0.0%
 *
 * CHALAO:
 *   node scripts/27_repha_jaanch.mjs
 *   node scripts/27_repha_jaanch.mjs --namoone      # asli vaakya dikhao
 *   node scripts/27_repha_jaanch.mjs --seema 10     # exit 1 iske oopar
 *
 *   node scripts/27_repha_jaanch.mjs --raw ekadashi_mahatmya
 *       ↑ data/raw/<granth>/page_*.json SEEDHE padho — yaani OCR ka
 *         KACHCHA nateeja, chunk/embed/upload se PEHLE.
 *
 * ⚠️ `--raw` KYUN ZAROORI HAI
 * OCR ki setting badal kar uska asar dekhne ka doosra tareeka ye hota:
 * chunk → knowledge banao → split → phir naapo. Wo ~8 minute hai, aur
 * agar setting se fayda hua hi nahi to wo poora waqt bekaar gaya. Usse
 * bhi bura: tab tak kachra corpus me ghus chuka hota.
 * `--raw` se faisla OCR ke turant baad hota hai — aur yahi aaj ki seekh
 * hai (25_paath_jaanch.mjs bhi isi wajah se bani).
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR  = join(ROOT, "public", "knowledge", "books");

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SEEMA   = parseFloat(arg("seema", "10"));
const NAMOONE = process.argv.includes("--namoone");
const RAW     = arg("raw", null);

if (!RAW && !existsSync(DIR)) { console.error(`❌ ${DIR} nahi mili`); process.exit(2); }

/** [sahi, repha-gira]. Gira hua roop asli shabd NAHI hona chahiye. */
const JODE = [
  ["प्रार्थना", "प्राथना"], ["पदार्थ", "पदाथ"],   ["सूर्य", "सूय"],
  ["पूर्ण", "पूण"],        ["मार्ग", "माग"],     ["वर्णन", "वणन"],
  ["वर्तमान", "वतमान"],    ["सर्वत्र", "सवत्र"],  ["आश्चर्य", "आश्चय"],
  ["कार्तिक", "कातिक"],    ["परिवर्तन", "परिवतन"], ["स्वर्ग", "स्वग"],
  ["दुर्लभ", "दुलभ"],      ["निर्णय", "निणय"],    ["आचार्य", "आचाय"],
  ["वर्ष", "वष"],
];

/** [{ book, text }] — ya to granth-files se, ya kacche OCR se */
function paathLao() {
  if (!RAW) {
    return readdirSync(DIR).filter(f => f.endsWith(".json")).map(f => {
      const j = JSON.parse(readFileSync(join(DIR, f), "utf8"));
      return { book: j.book || f.replace(".json", ""),
               text: (j.chunks || []).map(c => c.text || "").join("\n") };
    });
  }
  const rd = join(ROOT, "data", "raw", RAW);
  if (!existsSync(rd)) { console.error(`❌ ${rd} nahi mili — 07_add_books.py chala hai?`); process.exit(2); }
  const files = readdirSync(rd).filter(f => /^page_\d+\.json$/.test(f)).sort();
  if (!files.length) { console.error(`❌ ${rd} me koi page_*.json nahi`); process.exit(2); }
  console.log(`\n  KACCHA OCR padh raha hoon — ${files.length} panne (${RAW})`);
  return [{ book: RAW + " (kaccha OCR)",
            text: files.map(f => JSON.parse(readFileSync(join(rd, f), "utf8")).text || "").join("\n") }];
}

const rows = [];
for (const src of paathLao()) {
  const j = { book: src.book };
  const t = src.text;
  let ok = 0, bad = 0;
  const mile = [];
  for (const [s, g] of JODE) {
    ok  += (t.match(new RegExp(s, "g")) || []).length;
    const m = t.match(new RegExp(`(?<![ऀ-ॿ])${g}(?![ऀ-ॿ])`, "g")) || [];
    bad += m.length;
    if (m.length && mile.length < 4) {
      const i = t.indexOf(g);
      mile.push(`${s} → ${g}   …${t.slice(Math.max(0, i - 34), i + 34).replace(/\s+/g, " ")}…`);
    }
  }
  // 10 se kam mile to anupaat bharosemand nahi — chhod do
  if (ok + bad >= 10) rows.push({ book: j.book, ok, bad, pct: 100 * bad / (ok + bad), mile });
}

rows.sort((a, b) => b.pct - a.pct);

console.log(`\n  REPHA (र्) KI JAANCH — ${rows.length} granth, seema ${SEEMA}%\n`);
console.log("  " + "granth".padEnd(23) + "sahi".padStart(8) + "gira".padStart(7) + "galti".padStart(9) + "   haal");
console.log("  " + "─".repeat(60));
let fail = 0;
for (const r of rows) {
  const ok = r.pct <= SEEMA;
  if (!ok) fail++;
  console.log("  " + r.book.padEnd(23) + String(r.ok).padStart(8) + String(r.bad).padStart(7) +
              (r.pct.toFixed(1) + "%").padStart(9) + "   " + (ok ? "theek" : "❌ SEEMA PAAR"));
}

if (NAMOONE) for (const r of rows.filter(x => x.bad)) {
  console.log(`\n  ── ${r.book} ──`);
  for (const m of r.mile) console.log("    " + m);
}

console.log(`
  ${"═".repeat(60)}
  ⚠️ YE NAAP POORI NAHI HAI. Sirf ${JODE.length} gine hue jode dekhti hai,
     poora shabdkosh nahi. Anupaat sahi disha batata hai, thik-thik
     ginti nahi. Aur jin granthon me 10 se kam jode mile, wo soochi me
     hain hi nahi.

  ⚠️ "hin+san AAZMAO" — YE MAT KIJIYE. 14 Aug ko aazma kar hataya ja
     chuka hai. Ratio 29.5% se 23.0% dikha tha, par wo JHOOTHA sudhaar
     tha: jode 112 se 87 ho gaye (25 shabd kisi aur tarah bigde), aur
     र् ka ghanatv 14.4 se 12.7 prati-1000 GIR gaya — yaani repha aur
     zyada gira. Poori wajah 07_add_books.py me ekadashi ke oopar likhi
     hai.

  ⚠️ ANUPAAT AKELA MAT DEKHIYE. Upar ka "galti%" tabhi matlab rakhta hai
     jab "sahi" ki ginti bhi utni hi rahe. Dono ginti gir jaayein to
     anupaat behtar dikhega aur paath bura hoga.

  Agla vichaar OCR ki setting nahi, OCR ke BAAD sudhaar hai — shabdkosh
  se र् wapas jodna. Uska apna khatra hai (sahi shabd bhi badal sakte
  hain), isliye pehle uski jaanch banani hogi. Task #33.
`);
if (fail) process.exit(1);
