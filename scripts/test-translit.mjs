/**
 * SAARTHI — Transliteration ka faayda naapo (Phase B1b, 2026-08-03)
 * =====================================================================
 * Sawaal: rule-based Hinglish→Devanagari, LLM ke bina, us +0.1490 ke
 * faayde mein se kitna wapas laata hai?
 *
 * Har sawaal teen roop mein embed hota hai:
 *   raw     — jaisa user ne likha (Roman)
 *   translit— hamari translit.js se badla hua
 *   gold    — insaan ka likha sahi Devanagari (upper bound)
 *
 * Aur ULTA KHATRA bhi naapte hain: angrezi/tech sawaal (React, Bitcoin)
 * transliterate hone par kahin GALTI se score na badha lein — warna
 * threshold unhe andar aane dega. Yeh utna hi zaroori hai.
 *
 * CHALAO:  node scripts/test-translit.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toDevanagari, devanagariRatio } from "../src/knowledge/translit.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "public", "knowledge", "embeddings");
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
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${(env.CF_ACCOUNT_ID || "").trim()}/ai/run/${MODEL}`;
const API_TOKEN = (env.CF_API_TOKEN || "").trim();
if (!env.CF_ACCOUNT_ID || !API_TOKEN) { console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye"); process.exit(1); }

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
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts.slice(i, i + 25), truncate_inputs: true }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    out.push(...(j?.result?.data || j?.data));
  }
  return out;
}

function top1(qvRaw) {
  let norm = 0; for (const v of qvRaw) norm += v * v; norm = Math.sqrt(norm) || 1;
  const qv = new Float32Array(DIM);
  for (let d = 0; d < DIM; d++) qv[d] = qvRaw[d] / norm;
  let best = -2, book = "";
  for (let i = 0; i < n; i++) {
    const off = i * DIM;
    let dot = 0;
    for (let d = 0; d < DIM; d++) dot += qv8[off + d] * qv[d];
    const s = dot * scales[i] / 127;
    if (s > best) { best = s; book = idx.chunks[i].book; }
  }
  return { score: best, book };
}

// [roman, gold Devanagari]  — gold = upper bound
const HINGLISH = [
  ["gussa kaise shant karein",                   "गुस्सा कैसे शांत करें"],
  ["mrityu ke baad aatma ka kya hota hai",       "मृत्यु के बाद आत्मा का क्या होता है"],
  ["family mein ego kaise kam karein",           "परिवार में अहंकार कैसे कम करें"],
  ["Ek IAS aspirant baar-baar fail ho raha hai", "एक विद्यार्थी बार-बार परीक्षा में असफल हो रहा है"],
  ["karm yog kya hai",                            "कर्म योग क्या है"],
  ["lal kitab mein shani ka upay kya hai",        "लाल किताब में शनि का उपाय क्या है"],
  ["ekadashi vrat ka mahatva kya hai",            "एकादशी व्रत का महत्व क्या है"],
  ["mann ki shanti ke liye kya karein",           "मन की शांति के लिए क्या करें"],
];

// ULTA KHATRA — inka score badhna NAHI chahiye
const SHOULD_STAY_LOW = [
  "React useState hook kaise use karte hain",
  "Bitcoin ka price abhi kya hai",
  "IPL 2026 final kaun jeeta",
  "OCR me error ho to AI kya kare",
  "mera laptop baar baar band ho jata hai",
];

console.log(`corpus: ${n.toLocaleString()} vectors\n`);
console.log("═".repeat(92));
console.log("1. HINGLISH — kitna faayda wapas aaya?");
console.log("═".repeat(92));
console.log("\n  " + "sawaal".padEnd(40) + "raw      translit  gold      recovered");
console.log("  " + "-".repeat(88));

const rawT  = await embed(HINGLISH.map(p => p[0]));
const trT   = await embed(HINGLISH.map(p => toDevanagari(p[0])));
const goldT = await embed(HINGLISH.map(p => p[1]));

let totGain = 0, totPoss = 0;
for (let i = 0; i < HINGLISH.length; i++) {
  const r = top1(rawT[i]).score, t = top1(trT[i]).score, g = top1(goldT[i]).score;
  const poss = g - r, got = t - r;
  totGain += got; totPoss += poss;
  const pct = poss > 0.001 ? (got / poss * 100) : 100;
  console.log("  " + HINGLISH[i][0].slice(0, 38).padEnd(40)
    + r.toFixed(4) + "   " + t.toFixed(4) + "   " + g.toFixed(4) + "    "
    + (pct >= 0 ? " " : "") + pct.toFixed(0) + "%");
}
console.log("  " + "-".repeat(88));
console.log(`  KUL: possible +${totPoss.toFixed(4)}  |  mila +${totGain.toFixed(4)}  |  RECOVERED ${(totGain / totPoss * 100).toFixed(0)}%`);

console.log("\n" + "═".repeat(92));
console.log("2. ULTA KHATRA — angrezi/tech sawaal galti se upar to nahi chadhe?");
console.log("═".repeat(92));
console.log("\n  " + "sawaal".padEnd(46) + "raw      translit   farak");
console.log("  " + "-".repeat(88));
const lowRaw = await embed(SHOULD_STAY_LOW);
const lowTr  = await embed(SHOULD_STAY_LOW.map(toDevanagari));
let worst = -9;
for (let i = 0; i < SHOULD_STAY_LOW.length; i++) {
  const r = top1(lowRaw[i]).score, t = top1(lowTr[i]).score;
  if (t > worst) worst = t;
  console.log("  " + SHOULD_STAY_LOW[i].slice(0, 44).padEnd(46)
    + r.toFixed(4) + "   " + t.toFixed(4) + "   " + (t - r >= 0 ? "+" : "") + (t - r).toFixed(4));
}

// verdict
const minGood = Math.min(...HINGLISH.map((_, i) => top1(trT[i]).score));
console.log("\n" + "═".repeat(92));
console.log("NATEEJA");
console.log("═".repeat(92) + "\n");
console.log(`  translit ke BAAD:`);
console.log(`    sahi sawaalon ka sabse kam score : ${minGood.toFixed(4)}`);
console.log(`    kachre sawaalon ka sabse zyada   : ${worst.toFixed(4)}`);
console.log(`    gap                              : ${(minGood - worst >= 0 ? "+" : "")}${(minGood - worst).toFixed(4)}  ${minGood > worst ? "✅" : "❌"}`);
if (minGood > worst) {
  console.log(`\n  ➜ MIN_ABSOLUTE_SCORE = ${((minGood + worst) / 2).toFixed(3)}`);
}
console.log(`\n  namoona translit:`);
for (const [rom] of HINGLISH.slice(0, 4)) {
  console.log(`    ${rom.padEnd(44)} → ${toDevanagari(rom)}`);
}
console.log();
