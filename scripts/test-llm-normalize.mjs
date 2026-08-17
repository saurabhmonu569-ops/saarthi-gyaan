/**
 * SAARTHI — LLM query-normalization ka test (Phase B1c, 2026-08-03)
 * =====================================================================
 * Kahan tak pahunche:
 *   raw Roman                    → gap −0.05  ❌
 *   syllable translit (sab kuch) → gap −0.06  ❌ (kachra bhi upar chadha)
 *   lexicon translit (sirf Hindi)→ gap +0.006 ✅ par bahut patla
 *
 * Bacha hua ek hi case: jab sawaal mein ANGREZI CONTENT-SHABD hon —
 * "Ek IAS aspirant baar-baar fail ho raha hai" (sirf 18% recovery).
 * Gold version inhe "विद्यार्थी"/"परीक्षा" mein ANUVAAD karta hai.
 * Transliteration anuvaad kabhi nahi kar sakti — chahe kitni achhi ho.
 *
 * Yeh script naapti hai ki chhota LLM woh anuvaad kar paata hai ya nahi,
 * aur do model compare karti hai (dono ka daam barabar hai):
 *   @cf/meta/llama-3.2-3b-instruct   4625 neurons/M in
 *   @cf/qwen/qwen3-30b-a3b-fp8       4625 neurons/M in  ← bada, same daam
 *
 * CHALAO:  node scripts/test-llm-normalize.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toDevanagari, devanagariRatio } from "../src/knowledge/translit.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "data", "embeddings");
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
const ACC = (env.CF_ACCOUNT_ID || "").trim();
const TOK = (env.CF_API_TOKEN || "").trim();
if (!ACC || !TOK) { console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye"); process.exit(1); }
const run = (model) => `https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${model}`;

// corpus
const idx = JSON.parse(readFileSync(join(EMB, "chunk_index.json"), "utf8"));
const buf = readFileSync(join(EMB, "vectors_int8.bin"));
const n = idx.count;
const scales = new Float32Array(n);
const qv8 = new Int8Array(n * DIM);
for (let i = 0; i < n; i++) {
  scales[i] = buf.readFloatLE(i * ROW);
  for (let d = 0; d < DIM; d++) qv8[i * DIM + d] = buf.readInt8(i * ROW + 4 + d);
}

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

function top1(qvRaw) {
  let nm = 0; for (const v of qvRaw) nm += v * v; nm = Math.sqrt(nm) || 1;
  const qv = new Float32Array(DIM);
  for (let d = 0; d < DIM; d++) qv[d] = qvRaw[d] / nm;
  let best = -2;
  for (let i = 0; i < n; i++) {
    const off = i * DIM;
    let dot = 0;
    for (let d = 0; d < DIM; d++) dot += qv8[off + d] * qv[d];
    const s = dot * scales[i] / 127;
    if (s > best) best = s;
  }
  return best;
}

const SYS = "You rewrite user questions into natural Hindi in Devanagari script. "
  + "Translate English words into their Hindi equivalents. Keep the meaning identical. "
  + "Do not answer the question. Do not explain. Output ONLY the rewritten Hindi sentence.";

async function normalize(model, text) {
  const r = await fetch(run(model), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "system", content: SYS }, { role: "user", content: text }],
      temperature: 0, max_tokens: 120,
    }),
  });
  if (!r.ok) return { text: null, err: `HTTP ${r.status} ${(await r.text()).slice(0, 120)}` };
  const j = await r.json();
  let s = (j?.result?.response ?? j?.result?.output ?? "").toString().trim();
  s = s.split("\n").map(x => x.trim()).filter(Boolean)[0] || s;   // pehli line
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
  return { text: s };
}

const GOOD = [
  ["gussa kaise shant karein",                   "गुस्सा कैसे शांत करें"],
  ["mrityu ke baad aatma ka kya hota hai",       "मृत्यु के बाद आत्मा का क्या होता है"],
  ["family mein ego kaise kam karein",           "परिवार में अहंकार कैसे कम करें"],
  ["Ek IAS aspirant baar-baar fail ho raha hai", "एक विद्यार्थी बार-बार परीक्षा में असफल हो रहा है"],
  ["mera job chhut gaya hai bahut tension hai",  "मेरी नौकरी छूट गई है बहुत चिंता है"],
  ["ekadashi vrat ka mahatva kya hai",           "एकादशी व्रत का महत्व क्या है"],
  ["relationship mein trust kaise banaye",       "रिश्ते में विश्वास कैसे बनाएँ"],
  ["mann ki shanti ke liye kya karein",          "मन की शांति के लिए क्या करें"],
];
const JUNK = [
  "React useState hook kaise use karte hain",
  "Bitcoin ka price abhi kya hai",
  "IPL 2026 final kaun jeeta",
  "OCR me error ho to AI kya kare",
  "mera laptop baar baar band ho jata hai",
];

const MODELS = ["@cf/meta/llama-3.2-3b-instruct", "@cf/qwen/qwen3-30b-a3b-fp8"];

console.log(`corpus: ${n.toLocaleString()} vectors\n`);

// baseline: sirf lexicon translit
const baseGood = await embed(GOOD.map(g => toDevanagari(g[0])));
const baseJunk = await embed(JUNK.map(toDevanagari));
const bg = baseGood.map(top1), bj = baseJunk.map(top1);
const rawGood = await embed(GOOD.map(g => g[0]));
const rg = rawGood.map(top1);
const goldE = await embed(GOOD.map(g => g[1]));
const gd = goldE.map(top1);

console.log("═".repeat(96));
console.log("BASELINE — sirf lexicon translit (abhi jo hai)");
console.log("═".repeat(96));
console.log(`  sahi min ${Math.min(...bg).toFixed(4)}   kachra max ${Math.max(...bj).toFixed(4)}   gap ${(Math.min(...bg) - Math.max(...bj)).toFixed(4)}`);

for (const model of MODELS) {
  const t0 = Date.now();
  console.log(`\n${"═".repeat(96)}\n${model}\n${"═".repeat(96)}`);

  const gTexts = [], jTexts = [];
  for (const [rom] of GOOD) gTexts.push((await normalize(model, rom)).text || rom);
  for (const rom of JUNK)   jTexts.push((await normalize(model, rom)).text || rom);
  const ms = Math.round((Date.now() - t0) / (GOOD.length + JUNK.length));

  const ge = (await embed(gTexts)).map(top1);
  const je = (await embed(jTexts)).map(top1);

  console.log("\n  SAHI SAWAAL");
  console.log("  " + "roman".padEnd(40) + "raw     lex     llm     gold");
  for (let i = 0; i < GOOD.length; i++) {
    console.log("  " + GOOD[i][0].slice(0, 38).padEnd(40)
      + rg[i].toFixed(4) + "  " + bg[i].toFixed(4) + "  " + ge[i].toFixed(4) + "  " + gd[i].toFixed(4));
    console.log("      llm→ " + gTexts[i].slice(0, 80));
  }
  console.log("\n  KACHRE SAWAAL (neeche rehne chahiye)");
  for (let i = 0; i < JUNK.length; i++) {
    console.log("  " + JUNK[i].slice(0, 40).padEnd(42) + "lex " + bj[i].toFixed(4) + "   llm " + je[i].toFixed(4));
    console.log("      llm→ " + jTexts[i].slice(0, 80));
  }

  const mn = Math.min(...ge), mx = Math.max(...je);
  console.log(`\n  ───────────────────────────────────────────────────`);
  console.log(`  sahi min   ${mn.toFixed(4)}`);
  console.log(`  kachra max ${mx.toFixed(4)}`);
  console.log(`  GAP        ${mn - mx >= 0 ? "+" : ""}${(mn - mx).toFixed(4)}   ${mn > mx ? "✅" : "❌"}`);
  console.log(`  latency    ~${ms} ms / sawaal`);
  if (mn > mx) console.log(`  ➜ MIN_ABSOLUTE_SCORE = ${((mn + mx) / 2).toFixed(3)}`);
}
console.log();
