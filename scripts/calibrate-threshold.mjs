/**
 * SAARTHI — Threshold calibration v2 (Phase B1, 2026-08-03)
 * =====================================================================
 * v1 ka nateeja: top1 par in-corpus aur out-of-corpus overlap kar gaye
 * (gap −0.0247). Par gaur se dekhne par pata chala ki dono "fail" hone
 * wale in-corpus sawaal wahi the jo ROMAN/Hinglish mein likhe the.
 * Sirf Devanagari sawaalon mein gap saaf tha (0.5814 vs 0.5069).
 *
 * Aur hubness naapne par: lal_kitab / rashi_muhurt_vigyan corpus ke
 * sabse door wale (outlier) granth hain — isiliye har out-of-distribution
 * sawaal (Roman script, tech topic) inhi se match karta hai.
 *
 * v2 do cheezein alag-alag naapta hai:
 *
 *  1. SCRIPT KA ASAR — wahi sawaal Roman aur Devanagari dono mein,
 *     jodi banakar. Isse pata chalega ki Hinglish ko Devanagari mein
 *     badalna kitna faayda deta hai.
 *
 *  2. DISTRIBUTION-AWARE SCORE — raw cosine ke saath z-score bhi:
 *         z = (top1 − corpus_mean) / corpus_std
 *     Idea: achhe sawaal ka top1 apne hi background se BAHUT upar hota
 *     hai; kachre sawaal ka top1 background ke paas hi rehta hai. Agar z
 *     saaf batwara deta hai toh threshold z par lagega, raw cosine par
 *     nahi — aur woh script/lambai ke badlav se nahi tootega.
 *
 * CHALAO:  node scripts/calibrate-threshold.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "data", "embeddings");
const MODEL = "@cf/baai/bge-m3";
const DIM = 1024, ROW = 1028;

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
const ACCOUNT_ID = (env.CF_ACCOUNT_ID || "").trim();
const API_TOKEN  = (env.CF_API_TOKEN  || "").trim();
if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye");
  process.exit(1);
}
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

const idx = JSON.parse(readFileSync(join(EMB, "chunk_index.json"), "utf8"));
const buf = readFileSync(join(EMB, "vectors_int8.bin"));
const n = idx.count;
const scales = new Float32Array(n);
const q = new Int8Array(n * DIM);
for (let i = 0; i < n; i++) {
  scales[i] = buf.readFloatLE(i * ROW);
  for (let d = 0; d < DIM; d++) q[i * DIM + d] = buf.readInt8(i * ROW + 4 + d);
}
console.log(`corpus: ${n.toLocaleString()} vectors (${idx.model})\n`);

async function embed(texts) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texts, truncate_inputs: true }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j?.result?.data || j?.data;
}

/** Poore corpus ka score nikaalo — top-k ke saath mean/std bhi. */
function analyse(qvRaw, k = 5) {
  let norm = 0; for (const v of qvRaw) norm += v * v; norm = Math.sqrt(norm) || 1;
  const qv = new Float32Array(DIM);
  for (let d = 0; d < DIM; d++) qv[d] = qvRaw[d] / norm;

  const all = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const off = i * DIM;
    let dot = 0;
    for (let d = 0; d < DIM; d++) dot += q[off + d] * qv[d];
    const s = dot * scales[i] / 127;
    all[i] = s; sum += s;
  }
  const mean = sum / n;
  let varr = 0;
  for (let i = 0; i < n; i++) { const d = all[i] - mean; varr += d * d; }
  const std = Math.sqrt(varr / n) || 1e-9;

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => all[b] - all[a]);
  const top = order.slice(0, k).map(i => ({ book: idx.chunks[i].book, score: all[i] }));
  return { top, mean, std, z: (top[0].score - mean) / std, z3: ((top[0].score + top[1].score + top[2].score) / 3 - mean) / std };
}

// ── test set ──────────────────────────────────────────────────────────
// Jodiyaan: wahi matlab, alag script — script ka asar isolate karne ke liye.
const PAIRS = [
  ["family mein ego kaise kam karein",          "परिवार में अहंकार कैसे कम करें"],
  ["Ek IAS aspirant baar-baar fail ho raha hai", "एक विद्यार्थी बार-बार परीक्षा में असफल हो रहा है"],
  ["gussa kaise shant karein",                   "गुस्सा कैसे शांत करें"],
  ["mrityu ke baad aatma ka kya hota hai",       "मृत्यु के बाद आत्मा का क्या होता है"],
];

const IN_DEV = [
  "कर्म योग क्या है?",
  "एकादशी व्रत का महत्व क्या है?",
  "चाणक्य नीति में मित्र के बारे में क्या कहा गया है?",
  "लाल किताब में शनि का उपाय क्या है?",
  "मृत्यु के बाद आत्मा का क्या होता है?",
  "गुस्सा कैसे शांत करें?",
  "क्रोध पर गीता क्या कहती है?",
  "श्राद्ध कर्म कैसे करना चाहिए?",
];

const OUT_DEV = [
  "मेरा लैपटॉप बार-बार बंद हो जाता है क्या करूं?",
  "क्रिकेट मैच का स्कोर क्या है?",
  "पायथन में लूप कैसे लिखते हैं?",
  "बिटकॉइन का भाव आज क्या है?",
  "मुंबई से दिल्ली की फ्लाइट कितने की है?",
  "ओसीआर में गलती हो तो क्या करें?",
];

const HEALTH = ["बवासीर नाशक टोटका बताइए", "मुझे बुखार है क्या दवा लूं?"];

// ── 1. script effect ──────────────────────────────────────────────────
console.log("═".repeat(78));
console.log("1. SCRIPT KA ASAR — wahi sawaal, Roman vs Devanagari");
console.log("═".repeat(78));
console.log("\n  " + "sawaal".padEnd(42) + "roman→   deva→    farak");
const flat = PAIRS.flat();
const pv = await embed(flat);
let gain = 0;
for (let i = 0; i < PAIRS.length; i++) {
  const r = analyse(pv[i * 2]), d = analyse(pv[i * 2 + 1]);
  gain += d.top[0].score - r.top[0].score;
  console.log("  " + PAIRS[i][1].slice(0, 40).padEnd(42)
    + r.top[0].score.toFixed(4) + "   " + d.top[0].score.toFixed(4)
    + "   " + (d.top[0].score - r.top[0].score >= 0 ? "+" : "") + (d.top[0].score - r.top[0].score).toFixed(4));
}
console.log(`\n  ➜ Devanagari mein badalne se aausat faayda: ${(gain / PAIRS.length >= 0 ? "+" : "")}${(gain / PAIRS.length).toFixed(4)}`);

// ── 2. raw vs z-score ─────────────────────────────────────────────────
async function runSet(label, queries) {
  console.log(`\n${"═".repeat(78)}\n${label}\n${"═".repeat(78)}`);
  console.log("\n  " + "sawaal".padEnd(46) + "top1     mean     z      top-book");
  const vecs = await embed(queries);
  const rows = [];
  for (let i = 0; i < queries.length; i++) {
    const a = analyse(vecs[i]);
    rows.push({ q: queries[i], ...a });
    console.log("  " + queries[i].slice(0, 44).padEnd(46)
      + a.top[0].score.toFixed(4) + "   " + a.mean.toFixed(4) + "   "
      + a.z.toFixed(2).padStart(5) + "   " + a.top[0].book);
  }
  return rows;
}

const inRows  = await runSet("2. IN-CORPUS (Devanagari)", IN_DEV);
const outRows = await runSet("3. OUT-OF-CORPUS (Devanagari)", OUT_DEV);
const hRows   = await runSet("4. SWASTHYA", HEALTH);

// ── 3. verdict ────────────────────────────────────────────────────────
function gap(a, b, key) {
  const minIn = Math.min(...a.map(r => r[key]));
  const maxOut = Math.max(...b.map(r => r[key]));
  return { minIn, maxOut, gap: minIn - maxOut };
}
const rawG = (() => {
  const minIn = Math.min(...inRows.map(r => r.top[0].score));
  const maxOut = Math.max(...outRows.map(r => r.top[0].score));
  return { minIn, maxOut, gap: minIn - maxOut };
})();
const zG = gap(inRows, outRows, "z");

console.log(`\n\n${"═".repeat(78)}\nNATEEJA\n${"═".repeat(78)}\n`);
console.log("  paimana        in-min    out-max     gap");
console.log("  " + "-".repeat(46));
console.log(`  raw cosine     ${rawG.minIn.toFixed(4)}    ${rawG.maxOut.toFixed(4)}    ${rawG.gap >= 0 ? "+" : ""}${rawG.gap.toFixed(4)}  ${rawG.gap > 0 ? "✅" : "❌"}`);
console.log(`  z-score        ${zG.minIn.toFixed(2).padStart(6)}    ${zG.maxOut.toFixed(2).padStart(6)}    ${zG.gap >= 0 ? "+" : ""}${zG.gap.toFixed(2)}  ${zG.gap > 0 ? "✅" : "❌"}`);
console.log();
console.log("  swasthya:  " + hRows.map(r => `raw ${r.top[0].score.toFixed(3)} / z ${r.z.toFixed(2)}`).join("   |   "));
console.log();

const useZ = zG.gap > 0 && (rawG.gap <= 0 || zG.gap / Math.abs(zG.minIn || 1) > rawG.gap / Math.abs(rawG.minIn || 1));
if (zG.gap > 0 || rawG.gap > 0) {
  if (useZ) {
    console.log(`  ➜ Z-SCORE behtar hai. MIN_Z = ${((zG.minIn + zG.maxOut) / 2).toFixed(2)}`);
    console.log(`    (script/lambai badalne par bhi tikega — yehi asli faayda hai)`);
  } else {
    console.log(`  ➜ RAW COSINE kaafi hai. MIN_ABSOLUTE_SCORE = ${((rawG.minIn + rawG.maxOut) / 2).toFixed(3)}`);
  }
} else {
  console.log("  ⚠️  dono paimanon par overlap. Query normalization (Hinglish→Devanagari)");
  console.log("     pehle karna padega, phir dobara naapo.");
}
console.log();
