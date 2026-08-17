/**
 * SAARTHI — Ek sawaal ka poora retrieval pipeline dekho (2026-08-03)
 * =====================================================================
 * Jab bhi lage "is sawaal par galat granth aaya" ya "sahi granth kyun
 * nahi aaya", yeh chalao. Har kadam alag-alag dikhta hai:
 *
 *   1. query kaise Devanagari mein badla
 *   2. cosine ne kaun se top-15 chunks nikale (book + score)
 *   3. reranker ne har ek ko kya score diya
 *   4. MIN_RERANK_SCORE (0.5) ke baad kaun bacha
 *
 * CHALAO:
 *   node scripts/debug-query.mjs "मृत्यु के बाद आत्मा का क्या होता है"
 *   node scripts/debug-query.mjs "gussa kaise shant karein"
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toDevanagari } from "../src/knowledge/translit.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "data", "embeddings");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const DIM = 1024, ROW = 1028;
const MIN_RERANK_SCORE = 0.5;      // ChatView.jsx ka wahi constant
const SHOW = 15;

const query = process.argv.slice(2).join(" ").trim();
if (!query) { console.error('Istemal: node scripts/debug-query.mjs "aapka sawaal"'); process.exit(1); }

function loadEnv() {
  const out = { ...process.env };
  const p = join(ROOT, ".env");
  if (existsSync(p)) for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv();
const ACC = (env.CF_ACCOUNT_ID || "").trim(), TOK = (env.CF_API_TOKEN || "").trim();
if (!ACC || !TOK) { console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye"); process.exit(1); }
const api = (m) => `https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${m}`;

const idx = JSON.parse(readFileSync(join(EMB, "chunk_index.json"), "utf8"));
const buf = readFileSync(join(EMB, "vectors_int8.bin"));
const n = idx.count;
const scales = new Float32Array(n), q8 = new Int8Array(n * DIM);
for (let i = 0; i < n; i++) {
  scales[i] = buf.readFloatLE(i * ROW);
  for (let d = 0; d < DIM; d++) q8[i * DIM + d] = buf.readInt8(i * ROW + 4 + d);
}
const TEXT = new Map();
for (const f of readdirSync(BOOKS).filter(x => x.endsWith(".json"))) {
  const b = JSON.parse(readFileSync(join(BOOKS, f), "utf8"));
  for (const c of (b.chunks || [])) TEXT.set(c.id, (c.text || "").trim());
}

const dev = toDevanagari(query);
console.log(`\nsawaal   : ${query}`);
console.log(`translit : ${dev}${dev === query ? "   (pehle se Devanagari)" : ""}\n`);

// 1. cosine
const r1 = await fetch(api("@cf/baai/bge-m3"), {
  method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
  body: JSON.stringify({ text: [dev], truncate_inputs: true }),
});
const jj = await r1.json();
const raw = (jj?.result?.data || jj?.data)?.[0];
if (!raw) { console.error("embed fail:", JSON.stringify(jj).slice(0, 300)); process.exit(1); }
let nm = 0; for (const v of raw) nm += v * v; nm = Math.sqrt(nm) || 1;
const qv = new Float32Array(DIM); for (let d = 0; d < DIM; d++) qv[d] = raw[d] / nm;

const sc = new Float64Array(n);
for (let i = 0; i < n; i++) {
  const off = i * DIM; let dot = 0;
  for (let d = 0; d < DIM; d++) dot += q8[off + d] * qv[d];
  sc[i] = dot * scales[i] / 127;
}
const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => sc[b] - sc[a]).slice(0, SHOW);
const cands = order.map(i => ({ id: idx.chunks[i].id, book: idx.chunks[i].book, cos: sc[i] }));

// 2. rerank (max 20)
const r2 = await fetch(api("@cf/baai/bge-reranker-base"), {
  method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: dev,
    contexts: cands.map(c => ({ text: (TEXT.get(c.id) || "").slice(0, 1200) })),
    top_k: cands.length,
  }),
});
const j2 = await r2.json();
const list = j2?.result?.response || j2?.response;
const rr = new Array(cands.length).fill(0);
if (Array.isArray(list)) for (const it of list) {
  const i = it?.id ?? it?.index, s = it?.score ?? it?.relevance_score;
  if (Number.isInteger(i) && i < rr.length && typeof s === "number") rr[i] = s;
} else console.error("rerank shape:", JSON.stringify(j2).slice(0, 300));

console.log("  #   cosine   rerank   gate  book                     ansh");
console.log("  " + "-".repeat(104));
cands.forEach((c, i) => {
  const pass = rr[i] >= MIN_RERANK_SCORE;
  const snippet = (TEXT.get(c.id) || "").replace(/\s+/g, " ").slice(0, 42);
  console.log("  " + String(i + 1).padStart(2) + "   "
    + c.cos.toFixed(4) + "   " + rr[i].toFixed(4) + "   "
    + (pass ? " ✅ " : " ✗  ") + "  " + c.book.padEnd(24) + snippet);
});

const kept = cands.filter((_, i) => rr[i] >= MIN_RERANK_SCORE);
const books = [...new Set(kept.map(c => c.book))];
console.log("\n  " + "-".repeat(104));
console.log(`  gate ke baad bache : ${kept.length}/${cands.length}`);
console.log(`  granth             : ${books.length ? books.join(", ") : "(koi nahi — jawab bina source ke jayega)"}`);

// per-book best
const byBook = new Map();
cands.forEach((c, i) => {
  const cur = byBook.get(c.book);
  if (!cur || rr[i] > cur) byBook.set(c.book, rr[i]);
});
console.log(`\n  har granth ka best rerank score:`);
[...byBook.entries()].sort((a, b) => b[1] - a[1]).forEach(([b, s]) =>
  console.log(`    ${s >= MIN_RERANK_SCORE ? "✅" : "  "} ${b.padEnd(24)} ${s.toFixed(4)}`));
console.log();
