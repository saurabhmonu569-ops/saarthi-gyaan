/**
 * SAARTHI — Cross-encoder reranker ka test (Phase B1d, 2026-08-03)
 * =====================================================================
 * AB TAK KA SAFAR (sab naapa hua):
 *   raw Roman query            gap −0.05   ❌
 *   syllable translit          gap −0.06   ❌  kachra bhi upar chadh gaya
 *   lexicon translit           gap +0.006  ⚠️  bahut patla
 *   llama-3.2-3b normalize     gap −0.009  ❌  anuvaad mein galtiyan
 *
 * Teeno tareeke ek hi sawaal poochh rahe the: "kya YEH SAWAAL corpus se
 * jawab de sakta hai?" — sirf query dekh kar. Aur teeno kamzor nikle.
 *
 * Asli sawaal alag hai: "jo PASSAGE mila, kya wo is sawaal ka jawab deta
 * hai?" Cosine yeh bata hi nahi sakta — bi-encoder mein query aur passage
 * alag-alag embed hote hain, kabhi saath nahi dekhe jaate.
 *
 * Cross-encoder reranker dono ko EK SAATH padhta hai. Retrieval mein
 * relevance-judgement ka yahi standard auzaar hai.
 *
 *   @cf/baai/bge-reranker-base — 283 neurons/M tokens (sabse sasta)
 *   Output: [0,1] ka relevance score, sigmoid ke baad.
 *
 * KHATRA (imaandari se): bge-reranker-BASE mukhya roop se English/Chinese
 * par train hua hai. Hindi par kitna achha hai — yeh naapna hi is script
 * ka maqsad hai. Kaam na kare toh yeh raasta bhi chhod denge.
 *
 * CHALAO:  node scripts/test-reranker.mjs
 * KHARCHA: ~13 sawaal x 8 passage = na ke barabar (~12 neurons)
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toDevanagari } from "../src/knowledge/translit.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "public", "knowledge", "embeddings");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const DIM = 1024, ROW = 1028;
const TOP_K = 8;          // kitne passage rerank karein

function loadEnv() {
  const out = { ...process.env };
  const p = join(ROOT, ".env");
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
const env = loadEnv();
const ACC = (env.CF_ACCOUNT_ID || "").trim();
const TOK = (env.CF_API_TOKEN || "").trim();
if (!ACC || !TOK) { console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye"); process.exit(1); }
const run = (m) => `https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${m}`;

// ── corpus vectors ────────────────────────────────────────────────────
const idx = JSON.parse(readFileSync(join(EMB, "chunk_index.json"), "utf8"));
const buf = readFileSync(join(EMB, "vectors_int8.bin"));
const n = idx.count;
const scales = new Float32Array(n);
const qv8 = new Int8Array(n * DIM);
for (let i = 0; i < n; i++) {
  scales[i] = buf.readFloatLE(i * ROW);
  for (let d = 0; d < DIM; d++) qv8[i * DIM + d] = buf.readInt8(i * ROW + 4 + d);
}

// ── chunk texts (reranker ko asli text chahiye) ───────────────────────
const TEXT = new Map();
for (const f of readdirSync(BOOKS).filter(x => x.endsWith(".json"))) {
  const b = JSON.parse(readFileSync(join(BOOKS, f), "utf8"));
  for (const c of (b.chunks || [])) TEXT.set(c.id, (c.text || "").trim());
}
console.log(`corpus: ${n.toLocaleString()} vectors, ${TEXT.size.toLocaleString()} texts\n`);

async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 25) {
    const r = await fetch(run("@cf/baai/bge-m3"), {
      method: "POST",
      headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts.slice(i, i + 25), truncate_inputs: true }),
    });
    if (!r.ok) throw new Error(`embed HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    out.push(...(j?.result?.data || j?.data));
  }
  return out;
}

function topK(qvRaw, k = TOP_K) {
  let nm = 0; for (const v of qvRaw) nm += v * v; nm = Math.sqrt(nm) || 1;
  const qv = new Float32Array(DIM);
  for (let d = 0; d < DIM; d++) qv[d] = qvRaw[d] / nm;
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * DIM;
    let dot = 0;
    for (let d = 0; d < DIM; d++) dot += qv8[off + d] * qv[d];
    s[i] = dot * scales[i] / 127;
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => s[b] - s[a]).slice(0, k);
  return order.map(i => ({ id: idx.chunks[i].id, book: idx.chunks[i].book, cos: s[i] }));
}

async function rerank(query, passages) {
  const r = await fetch(run("@cf/baai/bge-reranker-base"), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      contexts: passages.map(p => ({ text: (TEXT.get(p.id) || "").slice(0, 1200) })),
    }),
  });
  if (!r.ok) return { err: `HTTP ${r.status} — ${(await r.text()).slice(0, 250)}` };
  const j = await r.json();
  const res = j?.result?.response || j?.result || j?.response;
  if (!Array.isArray(res)) return { err: `shape: ${JSON.stringify(j).slice(0, 250)}` };
  return { scores: res.map(x => x.score ?? x.relevance_score ?? 0) };
}

const GOOD = [
  "gussa kaise shant karein",
  "mrityu ke baad aatma ka kya hota hai",
  "family mein ego kaise kam karein",
  "Ek IAS aspirant baar-baar fail ho raha hai",
  "mera job chhut gaya hai bahut tension hai",
  "ekadashi vrat ka mahatva kya hai",
  "relationship mein trust kaise banaye",
  "मन की शांति के लिए क्या करें",
];
const JUNK = [
  "React useState hook kaise use karte hain",
  "Bitcoin ka price abhi kya hai",
  "IPL 2026 final kaun jeeta",
  "OCR me error ho to AI kya kare",
  "mera laptop baar baar band ho jata hai",
];

async function evaluate(label, queries) {
  console.log("═".repeat(94));
  console.log(label);
  console.log("═".repeat(94));
  console.log("\n  " + "sawaal".padEnd(42) + "cos-top1   rerank-max   top-book");
  console.log("  " + "-".repeat(90));
  const dev = queries.map(toDevanagari);
  const vecs = await embed(dev);
  const rows = [];
  for (let i = 0; i < queries.length; i++) {
    const hits = topK(vecs[i]);
    const rr = await rerank(dev[i], hits);
    if (rr.err) { console.log("  " + queries[i].slice(0, 40).padEnd(42) + "RERANK FAIL — " + rr.err); continue; }
    const max = Math.max(...rr.scores);
    const bestIdx = rr.scores.indexOf(max);
    rows.push({ q: queries[i], cos: hits[0].cos, rr: max });
    console.log("  " + queries[i].slice(0, 40).padEnd(42)
      + hits[0].cos.toFixed(4) + "     " + max.toFixed(4) + "      " + hits[bestIdx].book);
  }
  return rows;
}

const g = await evaluate("SAHI SAWAAL (granth cite hone chahiye)", GOOD);
console.log();
const j = await evaluate("KACHRE SAWAAL (granth NAHI cite hone chahiye)", JUNK);

if (g.length && j.length) {
  const cosGap = Math.min(...g.map(r => r.cos)) - Math.max(...j.map(r => r.cos));
  const rrMin = Math.min(...g.map(r => r.rr)), rrMax = Math.max(...j.map(r => r.rr));
  console.log(`\n${"═".repeat(94)}\nNATEEJA\n${"═".repeat(94)}\n`);
  console.log("  paimana        sahi-min   kachra-max      gap");
  console.log("  " + "-".repeat(56));
  console.log(`  cosine         ${Math.min(...g.map(r => r.cos)).toFixed(4)}     ${Math.max(...j.map(r => r.cos)).toFixed(4)}      ${cosGap >= 0 ? "+" : ""}${cosGap.toFixed(4)}  ${cosGap > 0 ? "✅" : "❌"}`);
  console.log(`  reranker       ${rrMin.toFixed(4)}     ${rrMax.toFixed(4)}      ${rrMin - rrMax >= 0 ? "+" : ""}${(rrMin - rrMax).toFixed(4)}  ${rrMin > rrMax ? "✅" : "❌"}`);
  console.log();
  if (rrMin > rrMax) {
    console.log(`  ➜ RERANKER JEETA. MIN_RERANK_SCORE = ${((rrMin + rrMax) / 2).toFixed(3)}`);
    console.log(`    margin dono taraf: ${((rrMin - rrMax) / 2).toFixed(4)}`);
    console.log(`    (cosine se ${((rrMin - rrMax) / Math.max(cosGap, 0.0001)).toFixed(1)}x behtar separation)`);
  } else {
    console.log(`  ❌ reranker se bhi saaf batwara nahi. Hindi par bge-reranker-base kamzor lagta hai.`);
  }
}
console.log();
