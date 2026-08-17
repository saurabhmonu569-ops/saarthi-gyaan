/**
 * SAARTHI — chaar index files ko EK karo, aur unhe public/ se bahar nikaalo
 * =====================================================================
 * 2026-08-17.  Ek baar ka kaam. Chalne ke baad ye file sirf itihaas hai.
 *
 * KYA HO GAYA THA
 * ---------------
 * Har baar jab koi granth baad me juda ya dobara embed hua, embed-corpus.mjs
 * ne uski ALAG file bana di:
 *     chunk_index.json                   57,339 ansh (24 granth)
 *     chunk_index.yoga_sutra.json           160
 *     chunk_index.nitya_karm_pooja.json     408
 *     chunk_index.ekadashi_mahatmya.json    103
 *
 * Wo design theek tha — poora corpus dobara embed karna 2 ghante aur
 * ~27,000 neuron hai. Par uski keemat ye hui ki ab har script ko chaaron
 * files jaanni padti hain, aur jo nahi jaanti wo chup-chaap adhoora kaam
 * karti hai. 22_routing_embed_test.mjs me poora block isi ke liye likha
 * hai ("Yogasutra baad me juda aur uski apni alag file bani").
 *
 * Purani main file me 501 aisi id bhi hain jo ab kisi granth me hain hi
 * nahi (nitya_karm_pooja aur ekadashi_mahatmya dobara ban gaye the), aur
 * 14 id uske andar do baar hain.
 *
 * ⚠️ FOLDER public/ SE BAHAR JA RAHA HAI — aur ye is kaam ka bada hissa hai
 * ------------------------------------------------------------------------
 * `public/knowledge/embeddings/` me 59 MB hai jo HAR Netlify deploy me
 * jaata hai. Par app use kabhi maangti hi nahi. Teen tarah se jaancha:
 *
 *   1. `semanticSearch.js` hi ekmatra cheez thi jo use padhti thi — aur
 *      use koi import nahi karta.
 *   2. engine.js:398 khud likhta hai: "semanticSearch + cosine similarity
 *      code HATA DIYA (2026-07-14 audit)". Retrieval 10 Aug ko Worker par
 *      chali gayi (Vectorize + D1).
 *   3. Bane hue bundle me "vectors_int8" shabd SHOONYA baar hai.
 *
 * Ise sirf dev-scripts padhte hain — 11_upload_vectorize (Vectorize par
 * chadhane ke liye), 22/26/calibrate (naap ke liye). Wo sab is machine par
 * chalte hain, browser me nahi. Isliye inki jagah `data/` hai.
 *
 * SACH KYA HAI: `public/knowledge/books/*.json`. Wahi app aur D1 dono me
 * jaata hai. Ye script usi ko kasauti maanti hai — jo id wahan nahi, uska
 * vector nahi bachta.
 *
 * CHALAO:
 *   node scripts/28_index_jodo.mjs            # sirf batao kya hoga
 *   node scripts/28_index_jodo.mjs --likho    # sach me likho
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS  = join(ROOT, "public", "knowledge", "books");
const PURANA = join(ROOT, "public", "knowledge", "embeddings");
const NAYA   = join(ROOT, "data", "embeddings");
const ROW    = 1028;          // 4 byte float32 scale + 1024 int8
const DIM    = 1024;
const LIKHO  = process.argv.includes("--likho");

// ── 1. SACH — books/ ke ansh, usi kram me ────────────────────────────
// Kram maayne rakhta hai: naya .bin isi kram me banega, aur chunk_index
// ki panktiyan usi kram me. Files ko sort karke padhte hain taaki har
// machine par wahi kram bane.
const sach = [];
for (const f of readdirSync(BOOKS).filter(x => x.endsWith(".json")).sort()) {
  const j = JSON.parse(readFileSync(join(BOOKS, f), "utf8"));
  for (const c of j.chunks || []) sach.push({ id: c.id, book: c.book, page: c.page ?? null });
}
console.log(`\n  SACH (books/)        : ${sach.length.toLocaleString()} ansh`);

// ── 2. Purani files padho ────────────────────────────────────────────
// ⚠️ KRAM ULTA HAI — aur ye jaan-boojhkar hai.
// Alag-alag (per-book) files BAAD me bani hain, yaani wo naya paath
// rakhti hain. Isliye unhe PEHLE padhte hain aur `srot` me pehle aane
// wala jeetta hai. Ulta karne par ekadashi ka wo purana vector reh jaata
// jo bigde hue paath se bana tha.
const files = [
  ...readdirSync(PURANA).filter(f => /^chunk_index\..+\.json$/.test(f)).sort(),
  "chunk_index.json",
];

const srot = new Map();          // id -> { bin, row }
const bins = new Map();          // binFile -> Buffer
for (const f of files) {
  const suff = f === "chunk_index.json" ? "" : "." + f.slice("chunk_index.".length, -".json".length);
  const binF = `vectors_int8${suff}.bin`;
  const idx  = JSON.parse(readFileSync(join(PURANA, f), "utf8"));
  const buf  = readFileSync(join(PURANA, binF));
  if (buf.length !== idx.chunks.length * ROW) {
    console.error(`  ❌ ${binF} ka aakaar mel nahi khata: ${buf.length} vs ${idx.chunks.length * ROW}`);
    process.exit(1);
  }
  bins.set(binF, buf);
  let naye = 0;
  idx.chunks.forEach((c, i) => { if (!srot.has(c.id)) { srot.set(c.id, { bin: binF, row: i }); naye++; } });
  console.log(`  ${f.padEnd(38)} ${String(idx.chunks.length).padStart(6)} ansh, ${String(naye).padStart(6)} naye`);
}
console.log(`  ${"".padEnd(38)} ${"".padStart(6)}       ─────`);
console.log(`  vishisht id (chaaron milakar): ${srot.size.toLocaleString()}`);

// ── 3. Milaao ────────────────────────────────────────────────────────
const gayab = sach.filter(s => !srot.has(s.id));
const bekaar = srot.size - (sach.length - gayab.length);
console.log(`\n  sach me se vector mile : ${(sach.length - gayab.length).toLocaleString()}`);
console.log(`  GAYAB (vector nahi)    : ${gayab.length}`);
console.log(`  BEKAAR (ab kisi granth me nahi): ${bekaar.toLocaleString()}`);

if (gayab.length) {
  const kb = {};
  for (const g of gayab) kb[g.book] = (kb[g.book] || 0) + 1;
  console.log(`\n  ❌ ${gayab.length} ansh ka vector hai hi nahi:`);
  for (const [b, n] of Object.entries(kb)) console.log(`       ${b}  ${n}`);
  console.log(`\n     Inhe embed karna hoga:  node scripts/embed-corpus.mjs --books <granth>`);
  console.log(`     Bina iske ye ansh khoj se BAHAR ho jayenge. Ruk raha hoon.\n`);
  process.exit(1);
}

if (!LIKHO) {
  console.log(`
  ${"═".repeat(64)}
  Kuch LIKHA NAHI gaya.

  Likhne par banega:
      data/embeddings/chunk_index.json     ${sach.length.toLocaleString()} ansh
      data/embeddings/vectors_int8.bin     ${((sach.length * ROW) / 1048576).toFixed(1)} MB

  Purana folder (public/knowledge/embeddings/) HAATH NAHI lagega — use
  aap khud mitayenge, jab naya chal jaye aur script ke raaste badal jayein.

  Chalao:  node scripts/28_index_jodo.mjs --likho
`);
  process.exit(0);
}

// ── 4. Likho ─────────────────────────────────────────────────────────
mkdirSync(NAYA, { recursive: true });
const out = Buffer.allocUnsafe(sach.length * ROW);
sach.forEach((s, i) => {
  const { bin, row } = srot.get(s.id);
  bins.get(bin).copy(out, i * ROW, row * ROW, row * ROW + ROW);
});
writeFileSync(join(NAYA, "vectors_int8.bin"), out);
writeFileSync(join(NAYA, "chunk_index.json"), JSON.stringify({
  model: "@cf/baai/bge-m3",
  dim: DIM,
  rowBytes: ROW,
  count: sach.length,
  banaya: new Date().toISOString().slice(0, 10),
  chunks: sach,
}));

// ── 5. JAANCHO — likhne ke baad, andaze se nahi ──────────────────────
// Har baar ki tarah: apne likhe hue par bharosa mat karo, padh kar dekho.
const naya = JSON.parse(readFileSync(join(NAYA, "chunk_index.json"), "utf8"));
const nbuf = readFileSync(join(NAYA, "vectors_int8.bin"));
const kami = [];
if (naya.count !== sach.length)             kami.push(`count ${naya.count} vs ${sach.length}`);
if (naya.chunks.length !== sach.length)     kami.push(`chunks ${naya.chunks.length} vs ${sach.length}`);
if (nbuf.length !== sach.length * ROW)      kami.push(`bin ${nbuf.length} vs ${sach.length * ROW}`);
if (new Set(naya.chunks.map(c => c.id)).size !== sach.length) kami.push("duplicate id bache hain");

// 500 ansh par byte-ba-byte milaao — kahin row galat jagah se to nahi aayi
let step = Math.max(1, Math.floor(sach.length / 500)), jaanche = 0;
for (let i = 0; i < sach.length; i += step) {
  const { bin, row } = srot.get(sach[i].id);
  const a = bins.get(bin).subarray(row * ROW, row * ROW + ROW);
  const b = nbuf.subarray(i * ROW, i * ROW + ROW);
  if (!a.equals(b)) { kami.push(`row ${i} (${sach[i].id}) ka vector mel nahi khata`); break; }
  jaanche++;
}

console.log(`\n  ✅ likh diya:`);
console.log(`     data/embeddings/chunk_index.json   ${naya.chunks.length.toLocaleString()} ansh`);
console.log(`     data/embeddings/vectors_int8.bin   ${(statSync(join(NAYA, "vectors_int8.bin")).size / 1048576).toFixed(1)} MB`);
console.log(`     ${jaanche} vector byte-ba-byte milaye`);

if (kami.length) {
  console.log(`\n  ❌ JAANCH FAIL:`);
  for (const k of kami) console.log(`     ${k}`);
  console.log(`\n  Naye folder par bharosa MAT kijiye. Purana abhi bhi wahin hai.\n`);
  process.exit(1);
}

console.log(`
  ${"═".repeat(64)}
  Sab jaanch pass.

  AB YE KADAM, ISI KRAM ME:
    1. script ke raaste badlein (public/knowledge/embeddings → data/embeddings)
    2. node scripts/26_anaath_safai.mjs        → ANAATH 0 aana chahiye
    3. tab public/knowledge/embeddings/ mitayein
`);
