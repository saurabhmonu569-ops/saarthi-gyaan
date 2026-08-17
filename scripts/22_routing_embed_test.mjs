/**
 * SAARTHI — GRANTH CHUNAV, DOOSRI KOSHISH: matlab se, shabd se nahi
 * =====================================================================
 * 2026-08-14.  YE EK JAANCH HAI, SUDHAAR NAHI. App me kuch nahi badalta.
 *
 * PEHLI KOSHISH FAIL HUI (21_book_routing_test.mjs):
 *   shabd-ginti se granth chunne par top-3 sirf 58.6% (chahiye tha 90%).
 *   Wajah: "Agni Puran" ka sawaal Rigveda par chala jaata hai, kyunki
 *   "अग्नि" Rigveda me hazaron baar hai. Shabd ginna MATLAB nahi samajhta.
 *
 * AB EMBEDDING SE — wahi cheez jo Vectorize me pehle se padi hai.
 *
 * ⚠️ SABSE ZAROORI FAISLA — "aausat" NAHI, "sabse achhe 3"
 * ---------------------------------------------------------
 * Seedha tareeka hota: har granth ka ek aausat vector banao aur sawaal
 * usse milao. Wo GALAT hota — Mahabharat ke 25,856 ansh ka aausat itna
 * dhundhla hai ki uska koi matlab nahi bachta.
 *
 * Isliye har granth ka score = uske SABSE ACHHE 3 ansh ka aausat.
 * Yaani: "is granth ke paas is sawaal ka sabse achha maal kitna achha
 * hai?" — chahe granth me 155 ansh hon ya 25,856.
 *
 * YAHI WO CHEEZ HAI JO AAJ NAHI HOTI. Abhi vector-khoj top-45 ansh
 * uthati hai, aur bade granth apni GINTI se pool bhar dete hain
 * (naapa: pool=85 me mahabharata 62). Gunvatta nahi, ginti jeetti hai.
 *
 * ⚠️ IMAANDARI: granth ke vector SIRF corpus se hain. Test ke sawaal
 * inme kabhi nahi jaate.
 *
 * CHALAO:
 *   node scripts/22_routing_embed_test.mjs              # 200 sawaal
 *   node scripts/22_routing_embed_test.mjs --n 400
 *   node scripts/22_routing_embed_test.mjs --nohint     # sirf bina-naam wale
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "data", "embeddings");
const BIN  = join(EMB, "vectors_int8.bin");
const IDX  = join(EMB, "chunk_index.json");
const EVAL = join(ROOT, "eval-perbook.json");

for (const [p, kya] of [[BIN, "vectors_int8.bin"], [IDX, "chunk_index.json"], [EVAL, "eval-perbook.json"]])
  if (!existsSync(p)) { console.error(`❌ ${kya} nahi mili: ${p}`); process.exit(1); }

// ── .env ──────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const ACC = (env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const TOK = (env.CF_API_TOKEN  || env.CLOUDFLARE_API_TOKEN  || "").trim();
if (!ACC || !TOK) {
  console.error("❌ .env me CF_ACCOUNT_ID aur CF_API_TOKEN chahiye (embedding ke liye).");
  process.exit(1);
}
const MODEL = "@cf/baai/bge-m3";
const API = `https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${MODEL}`;

const { normalizeQueryForSearch, expandQueryWithParyay, stripMetaFraming } =
  await import("../src/knowledge/translit.js");
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { BOOK_META } = await import("../src/data/bookMeta.js");

// ── ansh ke vector padho ──────────────────────────────────────────────
const idx = JSON.parse(readFileSync(IDX, "utf8"));
const DIM = idx.dim, ROW = idx.rowBytes, N = idx.count;
if (statSync(BIN).size !== N * ROW) {
  console.error(`❌ vectors_int8.bin ka aakaar mel nahi khata — embed-corpus dobara chalayein.`);
  process.exit(1);
}
const buf = readFileSync(BIN);
console.log(`\n  ${N.toLocaleString()} ansh ke vector padhe (${DIM} aayaam)`);

// int8 → float, ek hi baar. 57,484 × 1024 float32 ≈ 235 MB.
const V = new Float32Array(N * DIM);
for (let i = 0; i < N; i++) {
  const off = i * ROW;
  const scale = buf.readFloatLE(off) / 127;
  for (let d = 0; d < DIM; d++) V[i * DIM + d] = buf.readInt8(off + 4 + d) * scale;
}
// har vector ko ek-lambai karo, taaki dot-product hi cosine ban jaye
for (let i = 0; i < N; i++) {
  let s = 0;
  for (let d = 0; d < DIM; d++) { const x = V[i * DIM + d]; s += x * x; }
  s = Math.sqrt(s) || 1;
  for (let d = 0; d < DIM; d++) V[i * DIM + d] /= s;
}
const bookOf = idx.chunks.map(c => c.book);
const books = [...new Set(bookOf)];
const bookIdx = new Map(books.map((b, i) => [b, i]));
const bi = new Int16Array(N);
for (let i = 0; i < N; i++) bi[i] = bookIdx.get(bookOf[i]);
console.log(`  ${books.length} granth\n`);

// ── sawaal chuno ──────────────────────────────────────────────────────
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const WANT = parseInt(arg("n", "200"), 10);
const onlyNoHint = process.argv.includes("--nohint");

let all = JSON.parse(readFileSync(EVAL, "utf8"));

// ⚠️ Jin granthon ke vector is file me hain HI NAHI, unke sawaal hatao.
//
// 17 Aug tak ye zaroori tha: baad me jude granth (Yogasutra) ki apni alag
// file banti thi, aur ye script sirf main file padhti thi — to Yogasutra
// ke sawaal hamesha "miss" ginte aur ank jhootha girta, jabki galti
// tareeke ki nahi, file purani hone ki hoti.
//
// 28_index_jodo.mjs ne saari files ek kar di, aur folder data/embeddings
// me aa gaya. Ab yahan sab 25 granth hain aur ye chhanni kuch hatati nahi.
// Phir bhi rakhi hai — agli baar koi granth jude aur embed karna bhool
// jayein, to ye chup-chaap jhootha ank dene ke bajay saaf bata degi.
const naapne_layak = new Set(books);
const chhoote = [...new Set(all.filter(r => !naapne_layak.has(r.book)).map(r => r.book))];
if (chhoote.length) console.log(`  ⚠️  is jaanch se bahar (vector-file me nahi): ${chhoote.join(", ")}\n`);
all = all.filter(r => naapne_layak.has(r.book));

if (onlyNoHint) all = all.filter(r => !detectHintedBook(r.q));
// har granth se barabar — warna bade granth naap par chha jaate
const perBook = Math.max(1, Math.round(WANT / books.length));
const chuna = [];
for (const b of books) {
  const mine = all.filter(r => r.book === b);
  for (let i = 0; i < mine.length && i < perBook; i++) {
    const step = Math.max(1, Math.floor(mine.length / perBook));
    chuna.push(mine[i * step] || mine[i]);
  }
}
const sawaal = chuna.filter(Boolean);
console.log(`  ${sawaal.length} sawaal chune (${onlyNoHint ? "sirf bina-naam wale" : "sab me se"}, har granth se barabar)\n`);

// ── embed ─────────────────────────────────────────────────────────────
/** wahi query jo /search ko jaati hai — warna naap asli se alag hogi */
const findQFor = q => expandQueryWithParyay(stripMetaFraming(normalizeQueryForSearch(q).query));

async function embed(texts, koshish = 1) {
  const r = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texts, truncate_inputs: true }),
  });
  if (!r.ok) {
    if (koshish >= 4) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
    await new Promise(s => setTimeout(s, 2000 * koshish));
    return embed(texts, koshish + 1);
  }
  const j = await r.json();
  return j?.result?.data || j?.data;
}

const BATCH = 50;
const qvec = [];
for (let i = 0; i < sawaal.length; i += BATCH) {
  const slice = sawaal.slice(i, i + BATCH).map(r => findQFor(r.q));
  qvec.push(...await embed(slice));
  process.stdout.write(`\r  embed: ${Math.min(i + BATCH, sawaal.length)}/${sawaal.length}   `);
}
console.log("\n");

// ── har sawaal par granth ka kram ─────────────────────────────────────
const TOP_K = 3;                        // har granth ke sabse achhe 3 ansh
const hit = { t1: 0, t2: 0, t3: 0, t5: 0 };
const perBookKram = {};
const namoone = [];

for (let s = 0; s < sawaal.length; s++) {
  const q = new Float32Array(qvec[s]);
  let qn = 0; for (let d = 0; d < DIM; d++) qn += q[d] * q[d];
  qn = Math.sqrt(qn) || 1;
  for (let d = 0; d < DIM; d++) q[d] /= qn;

  // har granth ke top-3 score rakho (chhota heap ki zaroorat nahi — 3 hi hain)
  const best = books.map(() => [-2, -2, -2]);
  for (let i = 0; i < N; i++) {
    let dot = 0;
    const off = i * DIM;
    for (let d = 0; d < DIM; d++) dot += V[off + d] * q[d];
    const t = best[bi[i]];
    if (dot > t[2]) {
      if (dot > t[0]) { t[2] = t[1]; t[1] = t[0]; t[0] = dot; }
      else if (dot > t[1]) { t[2] = t[1]; t[1] = dot; }
      else t[2] = dot;
    }
  }
  const score = books.map((b, k) => [b, (best[k][0] + best[k][1] + best[k][2]) / TOP_K]);
  score.sort((a, b) => b[1] - a[1]);

  const kram = score.findIndex(([b]) => b === sawaal[s].book);
  if (kram === 0) hit.t1++;
  if (kram >= 0 && kram < 2) hit.t2++;
  if (kram >= 0 && kram < 3) hit.t3++;
  if (kram >= 0 && kram < 5) hit.t5++;
  (perBookKram[sawaal[s].book] ??= []).push(kram);
  if (namoone.length < 6 && kram >= 3)
    namoone.push([sawaal[s].q, sawaal[s].book, score.slice(0, 3).map(([b]) => b)]);

  process.stdout.write(`\r  jaanch: ${s + 1}/${sawaal.length}   `);
}
console.log("\n");

// ── nateeja ───────────────────────────────────────────────────────────
const n = sawaal.length, pct = k => `${(100 * k / n).toFixed(1)}%`;
console.log(`  ── EMBEDDING se granth chunav (har granth ke sabse achhe ${TOP_K} ansh) ──\n`);
console.log(`  sahi granth sabse UPAR   : ${String(hit.t1).padStart(4)}  ${pct(hit.t1)}`);
console.log(`  sahi granth TOP-2 me     : ${String(hit.t2).padStart(4)}  ${pct(hit.t2)}`);
console.log(`  sahi granth TOP-3 me     : ${String(hit.t3).padStart(4)}  ${pct(hit.t3)}   ← asli ank`);
console.log(`  sahi granth TOP-5 me     : ${String(hit.t5).padStart(4)}  ${pct(hit.t5)}\n`);

console.log(`  pehli koshish (shabd-ginti) : top-3  58.6%`);
console.log(`  ab (embedding)              : top-3  ${pct(hit.t3)}\n`);

const naam = id => (BOOK_META[id]?.en || id);
console.log(`  ${"GRANTH".padEnd(24)} top-1   top-3`);
console.log(`  ${"─".repeat(46)}`);
for (const [b, ks] of Object.entries(perBookKram).sort((a, b) =>
  a[1].filter(k => k >= 0 && k < 3).length / a[1].length - b[1].filter(k => k >= 0 && k < 3).length / b[1].length)) {
  const t1 = 100 * ks.filter(k => k === 0).length / ks.length;
  const t3 = 100 * ks.filter(k => k >= 0 && k < 3).length / ks.length;
  console.log(`  ${naam(b).slice(0, 22).padEnd(24)} ${t1.toFixed(0).padStart(4)}%  ${t3.toFixed(0).padStart(5)}%${t3 < 60 ? "  ⚠️" : ""}`);
}

if (namoone.length) {
  console.log(`\n  ── jahan sahi granth top-3 me bhi nahi ──`);
  for (const [q, sahi, top3] of namoone) {
    console.log(`     ${q.slice(0, 62)}`);
    console.log(`       chahiye: ${sahi}  |  mila: ${top3.join(", ")}`);
  }
}

console.log(`
  ─────────────────────────────────────────────────────────────────
  KASAUTI — 21_book_routing_test.mjs me PEHLE SE likhi:

    top-3  90%+       →  raasta saaf, banane layak
    top-3  75-90%     →  kaam karega, par akela kaafi nahi
    top-3  75% se kam →  ye raasta bhi chhod dein
  ─────────────────────────────────────────────────────────────────
`);
