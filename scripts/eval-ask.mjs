/**
 * SAARTHI — Ask section ka scorecard (2026-08-06)
 * =====================================================================
 * KYUN: ab tak "kabhi-kabhi galat aata hai" ek EHSAAS tha, number nahi.
 * Bina number ke na ye pata chalta hai ki kitna kharab hai, na ye ki
 * koi badlaav sach mein sudhaar laaya ya sirf alag tarah se toota.
 *
 * YE KYA NAAPTA HAI — do cheezein, dono zaroori:
 *
 *   1. RECALL  — jab jawab kitaabon mein HAI, kya humne use dhoondha?
 *      (30 sawaal, har ek ke saath wo shabd jo sahi ansh mein hone hi
 *       chahiye — ye shabd corpus se pehle hi verify kiye gaye hain)
 *
 *   2. SURAKSHA — jab jawab kitaabon mein NAHI hai, kya humne chup rehne
 *      ka faisla kiya? (6 control sawaal — inka sahi natija "kuch nahi
 *      mila" hai. Yahan koi bhi citation JHOOTHI citation hai.)
 *
 * DAAYRA (saaf-saaf): ye sirf SEMANTIC + RERANK raasta naapta hai, jo
 * ChatView ke 85 candidates mein se 45 deta hai. Keyword aur cross-book
 * raaste browser ke inverted index par chalte hain aur yahan shaamil
 * nahi hain — yaani asli app ka recall isse THODA BEHTAR hoga, kharab
 * nahi. Ye number ek FARSH hai, chhat nahi.
 *
 * CHALAO:
 *   node scripts/eval-ask.mjs            # purana vs naya, dono
 *   node scripts/eval-ask.mjs --new      # sirf naya config
 *
 * .env mein CF_ACCOUNT_ID aur CF_API_TOKEN chahiye.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toDevanagari } from "../src/knowledge/translit.js";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB   = join(ROOT, "public", "knowledge", "embeddings");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const DIM = 1024, ROW = 1028;
const MIN_RERANK = 0.5;          // ChatView.jsx ka MIN_RERANK_SCORE
const MAX_FRAG   = 0.40;         // ChatView.jsx ka MAX_FRAGMENT_RATIO

// Purana vs naya funnel — yahi wo badlaav hai jise naapna hai
const CONFIGS = {
  purana: { sem: 12, rerank: 20 },
  naya:   { sem: 50, rerank: 100 },
};

// ── Sawaal ────────────────────────────────────────────────────────────
// `any`: sahi ansh mein in mein se KOI EK shabd hona chahiye. Ye shabd
// corpus mein pehle se maujood verify kiye gaye hain — yaani agar retrieval
// fail hota hai to wo retrieval ki galti hai, content ki kami nahi.
const QUESTIONS = [
  { q: "मृत्यु के बाद आत्मा का क्या होता है",        any: ["मृत्यु", "आत्मा", "परलोक", "यमलोक"] },
  { q: "gussa kaise shant karein",                    any: ["क्रोध", "कोप", "शांत"] },
  { q: "मुझे बहुत डर लगता है क्या करूँ",              any: ["भय", "डर", "निर्भय"] },
  { q: "पैसे की तंगी दूर करने का उपाय",               any: ["धन", "दरिद्र", "लक्ष्मी", "सम्पत्ति"] },
  { q: "पति पत्नी में झगड़ा हो तो क्या करें",          any: ["पति", "पत्नी", "गृहस्थ", "दाम्पत्य"] },
  { q: "संतान प्राप्ति के लिए क्या करें",              any: ["संतान", "पुत्र", "गर्भ"] },
  { q: "बीमारी में कौन सा मंत्र पढ़ें",                any: ["रोग", "औषधि", "आरोग्य", "व्याधि"] },
  { q: "नींद नहीं आती क्या करूँ",                     any: ["निद्रा", "नींद", "स्वप्न"] },
  { q: "शत्रु से कैसे बचें",                          any: ["शत्रु", "वैर", "बैर"] },
  { q: "क्षमा का महत्व क्या है",                      any: ["क्षमा"] },
  { q: "कर्म और भाग्य में क्या संबंध है",             any: ["कर्म", "भाग्य", "प्रारब्ध"] },
  { q: "गुरु का महत्व क्या है",                       any: ["गुरु", "शिष्य"] },
  { q: "ध्यान कैसे करें",                             any: ["ध्यान", "समाधि", "साधना"] },
  { q: "जप की सही विधि क्या है",                      any: ["जप", "माला", "अनुष्ठान"] },
  { q: "एकादशी व्रत का महत्व",                        any: ["एकादशी", "व्रत", "उपवास"] },
  { q: "पितरों का तर्पण कैसे करें",                   any: ["पितृ", "श्राद्ध", "तर्पण"] },
  { q: "कृत्तिका नक्षत्र के बारे में बताइए",           any: ["कृत्तिका", "नक्षत्र"] },
  { q: "सूर्य के बारह नाम कौन से हैं",                any: ["सूर्य", "आदित्य", "भास्कर"] },
  { q: "हनुमान जी की महिमा",                          any: ["हनुमान", "मारुति", "पवनसुत"] },
  { q: "मोक्ष कैसे मिलता है",                         any: ["मोक्ष", "मुक्ति", "निर्वाण"] },
  { q: "मन को कैसे वश में करें",                      any: ["मन", "चित्त", "इन्द्रिय"] },
  { q: "अहंकार कैसे छोड़ें",                          any: ["अहंकार", "गर्व", "मद"] },
  { q: "लोभ और मोह से कैसे बचें",                     any: ["लोभ", "मोह", "तृष्णा"] },
  { q: "दान का क्या फल मिलता है",                     any: ["दान", "अन्नदान"] },
  { q: "माता पिता की सेवा का महत्व",                  any: ["माता", "पिता", "सेवा"] },
  { q: "sacche mitra ki pehchan kya hai",             any: ["मित्र", "सखा", "मैत्री"] },
  { q: "भक्ति क्या है",                               any: ["भक्ति", "भक्त", "शरण"] },
  { q: "वैराग्य का अर्थ क्या है",                      any: ["वैराग्य", "विरक्ति"] },
  { q: "मेहनत का फल मिलता है या नहीं",                any: ["उद्यम", "पुरुषार्थ", "परिश्रम", "कर्म"] },
  { q: "शांति कैसे मिलेगी",                           any: ["शांति", "शान्ति"] },
];

// Control — inka jawab kisi bhi granth mein NAHI hai. Sahi natija = kuch
// bhi grounded na mile. Yahan ek bhi citation jhoothi citation hai.
const CONTROL = [
  "iPhone 15 ka price kya hai",
  "Python mein for loop kaise likhte hain",
  "आज बिटकॉइन का भाव क्या है",
  "मुंबई से दिल्ली की फ्लाइट कितने की है",
  "IPL 2026 kaun jeeta",
  "मेरा वाई-फाई राउटर काम नहीं कर रहा",
];

// ── setup ─────────────────────────────────────────────────────────────
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

console.log("corpus load ho raha…");
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
console.log(`  ${n.toLocaleString()} chunks, ${TEXT.size.toLocaleString()} texts\n`);

// ChatView.jsx ke gate — yahan bilkul wahi tark hona chahiye
const hasSentences = (t) => !!String(t || "").trim() &&
  /।|॥|(?:है|हैं|था|थी|थे|हुआ|हुई|होता|होती|करते|करना|चाहिये|चाहिए|गया|गयी|रहता|रहती)(?=[\s।॥,.]|$)/.test(t);
function looksGarbled(t) {
  const w = String(t || "").match(/[ऀ-ॿ]+/g);
  if (!w || w.length < 12) return false;
  return w.filter(x => x.length <= 2).length / w.length > MAX_FRAG;
}

async function embed(text) {
  const r = await fetch(api("@cf/baai/bge-m3"), {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [text], truncate_inputs: true }),
  });
  const j = await r.json();
  const raw = (j?.result?.data || j?.data)?.[0];
  if (!raw) throw new Error("embed fail: " + JSON.stringify(j).slice(0, 200));
  let nm = 0; for (const v of raw) nm += v * v; nm = Math.sqrt(nm) || 1;
  const out = new Float32Array(DIM); for (let d = 0; d < DIM; d++) out[d] = raw[d] / nm;
  return out;
}

/** 20-20 ke parallel batch — semanticSearch.js ke rerankPassages jaisa */
async function rerank(query, texts) {
  const batches = [];
  for (let i = 0; i < texts.length; i += 20) batches.push({ at: i, t: texts.slice(i, i + 20) });
  const res = await Promise.all(batches.map(async ({ at, t }) => {
    try {
      const r = await fetch(api("@cf/baai/bge-reranker-base"), {
        method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, contexts: t.map(text => ({ text: text.slice(0, 1200) })), top_k: t.length }),
      });
      const j = await r.json();
      const list = j?.result?.response || j?.response;
      if (!Array.isArray(list)) return { at, s: null };
      const s = new Array(t.length).fill(0);
      for (const it of list) {
        const i = it?.id ?? it?.index, v = it?.score ?? it?.relevance_score;
        if (Number.isInteger(i) && i >= 0 && i < s.length && typeof v === "number") s[i] = v;
      }
      return { at, s };
    } catch { return { at, s: null }; }
  }));
  const out = new Array(texts.length).fill(0);
  for (const { at, s } of res) if (s) for (let j = 0; j < s.length; j++) out[at + j] = s[j];
  return out;
}

/** Ek sawaal ka poora raasta — grounded passages lautata hai */
async function run(query, cfg) {
  const dev = toDevanagari(query);
  const qv = await embed(dev);
  const sc = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * DIM; let dot = 0;
    for (let d = 0; d < DIM; d++) dot += q8[off + d] * qv[d];
    sc[i] = dot * scales[i] / 127;
  }
  const top = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => sc[b] - sc[a]).slice(0, cfg.sem)
    .map(i => ({ id: idx.chunks[i].id, book: idx.chunks[i].book, text: TEXT.get(idx.chunks[i].id) || "" }))
    .filter(c => c.text)
    .slice(0, cfg.rerank);
  if (!top.length) return [];
  const scores = await rerank(dev, top.map(c => c.text));
  return top
    .map((c, i) => ({ ...c, rerank: scores[i] }))
    .filter(c => c.rerank >= MIN_RERANK && hasSentences(c.text) && !looksGarbled(c.text))
    .sort((a, b) => b.rerank - a.rerank);
}

// ── chalao ────────────────────────────────────────────────────────────
const only = process.argv.includes("--new") ? ["naya"] : Object.keys(CONFIGS);
const summary = {};

for (const name of only) {
  const cfg = CONFIGS[name];
  console.log(`\n${"=".repeat(72)}\n  CONFIG: ${name}  (semantic top-${cfg.sem} → rerank ${cfg.rerank})\n${"=".repeat(72)}`);
  let hit = 0, grounded = 0;
  console.log(`  ${"sawaal".padEnd(42)}${"aadhaar".padStart(8)}${"vishay".padStart(8)}   granth`);
  console.log("  " + "-".repeat(78));
  for (const { q, any } of QUESTIONS) {
    let g = [];
    try { g = await run(q, cfg); } catch (e) { console.log(`  ${q.slice(0, 40)}  ERROR ${e.message}`); continue; }
    const ok = g.length > 0;
    const rel = g.some(c => any.some(w => c.text.includes(w)));
    if (ok) grounded++;
    if (rel) hit++;
    console.log(`  ${q.slice(0, 40).padEnd(42)}${(ok ? "✅" : "❌").padStart(7)}${(rel ? "✅" : "❌").padStart(7)}   ${g[0]?.book || "—"}`);
  }
  let falseCite = 0;
  console.log("  " + "-".repeat(78));
  for (const q of CONTROL) {
    let g = [];
    try { g = await run(q, cfg); } catch { continue; }
    if (g.length) falseCite++;
    console.log(`  [control] ${q.slice(0, 32).padEnd(34)}${(g.length ? "⚠ JHOOTHI" : "✅ chup").padStart(12)}   ${g[0]?.book || ""}`);
  }
  summary[name] = { hit, grounded, falseCite };
  console.log("  " + "-".repeat(78));
  console.log(`  aadhaar mila : ${grounded}/${QUESTIONS.length}  (${(100 * grounded / QUESTIONS.length).toFixed(0)}%)`);
  console.log(`  sahi vishay  : ${hit}/${QUESTIONS.length}  (${(100 * hit / QUESTIONS.length).toFixed(0)}%)   ← ASLI SCORE`);
  console.log(`  jhoothi cite : ${falseCite}/${CONTROL.length}  (kam = behtar, 0 chahiye)`);
}

if (only.length > 1) {
  console.log(`\n${"=".repeat(72)}\n  TULNA\n${"=".repeat(72)}`);
  console.log(`  ${"".padEnd(16)}${"purana".padStart(10)}${"naya".padStart(10)}${"farak".padStart(10)}`);
  for (const [k, label] of [["hit", "sahi vishay"], ["grounded", "aadhaar mila"], ["falseCite", "jhoothi cite"]]) {
    const a = summary.purana[k], b = summary.naya[k];
    const d = b - a;
    console.log(`  ${label.padEnd(16)}${String(a).padStart(10)}${String(b).padStart(10)}${(d > 0 ? "+" : "") + d}`.padEnd(56));
  }
  console.log("\n  'sahi vishay' badhna chahiye, 'jhoothi cite' 0 rehni chahiye.");
  console.log("  Agar jhoothi cite badhi hai to funnel chaudi karne se shor bhi aaya —");
  console.log("  us soorat mein MIN_RERANK_SCORE 0.5 se badhana padega (pehle naapkar).");
}
