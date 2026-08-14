/**
 * SAARTHI — PAATH KITNA SAAF HAI? OCR/text-layer ka bigaad naapo
 * =====================================================================
 * 2026-08-14.  Ye NAAP hai. Corpus me kuch nahi badalta.
 *
 * KYUN YE FILE BANI
 * -----------------
 * 14 Aug ke audit me pata chala ki Ekadashi Vrat Mahatmya ke 155 me se
 * 138 ansh (89%) ka paath TOOTA HUA hai. Corpus ka aausat 0.56% hai.
 * Wo kitab 15 din se corpus me thi, 50 sawaalon par 96% "SAHI" bhi la
 * rahi thi — aur kisi naap ne kuch nahi kaha.
 *
 * TEEN PEHRE THE, TEENON NIKAL GAYE:
 *
 *   1. `confidence` field — bekaar hai. rigveda ke SAARE 3,159 ansh par
 *      0.00, mahabharata ke SAARE 25,856 par theek 1.00. Jo cheez har
 *      ansh par ek jaisi ho, wo kuch naap hi nahi rahi.
 *
 *   2. 07_add_books.py ka `conf < 0.12` wala OCR-fallback — ye
 *      DEVANAGARI-ANUPAAT dekhta hai ("kitne akshar Devanagari hain").
 *      Ekadashi ka bigda paath 100% Devanagari HAI. Bas akshar galat
 *      jude hain. Anupaat 1.0 aata hai, fallback kabhi chalta hi nahi.
 *
 *   3. 19_eval_perbook.mjs — ye naapti hai ki SAHI GRANTH mila ya nahi.
 *      Us granth ka paath PADHNE LAAYAK hai ya nahi, ye sawaal hi nahi
 *      poochha jaata. Isliye 89% kachra "96% SAHI" dikh sakta hai.
 *
 * Yaani: hamare paas paath ki gunvatta ki KOI naap thi hi nahi. Ye file
 * wahi khaali jagah bharti hai.
 *
 * ⚠️ KYA NAAPTA HAI — aur kyun YEHI teen cheezein
 * ------------------------------------------------
 * Devanagari me kuch cheezein VYAKARAN se asambhav hain. Agar wo dikhein
 * to paath sach me bigda hai — ye raay nahi, niyam hai:
 *
 *   matra-se-shuru : shabd kabhi matra (ा ि ी ृ ्) se shuru nahi hota.
 *                    Milta hai to samjho ligature toota aur aadha hissa
 *                    pichhle shabd me chala gaya.
 *   do-matra       : "ाा", "ीी" — ek vyanjan par do swar-matra nahi lagti.
 *   do-halant      : "््" — do halant lagatar kabhi nahi.
 *
 * In teenon ka ek hi jad hai: PDF ke font me glyph→Unicode ka naksha
 * galat hai, ya OCR ne ligature ko do tukdon me padha.
 *
 * ⚠️ JO JAAN-BOOJHKAR NAHI NAAPA
 * -------------------------------
 * "shabd shabdkosh me hai ya nahi" — ye NAHI naapa. Sanskrit-Hindi ke
 * granthon me hazaron asli shabd kisi bhi shabdkosh me nahi milte, aur
 * wo naap har Ved ko "bigda" bata deti. Sirf wahi ginte hain jo
 * VYAKARAN se hi asambhav hai.
 *
 * SEEMA KAHAN SE AAYI (sochkar nahi, naap kar)
 * ---------------------------------------------
 * 14 Aug ko poore corpus par chalane par:
 *      24 granth  →  0.1% se 2.0% tak ansh bigde
 *      ekadashi   →  89.0%
 * Beech me kuch hai hi nahi — 2.0% aur 89.0% ke beech koi granth nahi.
 * Isliye seema 5% par rakhi hai: har asli granth se 2.5 guna oopar, aur
 * ekadashi jaise mamle se 17 guna neeche. Ye khaai itni chaudi hai ki
 * seema ki theek jagah par behes bemaani hai.
 *
 * CHALAO:
 *   node scripts/25_paath_jaanch.mjs                # saare granth
 *   node scripts/25_paath_jaanch.mjs --granth ekadashi_mahatmya --namoone 5
 *   node scripts/25_paath_jaanch.mjs --seema 3      # sakht seema
 *
 * NIKAS (exit code) — isiliye ye CI/pipeline me lag sakti hai:
 *   0 = sab granth seema ke andar
 *   1 = koi granth seema paar — us paath par bharosa mat kijiye
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR  = join(ROOT, "public", "knowledge", "books");

if (!existsSync(DIR)) {
  console.error(`❌ ${DIR} nahi mili`);
  process.exit(2);
}

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SEEMA    = parseFloat(arg("seema", "5"));      // % ansh, isse zyada = fail
const EK       = arg("granth", null);
const NAMOONE  = parseInt(arg("namoone", "2"), 10);

/**
 * Ek ansh ka bigaad-anupaat: (asambhav dhaanche) ÷ (shabd).
 *
 * ⚠️ Regex me `[ा-्]` ka poora range chahiye — sirf `[ा-ौ]` likhne par
 *    halant (्) aur nukta chhoot jaate hain, aur ekadashi jaisa mamla
 *    aadha hi pakda jaata hai. Devanagari ke saath range likhte waqt
 *    is project me pehle bhi teen baar galti ho chuki hai (`\b`, `\p{L}`,
 *    aur JS `.length`) — teenon baar chup-chaap.
 */
const ASAMBHAV = /(^|\s)[ा-्ॢॣ]|[ा-ौ][ा-ौ]|्\s*्/g;

function bigaad(text) {
  const t = String(text || "");
  const shabd = t.split(/\s+/).filter(Boolean).length;
  if (!shabd) return { anupaat: 0, ginti: 0, shabd: 0 };
  const ginti = (t.match(ASAMBHAV) || []).length;
  return { anupaat: ginti / shabd, ginti, shabd };
}

// ── har granth par chalao ─────────────────────────────────────────────
const files = readdirSync(DIR).filter(f => f.endsWith(".json"))
  .filter(f => !EK || f.startsWith(EK));

if (!files.length) { console.error(`❌ koi granth-file nahi mili (--granth ${EK})`); process.exit(2); }

const rows = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  let bigde = 0, kulGinti = 0, kulShabd = 0;
  const sabse = [];
  for (const c of j.chunks || []) {
    const b = bigaad(c.text);
    kulGinti += b.ginti; kulShabd += b.shabd;
    if (b.anupaat > 0.02) bigde++;
    sabse.push([b.anupaat, c.page, c.text || ""]);
  }
  const n = (j.chunks || []).length || 1;
  sabse.sort((a, b) => b[0] - a[0]);
  rows.push({ book: j.book || f.replace(".json", ""), n, bigde, pct: 100 * bigde / n, kulGinti, kulShabd, sabse });
}

rows.sort((a, b) => b.pct - a.pct);

console.log(`\n  PAATH-SHUDDHI — ${rows.length} granth, seema ${SEEMA}%\n`);
console.log("  " + "granth".padEnd(23) + "ansh".padStart(7) + "bigde".padStart(7) + "%".padStart(8) +
            "prati-1000-shabd".padStart(19) + "   haal");
console.log("  " + "─".repeat(76));

let fail = 0, KN = 0, KB = 0;
for (const r of rows) {
  const per1000 = 1000 * r.kulGinti / (r.kulShabd || 1);
  const ok = r.pct <= SEEMA;
  if (!ok) fail++;
  KN += r.n; KB += r.bigde;
  console.log("  " + r.book.padEnd(23) +
    String(r.n).padStart(7) + String(r.bigde).padStart(7) +
    (r.pct.toFixed(1) + "%").padStart(8) + per1000.toFixed(1).padStart(19) +
    "   " + (ok ? "theek" : "❌ SEEMA PAAR"));
}
console.log("  " + "─".repeat(76));
console.log("  " + "KUL".padEnd(23) + String(KN).padStart(7) + String(KB).padStart(7) +
            ((100 * KB / KN).toFixed(2) + "%").padStart(8));

// ── seema paar wale granthon ka paath DIKHAO ─────────────────────────
// Sirf ank par faisla mat kijiye — bigda paath dekhne par turant saaf
// ho jaata hai, aur jo theek hai wo bhi turant saaf ho jaata hai.
for (const r of rows.filter(x => x.pct > SEEMA)) {
  console.log(`\n  ${"═".repeat(76)}`);
  console.log(`  ❌ ${r.book} — ${r.bigde}/${r.n} ansh bigde (${r.pct.toFixed(1)}%)`);
  console.log(`  ${"═".repeat(76)}`);
  for (let i = 0; i < Math.min(NAMOONE, r.sabse.length); i++) {
    const [a, page, text] = r.sabse[i];
    console.log(`\n  ── panna ${page} — bigaad ${(100 * a).toFixed(0)}% ──`);
    console.log(text.split("\n").slice(0, 6).map(l => "    " + l.slice(0, 96)).join("\n"));
  }
  // sabse saaf ansh bhi — taaki pata chale ki poori kitab bigdi hai ya kuch panne
  const saaf = r.sabse[r.sabse.length - 1];
  console.log(`\n  ── is granth ka SABSE SAAF ansh (panna ${saaf[1]}, bigaad ${(100 * saaf[0]).toFixed(0)}%) ──`);
  console.log(saaf[2].split("\n").slice(0, 5).map(l => "    " + l.slice(0, 96)).join("\n"));
}

console.log(`\n  ${"═".repeat(76)}`);
if (fail) {
  console.log(`
  ${fail} granth seema ke bahar hai.

  AGLA KADAM — ye ANK ka mamla nahi, PAATH ka hai:
    1. Upar ka namoona PADHIYE. Agar shabd toote hue dikhein, paath
       sach me bigda hai.
    2. Jad lagbhag hamesha ek hi hoti hai: PDF ka text-layer padha gaya
       jabki uska font-encoding tooti hui thi.
       Ilaaj: scripts/07_add_books.py me us granth par "force_ocr": True
       lagaiye aur dobara chalaiye.
    3. Phir: 02_chunk.py → embed-corpus.mjs → 11_upload_vectorize.mjs
       → 12_load_d1.mjs. Aur ye jaanch dobara chalaiye.

  ⚠️ Jab tak ye theek na ho, us granth ka Aadhaar dena user se jhooth
     bolna hai — naam sacha hoga, paath nahi.
`);
  process.exit(1);
}
console.log(`
  Sab granth seema ke andar hain.

  ⚠️ Iska matlab sirf itna hai ki AKSHAR theek jude hain. Ye nahi ki OCR
     ne sahi shabd padha. Wo alag sawaal hai aur uski naap alag hogi.
`);
