/**
 * SAARTHI — Ek sawaal ka poora retrieval pipeline dekho (2026-08-03)
 * =====================================================================
 * Jab bhi lage "is sawaal par galat granth aaya" ya "sahi granth kyun
 * nahi aaya", yeh chalao. Har kadam alag-alag dikhta hai:
 *
 *   1. query kaise Devanagari mein badla
 *   2. cosine ne kaun se top-15 chunks nikale (book + score)
 *   3. reranker ne har ek ko kya score diya
 *   4. server ka gate (0.30, naam liye granth par 0.18) ke baad kaun bacha
 *
 * CHALAO:
 *   node scripts/debug-query.mjs "मृत्यु के बाद आत्मा का क्या होता है"
 *   node scripts/debug-query.mjs "gussa kaise shant karein"
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeQueryForSearch, stripMetaFraming, expandQueryWithParyay, questionToTopic } from "../src/knowledge/translit.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "data", "embeddings");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const DIM = 1024, ROW = 1028;
// ⚠️ 18 AGAST 2026 KO THEEK KIYA — YE ANK JHOOTHA HO CHUKA THA.
// Yahan `0.5` likha tha aur uske aage tippani thi "ChatView.jsx ka wahi
// constant". Dono baatein ab galat hain:
//   1. ChatView ne 10 Agast ko apna gate HATA DIYA (line ~480 par poori
//      wajah likhi hai — do jagah ek hi niyam rakhne se wo server se
//      takra raha tha).
//   2. Asli gate ab SERVER par hai: SEARCH_MIN_RERANK = 0.30, aur jis
//      granth ka naam sawaal me liya gaya ho uske liye 0.18.
//
// Nateeja: ye script "gate ke baad bache" ki JHOOTHI ginti dikha rahi
// thi — asli se sakht. Aaj Sati wale sawaal ki jaanch me yahi bhram
// hua, aur kuch der ye lagta raha ki sahi ansh gate ne kaata jabki
// asli gate usse alag hai.
//
// Seekh wahi purani: ek hi ank do jagah likha ho to wo ek din alag ho
// hi jaata hai. Isliye ab dono yahan saath likhe hain, aur badalne par
// worker ke saath milana ZAROORI hai.
const MIN_RERANK_SCORE        = 0.30;   // worker: SEARCH_MIN_RERANK
const MIN_RERANK_HINTED       = 0.18;   // worker: SEARCH_HINTED_MIN_RERANK
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

// ⚠️ 18 AGAST 2026 — YE SCRIPT APP SE ALAG QUERY BHEJ RAHI THI.
//
// Pehle yahan sirf `toDevanagari(query)` tha, aur wahi dono jagah
// (cosine aur reranker) chala jaata tha. Par app TEEN kadam se guzarti
// hai, aur wo teeno alag-alag natija dete hain:
//
//   normalizeQueryForSearch → stripMetaFraming → expandQueryWithParyay  (cosine/FTS ko)
//                                              → questionToTopic       (reranker ko)
//
// Farq chhota nahi tha:
//     debug-query :  "सती के जन्म की story क्या है?"     ← "story" angrezi hi rahi
//     APP         :  "सती के जन्म की कथा क्या है?"        ← "कथा" ban gaya
//
// Yaani jab bhi is script se "reranker ne galat score diya" ka nidaan
// kiya jaata, wo APP KE SCORE THE HI NAHI. Aaj Sati aur Makar Rashi ki
// jaanch me theek yahi hua — kuch der galat ank par bahas hoti rahi.
//
// Ye wahi kism ki galti hai jo isi file me gate ke ank (0.5 vs asli 0.30)
// ke saath thi. Debug-auzaar agar app se alag chale to wo nidaan nahi,
// bhram deta hai — aur uska bhram sabse mehnga hota hai, kyunki uspar
// bharosa karke asli code badla jaata hai.
const { query: nq } = normalizeQueryForSearch(query);
const baseQ  = stripMetaFraming(nq);
const findQ  = expandQueryWithParyay(baseQ);   // cosine + FTS ko yahi jaata hai
const rerankQ = questionToTopic(baseQ);        // reranker ko yahi jaata hai
const dev = findQ;

console.log(`\nsawaal   : ${query}`);
console.log(`findQ    : ${findQ}          (cosine/FTS ko)`);
console.log(`rerankQ  : ${rerankQ}          (reranker ko)`);
if (findQ !== rerankQ) console.log(`           ⚠️ dono alag hain — app me bhi aisa hi hai`);
console.log();

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
    query: rerankQ,   // ⚠️ reranker ko rerankQ, findQ NAHI — app bhi yahi karti hai
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
