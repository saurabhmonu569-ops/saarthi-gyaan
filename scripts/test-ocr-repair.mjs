/**
 * SAARTHI — OCR sudhaar ka SAMPLE test (2026-08-04)
 * =====================================================================
 * SAWAAL: kya LLM se OCR ki galtiyan sach mein theek hoti hain?
 *
 * KYUN: "कृत्तिका नक्षत्र में जन्मे जातक" wala jawab kitab ke ULTA aaya.
 * Jaanch par mila ki content corpus mein HAI (rashi p.10) — par OCR ne
 * shirshak ko "Gitar नक्षत्र मैं जन्मे जातक" padh liya tha. Jo shabd
 * dhoondhne ke liye chahiye tha, wahi bigda hua tha.
 *
 * Naapne par 11 kitaabon mein 0.27% se 18.30% tak shabd aise bigde hue
 * nikle (Devanagari ke beech Latin ke tukde: "Gitar", "HY", "ofa", "Sl").
 *
 * YEH SCRIPT POORA CORPUS NAHI BADALTI. Sirf ~50 chunks par naapti hai
 * ki sudhaar hota bhi hai ya nahi — aur SABSE ZAROORI, ki LLM kahin
 * content BADAL toh nahi raha. Agar woh "sudhaarne" ke chakkar mein
 * vaakya badal de, toh corpus jhootha ho jayega — jo abhi ki halat se
 * bhi bura hai.
 *
 * CHALAO:  node scripts/test-ocr-repair.mjs
 * KHARCHA: ~50 chunks = na ke barabar
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "public", "knowledge", "books");

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

// ── bigde hue shabd ginno ────────────────────────────────────────────
const badTokens = (t) =>
  (t || "").split(/\s+/).filter(w => /^[A-Za-z][A-Za-z0-9]{0,12}$/.test(w));

const SYS =
  "You repair OCR errors in Hindi/Sanskrit scripture text. The text was scanned from a book " +
  "and some Devanagari words were misread as Latin letters or garbled.\n\n" +
  "RULES — follow exactly:\n" +
  "1. Fix ONLY the garbled words, using the surrounding context to work out the correct Devanagari word.\n" +
  "2. Do NOT rephrase, summarise, translate, shorten, expand or 'improve' anything.\n" +
  "3. Every correct word must stay EXACTLY as it is — same order, same punctuation.\n" +
  "4. If you cannot work out a garbled word, leave it exactly as it is. Never guess wildly.\n" +
  "5. Output ONLY the repaired text. No preamble, no explanation, no quotes.";

async function repair(model, text) {
  const r = await fetch(api(model), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "system", content: SYS }, { role: "user", content: text }],
      temperature: 0, max_tokens: 1600,
    }),
  });
  if (!r.ok) return { err: `HTTP ${r.status} ${(await r.text()).slice(0, 120)}` };
  const j = await r.json();
  let s = (j?.result?.response ?? "").toString().trim();
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
  return { text: s };
}

// ── sample chuno — sabse kharab kitaabon se ──────────────────────────
const TARGET = ["rashi_muhurt_vigyan", "nitya_karm_pooja", "guru_granth_sahib",
                "kathopanishad", "mantra_shakti", "lal_kitab"];
const sample = [];
for (const bid of TARGET) {
  const f = join(BOOKS, bid + ".json");
  if (!existsSync(f)) continue;
  const chunks = JSON.parse(readFileSync(f, "utf8")).chunks || [];
  const bad = chunks
    .filter(c => (c.text || "").length > 400 && badTokens(c.text).length >= 3)
    .sort((a, b) => badTokens(b.text).length - badTokens(a.text).length);
  for (const c of bad.slice(0, 8)) sample.push({ bid, page: c.page, text: c.text });
}
// woh chunk jise hum JAANTE hain — "Gitar" wala
const rm = JSON.parse(readFileSync(join(BOOKS, "rashi_muhurt_vigyan.json"), "utf8")).chunks;
const known = rm.find(c => c.page === 10);
if (known && !sample.some(s => s.text === known.text)) {
  sample.unshift({ bid: "rashi_muhurt_vigyan", page: 10, text: known.text, known: true });
}

const MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct"];
const use = process.argv[2] || MODELS[0];

console.log(`\n  model  : ${use}`);
console.log(`  sample : ${sample.length} chunks\n`);

let totBefore = 0, totAfter = 0, lenWarn = 0, done = 0, failed = 0;
const t0 = Date.now();

for (const s of sample.slice(0, 50)) {
  const before = badTokens(s.text).length;
  const r = await repair(use, s.text);
  if (r.err) { failed++; if (failed <= 2) console.log(`  ⚠️  ${s.bid} p.${s.page} — ${r.err}`); continue; }
  const after = badTokens(r.text).length;
  const lenDelta = Math.abs(r.text.length - s.text.length) / s.text.length;
  totBefore += before; totAfter += after; done++;
  if (lenDelta > 0.20) lenWarn++;

  if (s.known || done <= 3) {
    console.log(`  ── ${s.bid} p.${s.page} ${s.known ? "(JAANA-PEHCHANA case)" : ""} ──`);
    console.log(`     bigde shabd: ${before} → ${after}   | lambai badli: ${(lenDelta * 100).toFixed(0)}%`);
    console.log(`     PEHLE: ${s.text.replace(/\s+/g, " ").slice(0, 190)}`);
    console.log(`     BAAD : ${r.text.replace(/\s+/g, " ").slice(0, 190)}`);
    if (s.known) {
      console.log(`     "कृत्तिका" aaya? ${/कृत्तिका|कृतिका/.test(r.text) ? "✅ HAAN" : "❌ nahi"}`);
      console.log(`     "कटु वाणी" aaya? ${/कटु\s*वाणी/.test(r.text) ? "✅ HAAN" : "❌ nahi"}`);
    }
    console.log();
  }
}

console.log("  " + "=".repeat(58));
console.log(`  chunks jaanche     : ${done}${failed ? `  (${failed} fail)` : ""}`);
console.log(`  bigde shabd PEHLE  : ${totBefore}`);
console.log(`  bigde shabd BAAD   : ${totAfter}`);
if (totBefore) console.log(`  SUDHAAR            : ${((1 - totAfter / totBefore) * 100).toFixed(0)}%`);
console.log(`  lambai 20%+ badli  : ${lenWarn}/${done}  ${lenWarn > done * 0.1 ? "⚠️  KHATRA — model content badal raha hai" : "✅ theek"}`);
console.log(`  samay              : ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log("  " + "=".repeat(58));
console.log(`\n  Poore corpus ka anumaan: ~5,800 chunks x ${((Date.now() - t0) / 1000 / Math.max(done, 1)).toFixed(1)}s = ~${Math.round(5800 * ((Date.now() - t0) / 1000 / Math.max(done, 1)) / 60)} min\n`);
