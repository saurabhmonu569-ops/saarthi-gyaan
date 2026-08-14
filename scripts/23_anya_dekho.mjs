/**
 * SAARTHI — ANYA sach me galat hai, ya sirf doosri kitab?   (2026-08-14)
 * =====================================================================
 * YE JAANCH HAI, SUDHAAR NAHI. App me kuch nahi badalta.
 *
 * KYUN: 1,250 sawaalon ki naap me 106 "ANYA" hain — Aadhaar mila, par
 * us granth ka nahi jo sawaal me naam liya gaya tha. Ab tak hum inhe
 * GALTI gin rahe the.
 *
 * Par 22_routing_embed_test ne ek baat dikhayi jo ise sandigdh banati
 * hai: Puran aapas me alag kiye hi nahi ja sakte. "Bhavishya Puran me
 * daan ka mahatva" ka jawab Agni Puran se aata hai — kyunki DONO
 * lagbhag wahi baat kehte hain.
 *
 * Aisi soorat me wo jawab GALAT NAHI hai. Sirf doosri kitab hai, aur
 * Aadhaar bhi sacha hai. Asli user ke liye wo poori tarah theek jawab
 * hai — us user ne "Bhavishya Puran" likha hi nahi hota.
 *
 * ⚠️ Ye ank se tay nahi ho sakta. Ansh PADHNA padega.
 *
 * YE SCRIPT: kuch ANYA sawaal dobara /search par bhejti hai aur jo ansh
 * mila, uska POORA PAATH chhapti hai — taaki insaan padh kar tay kare:
 *
 *     "kya ye ansh is sawaal ka jawab DETA hai?"
 *        haan  →  galti nahi, sirf doosri kitab
 *        nahi  →  asli galti (jaise wo Agni Puran ka dhan-batware wala
 *                 panna jo "sampatti" shabd milne se aa gaya tha)
 *
 * CHALAO:
 *   node scripts/23_anya_dekho.mjs            # 15 namoone
 *   node scripts/23_anya_dekho.mjs --n 25
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVAL = join(ROOT, "eval-perbook.json");
if (!existsSync(EVAL)) { console.error("❌ eval-perbook.json nahi mili"); process.exit(1); }

const env = {};
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const API     = (env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
const ORIGIN  = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SESSION = (env.EVAL_SESSION || "").trim();
if (!API) { console.error("❌ .env me VITE_AI_PROXY_URL chahiye"); process.exit(1); }

const { normalizeQueryForSearch, expandQueryWithParyay, questionToTopic, stripMetaFraming } =
  await import("../src/knowledge/translit.js");
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { BOOK_META } = await import("../src/data/bookMeta.js");

const naam = id => (BOOK_META[id]?.en || BOOK_META[id]?.title || id);

/** ChatView jo karta hai, wahi */
function queryBanao(q) {
  const { query: searchQ } = normalizeQueryForSearch(q);
  const baseQ = stripMetaFraming(searchQ);
  return { findQ: expandQueryWithParyay(baseQ), rerankQ: questionToTopic(baseQ), hintedBook: detectHintedBook(q) };
}

async function poochho(q, koshish = 1) {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  const r = await fetch(API + "/search", { method: "POST", headers: h, body: JSON.stringify(queryBanao(q)) });
  if (r.status === 429 && koshish <= 4) {
    await new Promise(s => setTimeout(s, 8000 * koshish));
    return poochho(q, koshish + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).chunks || [];
}

// ── ANYA sawaal chuno — alag-alag granthon se, taaki tasveer poori bane ──
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const WANT = parseInt(arg("n", "15"), 10);

const anya = JSON.parse(readFileSync(EVAL, "utf8")).filter(r => r.nat === "anya");
const byBook = {};
for (const r of anya) (byBook[r.book] ??= []).push(r);
const chuna = [];
let round = 0;
while (chuna.length < WANT && round < 10) {
  for (const b of Object.keys(byBook)) {
    if (byBook[b][round] && chuna.length < WANT) chuna.push(byBook[b][round]);
  }
  round++;
}

console.log(`\n  ${anya.length} ANYA me se ${chuna.length} namoone — har ek ka paath neeche.\n`);
console.log(`  ⚠️  Har namoone par KHUD tay kijiye:`);
console.log(`      "kya ye ansh is sawaal ka jawab deta hai?"\n`);
console.log(`  ${"═".repeat(72)}`);

for (let i = 0; i < chuna.length; i++) {
  const r = chuna[i];
  let ch = [];
  try { ch = await poochho(r.q); } catch (e) { console.log(`  ❌ ${e.message}`); continue; }

  console.log(`\n  ── ${i + 1}/${chuna.length} ─────────────────────────────────────────`);
  console.log(`  SAWAAL   : ${r.q}`);
  console.log(`  CHAHIYE  : ${naam(r.book)}`);
  console.log(`  MILA     : ${[...new Set(ch.map(c => c.book))].map(naam).join(", ") || "(kuch nahi)"}`);

  // sabse upar wale do ansh ka paath — yahi faisla karne ke liye hai
  for (const c of ch.slice(0, 2)) {
    const kaisa = c.book === r.book ? "✓ sahi granth" : "✗ doosra granth";
    console.log(`\n    [${kaisa}]  ${naam(c.book)}`);
    console.log(`    ${(c.text || "").replace(/\s+/g, " ").slice(0, 420)}`);
  }
  console.log();
}

console.log(`  ${"═".repeat(72)}`);
console.log(`
  KAISE GINEIN — har namoone ko ek me daaliye:

    A. "jawab deta hai, bas doosri kitab se"   →  GALTI NAHI
    B. "jawab deta hi nahi, shabd hi mile hain" →  ASLI GALTI

  Agar zyadatar A nikle, to hamara asli ank 81% se ooncha hai, aur agla
  kaam granth chunna NAHI — Aadhaar ko imaandar banana hai.

  Agar zyadatar B nikle, to ANYA sach me galti hai aur granth-chunav ka
  teesra tareeka sochna hoga.
`);
