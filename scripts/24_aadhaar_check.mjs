/**
 * SAARTHI — AADHAAR KI JAANCH: kya sahi granth hata to nahi raha?
 * =====================================================================
 * 2026-08-14.  Niyam #2 (SAURABH, 13 Aug):
 *     "Naam sirf usi granth ka jiska ansh SACH ME jawab me istemaal hua."
 *
 * KYUN YE SCRIPT ZAROORI HAI
 * --------------------------
 * Us niyam ka code (src/knowledge/aadhaar.js) likh diya gaya aur uske 12
 * unit-test bhi hare hain. Par un 12 test ke ansh MAINE KHUD banaye hain —
 * yaani wo sirf wahi pakadte hain jo maine SOCHA. Asli jawab kabhi nahi
 * dekha gaya.
 *
 * Aur yahan galti dono taraf ho sakti hai:
 *   KAM HATANA  — galat granth Aadhaar me reh jaye (jo pehle hota tha)
 *   ZYADA HATANA — SACHA granth hat jaye kyunki model ne apne shabdon me
 *                  likha. Ye zyada mehnga hai: hum apni sabse badi taakat
 *                  khud kaat denge.
 *
 * Doosri wali galti ANK ME KABHI NAHI DIKHTI. 19_eval_perbook retrieval
 * naapti hai, Aadhaar nahi. Isliye ye jaanch INSAAN KE PADHNE ke liye hai.
 *
 * KYA KARTI HAI: 25 asli sawaal poore raaste se chalati hai —
 *   /search  se ansh  →  /chat  se asli jawab  →  chuneGayeGranth()
 * — aur dikhati hai ki kaun bacha, kaun hata, aur KYUN.
 *
 * ⚠️ Wahi SYSTEM_PROMPT jo app istemaal karti hai (gemini.js se import).
 *    Alag prompt se jawab ka andaz badal jaata aur jaanch jhoothi hoti.
 *
 * CHALAO:
 *   node scripts/24_aadhaar_check.mjs
 *   node scripts/24_aadhaar_check.mjs --n 10
 *   node scripts/24_aadhaar_check.mjs --jawab     # poora jawab bhi dikhao
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = {};
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const API     = (env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
const ORIGIN  = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SESSION = (env.EVAL_SESSION || "").trim();
if (!API) { console.error("❌ .env me VITE_AI_PROXY_URL chahiye"); process.exit(1); }

const { chuneGayeGranth } = await import("../src/knowledge/aadhaar.js");
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { BOOK_META } = await import("../src/data/bookMeta.js");
const { normalizeQueryForSearch, expandQueryWithParyay, questionToTopic, stripMetaFraming } =
  await import("../src/knowledge/translit.js");

// gemini.js `import.meta.env` istemaal karta hai (Vite ka), jo Node me
// nahi hota. Sirf SYSTEM_PROMPT chahiye, isliye file se seedha nikaal
// rahe hain — poora module import karne par wo crash ho jaata.
const gsrc = readFileSync(join(ROOT, "src", "services", "gemini.js"), "utf8");
const SYSTEM_PROMPT = (() => {
  const a = gsrc.indexOf("export const SYSTEM_PROMPT = `") + "export const SYSTEM_PROMPT = `".length;
  const b = gsrc.indexOf("`;", a);
  return gsrc.slice(a, b)
    .replace(/\$\{GRANTH_COUNT\}/g, "24")
    .replace(/\$\{GRANTH_LIST\}/g, Object.values(BOOK_META).map(m => m.en || m.title).join(", "));
})();

const naam = id => (BOOK_META[id]?.en || BOOK_META[id]?.title || id);
const H = () => {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  return h;
};

/** ChatView.jsx jo karta hai, bilkul wahi */
function queryBanao(q) {
  const { query: searchQ } = normalizeQueryForSearch(q);
  const baseQ = stripMetaFraming(searchQ);
  return { findQ: expandQueryWithParyay(baseQ), rerankQ: questionToTopic(baseQ), hintedBook: detectHintedBook(q) };
}

async function khojo(q, koshish = 1) {
  const r = await fetch(API + "/search", { method: "POST", headers: H(), body: JSON.stringify(queryBanao(q)) });
  if (r.status === 429 && koshish <= 4) {
    await new Promise(s => setTimeout(s, 8000 * koshish));
    return khojo(q, koshish + 1);
  }
  if (!r.ok) throw new Error(`/search HTTP ${r.status}`);
  return (await r.json()).chunks || [];
}

/** ChatView jaisa hi dhaancha — gemini.js isi roop me padhta hai */
const dhaalo = ch => ({
  chunk: { book: ch.book, book_title: naam(ch.book), text: ch.text },
  rerank: ch.rerank ?? 0,
  grounded: ch.grounded === true,
});

async function jawabLo(sawaal, chunks, koshish = 1) {
  const blocks = chunks.map((r, i) =>
    `[${i + 1}] ${r.chunk.book_title}\n${(r.chunk.text || "").slice(0, 800)}`).join("\n\n");
  const userText =
    `${sawaal}\n\nRELEVANT PASSAGES RETRIEVED FROM SACRED BOOKS (${chunks.length} passages):\n\n${blocks}`;

  const r = await fetch(API + "/chat", {
    method: "POST", headers: H(),
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      temperature: 0.6, max_tokens: 900,
    }),
  });
  if ((r.status === 429 || r.status >= 500) && koshish <= 3) {
    await new Promise(s => setTimeout(s, 5000 * koshish));
    return jawabLo(sawaal, chunks, koshish + 1);
  }
  if (!r.ok) throw new Error(`/chat HTTP ${r.status} — ${(await r.text()).slice(0, 120)}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || j?.text || "";
}

// ── sawaal chuno — do kism, dono zaroori ─────────────────────────────
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const WANT = parseInt(arg("n", "25"), 10);

const EVAL = join(ROOT, "eval-perbook.json");
if (!existsSync(EVAL)) { console.error("❌ eval-perbook.json nahi mili"); process.exit(1); }
const all = JSON.parse(readFileSync(EVAL, "utf8"));

// Aadhe wo jinme KAI granth mile (yahin hatane ka faisla hota hai),
// aadhe bina-naam wale (asli user jaise).
const kaiGranth = all.filter(r => r.n > 0 && (r.got || []).length >= 3);
const binaNaam  = all.filter(r => r.n > 0 && !detectHintedBook(r.q));
const chuno = (arr, k) => {
  const step = Math.max(1, Math.floor(arr.length / k));
  return Array.from({ length: Math.min(k, arr.length) }, (_, i) => arr[i * step]).filter(Boolean);
};
const sawaal = [...chuno(kaiGranth, Math.ceil(WANT / 2)), ...chuno(binaNaam, Math.floor(WANT / 2))]
  .filter((r, i, a) => a.findIndex(x => x.q === r.q) === i);

console.log(`\n  ${sawaal.length} sawaal — poora raasta (/search → /chat → Aadhaar)\n`);
console.log(`  ⚠️  Har namoone par KHUD dekhiye:`);
console.log(`      "jo granth HATAYA gaya, kya wo sach me jawab me nahi tha?"\n`);
console.log(`  ${"═".repeat(72)}`);

const byora = [];
let kulRakhe = 0, kulHataye = 0, khatra = 0;

for (let i = 0; i < sawaal.length; i++) {
  const q = sawaal[i].q;
  let ch, jawab;
  try {
    ch = (await khojo(q)).map(dhaalo);
    if (!ch.length) { console.log(`\n  ${i + 1}. ${q.slice(0, 60)}\n     (koi ansh nahi mila — chhod raha hoon)`); continue; }
    jawab = await jawabLo(q, ch.slice(0, 12));
  } catch (e) {
    console.log(`\n  ${i + 1}. ${q.slice(0, 60)}\n     ❌ ${e.message}`);
    continue;
  }

  const grounded = ch.filter(c => c.grounded);
  const purana = [...new Set(grounded.map(c => c.chunk.book_title))].slice(0, 5);   // pehle jo hota
  const { granth, hataye } = chuneGayeGranth(jawab, grounded);
  kulRakhe += granth.length; kulHataye += hataye.length;

  console.log(`\n  ── ${i + 1}/${sawaal.length} ───────────────────────────────────────`);
  console.log(`  SAWAAL : ${q.slice(0, 66)}`);
  console.log(`  PEHLE  : ${purana.join(" · ") || "—"}`);
  console.log(`  AB     : ${granth.join(" · ") || "—"}`);
  if (hataye.length) console.log(`  HATAYE : ${hataye.join(" · ")}`);

  // ⚠️ KHATRE KI GHANTI — hataye gaye granth ka naam JAWAB ME hai.
  // Iska matlab model ne us granth ko sach me istemaal kiya, aur hum use
  // Aadhaar se hata rahe hain. Ye us galti se BURA hai jise theek karne
  // ke liye ye poora badlav kiya gaya tha.
  for (const h of hataye) {
    if (jawab.includes(h) || (BOOK_META[h]?.title && jawab.includes(BOOK_META[h].title))) {
      console.log(`  ⚠️  KHATRA: "${h}" jawab me likha hai, phir bhi Aadhaar se hata`);
      khatra++;
    }
  }
  if (process.argv.includes("--jawab")) {
    console.log(`\n  ── jawab ──\n${jawab.split("\n").map(l => "    " + l).join("\n")}`);
  }
  byora.push({ q, purana, granth, hataye, jawab });
  await new Promise(s => setTimeout(s, 400));
}

writeFileSync(join(ROOT, "aadhaar-check.json"), JSON.stringify(byora, null, 1), "utf8");

console.log(`\n  ${"═".repeat(72)}`);
console.log(`  ${byora.length} sawaal chale`);
console.log(`  Aadhaar me rakhe : ${kulRakhe}   (aausat ${(kulRakhe / Math.max(byora.length, 1)).toFixed(1)} prati jawab)`);
console.log(`  hataye           : ${kulHataye}   (aausat ${(kulHataye / Math.max(byora.length, 1)).toFixed(1)})`);
console.log(`  ⚠️ khatre ke mamle: ${khatra}   ← jawab me naam tha, phir bhi hata`);
console.log(`
  KAISE PADHEIN:

    khatra = 0 aur hataye > 0   →  niyam theek kaam kar raha hai
    khatra > 0                  →  SACHA granth kat raha hai. kamSeKam
                                   badhana (2 → 1) ya soch badalni hogi
    hataye = 0                  →  niyam kuch kar hi nahi raha — jaanchein
                                   ki wo sach me chal raha hai

  Sirf ank par mat jaiye — upar ke namoone PADHIYE. Ye jaanch insaan ke
  padhne ke liye hai, ginne ke liye nahi.

  poora byora: aadhaar-check.json
`);
