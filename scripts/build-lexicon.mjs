/**
 * SAARTHI — Corpus se Roman→Devanagari lexicon banao (2026-08-03)
 * =====================================================================
 * KYUN: rule-based syllable transliteration ne 89% signal wapas laaya,
 * PAR kachre sawaalon ka score bhi utna hi badha diya (OCR/React/laptop
 * wale +0.06 se +0.13). Wajah: English shabd Devanagari mein bematlab
 * akshar ban jaate hain ("error" → "एर्रोर"), aur corpus khud OCR-scanned
 * hai — usme aisa hi garbled Devanagari bhara pada hai. Bakwas, kachre se
 * match kar leti hai.
 *
 * ILAAJ: sirf UN shabdon ko badlo jo sach mein Hindi hain. Baaki (English,
 * tech, naam) Latin mein hi chhod do — tab woh Devanagari bakwas banenge
 * hi nahi.
 *
 * "Hindi hai ya nahi" ka faisla kaise? Corpus se. 24 granthon mein jo
 * shabd asal mein aate hain, wahi asli Hindi hain — aur wahi retrieval ke
 * liye maayne rakhte hain. Devanagari→Roman badalna aasaan aur pakka hai,
 * to ulta map bana lete hain.
 *
 * Hijje ke farak (gussa/gusa, shanti/shaanti, kitab/kitaab) ke liye dono
 * taraf ek "fuzzy key" banate hain — swar ki lambai hata kar, dohre
 * akshar milaa kar.
 *
 * CHALAO:  node scripts/build-lexicon.mjs      (koi API nahi, sab local)
 * OUTPUT:  src/knowledge/lexicon.json
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "public", "knowledge", "books");
// .json ke bajaye .js — Node ko JSON import ke liye `with { type: "json" }`
// chahiye hota hai, Vite ko nahi. Module banane se dono jagah bina jhanjhat
// ke chalta hai (browser bundle aur local scripts, dono).
const OUT   = join(ROOT, "src", "knowledge", "lexicon.js");

const TOP_N   = 6000;   // bundle size vs coverage ka santulan
const MIN_FREQ = 4;
const MIN_LEN  = 3;

// ── Devanagari → Roman ────────────────────────────────────────────────
const D2R = {
  "क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"n","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"n",
  "ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n","त":"t","थ":"th","द":"d","ध":"dh","न":"n",
  "प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","व":"v","ळ":"l",
  "श":"sh","ष":"sh","स":"s","ह":"h",
  "क़":"q","ख़":"kh","ग़":"g","ज़":"z","ड़":"r","ढ़":"rh","फ़":"f",
  "अ":"a","आ":"aa","इ":"i","ई":"ee","उ":"u","ऊ":"oo","ऋ":"ri",
  "ए":"e","ऐ":"ai","ओ":"o","औ":"au",
  "ा":"aa","ि":"i","ी":"ee","ु":"u","ू":"oo","ृ":"ri","े":"e","ै":"ai","ो":"o","ौ":"au",
  "ं":"n","ँ":"n","ः":"h","्":"",
};

// Vyanjan aur matra ke set — antarnihit 'a' (schwa) ke liye zaroori.
const MATRAS = new Set(["ा","ि","ी","ु","ू","ृ","े","ै","ो","ौ"]);
const CONSONANTS = new Set([
  "क","ख","ग","घ","ङ","च","छ","ज","झ","ञ","ट","ठ","ड","ढ","ण",
  "त","थ","द","ध","न","प","फ","ब","भ","म","य","र","ल","व","ळ",
  "श","ष","स","ह","क़","ख़","ग़","ज़","ड़","ढ़","फ़",
]);

/**
 * Devanagari → Roman, ANTARNIHIT 'a' ke saath.
 *
 * BUG FIX (2026-08-03): pehla version har akshar ko seedha map kar deta
 * tha, isliye "धर्म" → "dhrm" banta tha — par Roman mein log "dharm"
 * likhte hain, to lookup fail ho jaata tha. Isi wajah se dharm, parivar,
 * ahankar, pariksha, shani, ekadashi — sab lexicon se chhoot rahe the.
 *
 * Niyam: har vyanjan ke baad 'a' jodo, siwaay tab jab uske turant baad
 * matra ho, halant ho, ya woh shabd ka aakhri vyanjan ho (Hindi mein
 * ant ka schwa girta hai: धर्म = dharm, dharma nahi).
 */
function devToRoman(w) {
  const ch = [...w];
  let out = "";
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    const mapped = D2R[c];
    if (mapped === undefined) continue;

    if (CONSONANTS.has(c)) {
      out += mapped;
      const next = ch[i + 1];
      if (next === "्") { i++; continue; }          // halant → koi swar nahi
      if (next && MATRAS.has(next)) continue;        // matra khud aa jayegi
      // aakhri vyanjan? → schwa gir jaata hai
      let isLast = true;
      for (let j = i + 1; j < ch.length; j++) {
        if (D2R[ch[j]] !== undefined && ch[j] !== "ं" && ch[j] !== "ँ" && ch[j] !== "ः") { isLast = false; break; }
      }
      if (!isLast) out += "a";
      continue;
    }
    out += mapped;
  }
  return out;
}

/**
 * Fuzzy key — hijje ke aam farak mita do, taaki "kitab" aur "kitaab"
 * dono ek hi key par pahunchein.
 */
export function fuzzyKey(roman) {
  let s = roman.toLowerCase();
  s = s.replace(/[^a-z]/g, "");
  s = s.replace(/aa/g, "a").replace(/ee/g, "i").replace(/ii/g, "i")
       .replace(/oo/g, "u").replace(/uu/g, "u").replace(/ou/g, "au");
  s = s.replace(/w/g, "v");
  s = s.replace(/(.)\1+/g, "$1");     // dohre akshar → ek
  s = s.replace(/a$/, "");            // ant ka schwa Hindi mein girta hai
  return s;
}

// ── corpus se shabd gino ──────────────────────────────────────────────
const freq = new Map();
let totalWords = 0;
for (const f of readdirSync(BOOKS).filter(x => x.endsWith(".json"))) {
  const b = JSON.parse(readFileSync(join(BOOKS, f), "utf8"));
  for (const c of (b.chunks || [])) {
    for (const w of ((c.text || "").match(/[ऀ-ॿ]+/g) || [])) {
      if (w.length < 2) continue;
      totalWords++;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
}
console.log(`corpus: ${totalWords.toLocaleString()} Devanagari shabd, ${freq.size.toLocaleString()} alag-alag`);

// ── lexicon banao ─────────────────────────────────────────────────────
const sorted = [...freq.entries()]
  .filter(([w, n]) => n >= MIN_FREQ && w.length >= 2)
  .sort((a, b) => b[1] - a[1]);

const lex = {};
let added = 0, collisions = 0;
for (const [word, n] of sorted) {
  if (added >= TOP_N) break;
  const rom = devToRoman(word);
  if (rom.length < MIN_LEN) continue;
  const key = fuzzyKey(rom);
  if (!key || key.length < 2) continue;
  if (lex[key]) {
    // pehle wala zyada aam hai (list frequency se sorted hai) — usi ko rakho
    collisions++;
    continue;
  }
  lex[key] = word;
  added++;
}

const body = `/**
 * SAARTHI — Roman→Devanagari lexicon (APNE AAP BANA HAI — haath se mat badlo)
 * Banane wali script: scripts/build-lexicon.mjs
 * Source: public/knowledge/books/*.json ke ${added.toLocaleString()} sabse aam Devanagari shabd
 * Banaya: ${new Date().toISOString()}
 *
 * Key = fuzzyKey(devToRoman(shabd)) — swar ki lambai hataakar, dohre
 * akshar milaakar, taaki "kitab" aur "kitaab" dono ek hi jagah pahunchein.
 * Corpus badlo toh yeh dobara banao.
 */
export default ${JSON.stringify(lex)};
`;
writeFileSync(OUT, body);
const kb = (body.length / 1024).toFixed(0);
console.log(`lexicon: ${added.toLocaleString()} entries (${kb} KB)  |  ${collisions.toLocaleString()} collisions chhode`);
console.log(`likha: src/knowledge/lexicon.js\n`);

console.log("namoona (roman-key → Devanagari):");
for (const k of Object.keys(lex).slice(0, 12)) console.log(`   ${k.padEnd(14)} → ${lex[k]}`);

console.log("\njaanch — kya ye aam Hinglish shabd mil rahe hain?");
for (const t of ["mrityu","aatma","shanti","gussa","krodh","kitab","lal","upay","shani","ekadashi","mahatva","parivar","ahankar","pariksha","vidyarthi","dharm"]) {
  const k = fuzzyKey(t);
  console.log(`   ${t.padEnd(12)} key=${k.padEnd(10)} → ${lex[k] || "❌ nahi mila"}`);
}
console.log("\njaanch — English shabd NAHI milne chahiye:");
for (const t of ["error","react","laptop","bitcoin","hook","final","price","cricket"]) {
  const k = fuzzyKey(t);
  console.log(`   ${t.padEnd(12)} key=${k.padEnd(10)} → ${lex[k] || "✅ nahi (sahi)"}`);
}
