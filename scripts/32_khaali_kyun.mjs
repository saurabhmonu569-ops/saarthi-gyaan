/**
 * SAARTHI — 29 pakka-khaali sawaal KHAALI KYUN hain?        2026-08-18
 * =====================================================================
 * 31_khaali_jaanch.mjs ne ye tay kiya ki ye khaali PAKKA hai (har baar),
 * shor nahi. Ab wajah.
 *
 * ⚠️ TEEN BILKUL ALAG BIMARIYAN EK JAISI DIKHTI HAIN — "0 ansh mile":
 *
 *   A. QUERY HI CORPUS KI BHASHA ME NAHI BANI
 *      Sawaal me Roman/Angrezi shabd bache rahe ("Second house",
 *      "Chariot analogy", "Ushas hymns"), corpus poora Devanagari hai.
 *      Tab pool KHAALI aata hai. Ilaaj: lexicon/paryay.
 *
 *   B. QUERY THEEK BANI, PAR US GRANTH KA ANSH POOL ME AAYA HI NAHI
 *      pool bhara hai par usme wo granth hai hi nahi. Ilaaj: dhoondhna
 *      (embedding / FTS / quota / Mahabharata ka 45% hissa).
 *
 *   C. ANSH POOL ME AAYA, PAR GATE SE GIR GAYA
 *      poolByBook me granth dikhta hai par chunks 0. Ilaaj: reranker/
 *      threshold (#20/#21) — bilkul ULTA kaam.
 *
 * Inhe alag kiye bina "khaali" theek karne baithna andhere me teer hai.
 * 13 Agast ko COSINE_PAKKA=3 isi tarah lagaya gaya tha aur jhoothi
 * citations 0 se 21 ho gayi thi.
 *
 * NAAPA KYA JAATA HAI (har sawaal par, ek call):
 *   • findQ / rerankQ — jo WORKER ne banayi (stats.q se, andaaze se nahi)
 *   • findQ me Devanagari ka anupaat + bache hue Roman shabd
 *   • pool kitna bada, aur usme SAHI granth ke kitne ansh
 *   • best rerank score
 *
 * CHALAO (31 ke baad):
 *   node scripts/32_khaali_kyun.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(ROOT, "khaali-jaanch.json");
const OUT  = join(ROOT, "khaali-kyun.json");

if (!existsSync(SRC)) {
  console.error(`❌ ${SRC} nahi mili — pehle 31_khaali_jaanch.mjs chalayein.`);
  process.exit(1);
}

const env = {};
if (existsSync(join(ROOT, ".env"))) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const API = (env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
if (!API) { console.error("❌ .env me VITE_AI_PROXY_URL chahiye"); process.exit(1); }
const ORIGIN  = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SESSION = (env.EVAL_SESSION || "").trim();
const SEARCH  = API + "/search";

/**
 * Devanagari ka anupaat — SIRF akshar gine jaate hain.
 *
 * ⚠️ Space, ankh, aur viraam-chinh ginne par har query "aadhi Devanagari"
 * dikhne lagti hai aur naap bekaar ho jaati hai. `\p{L}` ke saath `\p{M}`
 * bhi zaroori hai — matra (ा ि ी ्) `\p{L}` me aati hi nahi, aur uske
 * bina Devanagari ki ginti chup-chaap kam aati hai. Ye jaal is project me
 * pehle bhi chaar jagah mila hai.
 */
function devAnupaat(s) {
  const akshar = (s.match(/[\p{L}\p{M}]/gu) || []);
  if (!akshar.length) return 1;
  const dev = akshar.filter(c => /[ऀ-ॿ]/.test(c)).length;
  return dev / akshar.length;
}

/** Jo shabd ab bhi Roman hain — yahi corpus se kabhi match nahi karenge. */
function romanShabd(s) {
  return (s.match(/[A-Za-z][A-Za-z'-]*/g) || []).filter(w => w.length > 2);
}

const rows = JSON.parse(readFileSync(SRC, "utf8"));
const kaam = rows.filter(r => r.dher === "pakka-khaali");

if (!kaam.length) { console.error("❌ koi pakka-khaali sawaal nahi mila."); process.exit(1); }

console.log(`\nKHAALI KYUN — ${kaam.length} pakka-khaali sawaal`);
console.log("─".repeat(78));

const so = (ms) => new Promise(s => setTimeout(s, ms));
const PACE_MS = SESSION ? 300 : 3200;

async function poochho(q, koshish = 1) {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  try {
    const r = await fetch(SEARCH, { method: "POST", headers: h, body: JSON.stringify({ q }) });
    if (r.status === 429) {
      if (koshish > 5) return { err: "raftaar-seema" };
      await so(8000 * koshish);
      return poochho(q, koshish + 1);
    }
    if (!r.ok) return { err: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) { return { err: e.message }; }
}

const out = [];

for (const { book, q } of kaam) {
  const j = await poochho(q);
  await so(PACE_MS);

  if (j.err) { console.log(`⚠️  ${book} — ${j.err}`); continue; }

  const s = j.stats || {};
  const findQ = s.q?.findQ ?? "";
  const anupaat = devAnupaat(findQ);
  const roman = romanShabd(findQ);
  const pool = s.pool ?? 0;
  const poolMeGranth = (s.poolByBook || {})[book] || 0;

  // ── BIMARI KA NAAM ──────────────────────────────────────────────
  // Kram maayne rakhta hai: pehle query, phir pool, phir gate. Ulta
  // dekhne par har cheez "gate ka masla" lagti hai.
  let bimari;
  if (anupaat < 0.6)          bimari = "A-query-roman";
  else if (pool === 0)        bimari = "A-pool-khaali";
  else if (!poolMeGranth)     bimari = "B-granth-pool-me-nahi";
  else                        bimari = "C-gate-se-gira";

  out.push({ book, q, findQ, rerankQ: s.q?.rerankQ ?? "", devAnupaat: +anupaat.toFixed(2),
             roman, pool, poolMeGranth, best: s.best ?? null, hinted: s.hinted ?? null, bimari });

  const chinh = { "A-query-roman": "🔤", "A-pool-khaali": "🕳 ", "B-granth-pool-me-nahi": "🔍", "C-gate-se-gira": "🚪" }[bimari];
  console.log(`${chinh} ${book} — ${q.slice(0, 52)}`);
  console.log(`    findQ: ${findQ.slice(0, 72)}`);
  console.log(`    Devanagari ${(anupaat*100).toFixed(0)}%`
    + (roman.length ? ` · Roman bache: ${roman.slice(0, 6).join(", ")}` : "")
    + ` · pool ${pool} (isme ${book}: ${poolMeGranth}) · best ${s.best ?? "—"}`);
}

// ── saar ──────────────────────────────────────────────────────────────
const g = (b) => out.filter(r => r.bimari === b).length;
console.log("\n" + "─".repeat(78));
console.log(`🔤 A  query me Roman bacha (Devanagari < 60%)     : ${g("A-query-roman")}`);
console.log(`🕳  A  query theek par pool BILKUL khaali          : ${g("A-pool-khaali")}`);
console.log(`🔍 B  pool bhara, par us granth ka ansh hi nahi   : ${g("B-granth-pool-me-nahi")}`);
console.log(`🚪 C  ansh pool me tha, gate se gir gaya          : ${g("C-gate-se-gira")}`);
console.log("─".repeat(78));

// Sabse zyada bar-bar aane wale Roman shabd — lexicon me kya jodna hai,
// ye ANDAAZE se nahi, ginti se tay hoga.
const shabdGinti = {};
for (const r of out) for (const w of r.roman) {
  const k = w.toLowerCase();
  shabdGinti[k] = (shabdGinti[k] || 0) + 1;
}
const top = Object.entries(shabdGinti).sort((a, b) => b[1] - a[1]).slice(0, 30);
if (top.length) {
  console.log(`\nRoman shabd jo sabse zyada bache (lexicon me ye jodne hain):`);
  console.log(top.map(([w, n]) => `${w}(${n})`).join("  "));
}

writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\npoora byora: ${OUT}`);
