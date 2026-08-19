/**
 * SAARTHI — SAHI GRANTH POOL ME AATA HAI YA NAHI?          2026-08-19
 * =====================================================================
 * #20 / ANYA ka nidaan: "jawab aata hai par GALAT granth ka naam lagta
 * hai." 19 Agast ko naapa gaya (44 bina-hint sawaal):
 *
 *     granth              sahi  anya  khaali
 *     lal_kitab              1     7      2
 *     kathopanishad          1     3      0
 *
 * Lal Kitab ke 10 sawaalon me se sirf EK par Lal Kitab ka ansh aata hai.
 * Baaki rashi_muhurt_vigyan / mahabharata / agni_purana se jawab banta
 * hai — jabki query ab bilkul theek hai ("द्वितीय भाव", "दशम भाव").
 *
 * ⚠️ DO BILKUL ALAG BIMARIYAN, EK JAISI DIKHTI HAIN:
 *
 *   B1. Sahi granth POOL ME AAYA HI NAHI  → dhoondhne ka masla.
 *       Shak: corpus bahut asantulit hai —
 *           mahabharata   ~25,856 ansh  (~45%)
 *           yoga_vasishtha  6,446
 *           lal_kitab         211  (0.37%)
 *           kathopanishad     186
 *       Vectorize poore corpus me se sabse paas ke ansh laata hai.
 *       0.37% wala granth us daud me shaayad hi kabhi dikhe.
 *
 *   B2. Pool me AAYA par NEECHE rank kiya  → aankne ka masla (reranker).
 *
 * Inka ilaaj ULTA hai. B1 par reranker chhedna bekaar hai; B2 par pool
 * badhana bekaar hai. Isliye pehle ye script, phir ilaaj.
 *
 * Paath ki gunvatta pehle hi jaanch li gayi (lal_kitab 97% usable) —
 * yaani ansh `hasSentences`/`looksGarbled` ke chhanne me nahi mar rahe.
 *
 * /chat par koi call nahi — AI ka kota kharch nahi hota.
 *
 * CHALAO:
 *   node scripts/39_granth_khoj.mjs --granth lal_kitab
 *   node scripts/39_granth_khoj.mjs --granth kathopanishad
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, khojo, so } from "./lib/pipeline.mjs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const GRANTH = arg("granth", "lal_kitab");

const SRC = join(ROOT, "eval-perbook.json");
if (!existsSync(SRC)) { console.error("❌ eval-perbook.json nahi mili."); process.exit(1); }

// bina-hint sawaal — wahi jinpar rog hai
const sawaal = JSON.parse(readFileSync(SRC, "utf8"))
  .filter(r => r.book === GRANTH && !r.hinted)
  .map(r => r.q);

if (!sawaal.length) { console.error(`❌ ${GRANTH} ke bina-hint sawaal nahi mile.`); process.exit(1); }

console.log(`\n${GRANTH} — ${sawaal.length} bina-hint sawaal`);
console.log("═".repeat(78));

let poolMeNahi = 0, poolMeHaiParNeeche = 0, upar = 0;
const byora = [];

for (const q of sawaal) {
  let j;
  try { j = await khojo(q, { debug: true }); }
  catch (e) { console.log(`  ⚠️  ${e.message} — ${q.slice(0, 40)}`); continue; }

  const pool = (j.stats?.poolScores || []).filter(c => c.usable);
  const mere = pool.filter(c => c.book === GRANTH);
  const sab  = [...pool].sort((a, b) => b.rerank - a.rerank);

  const meraBest = mere.length ? Math.max(...mere.map(c => c.rerank)) : null;
  const jeeta = sab[0];

  // Sahi granth ka sabse achha ansh POORE pool me kis sthaan par hai?
  const sthaan = meraBest == null ? null : sab.findIndex(c => c.rerank === meraBest) + 1;

  let dher;
  if (!mere.length)                    { dher = "B1"; poolMeNahi++; }
  else if (jeeta.book === GRANTH)      { dher = "OK"; upar++; }
  else                                 { dher = "B2"; poolMeHaiParNeeche++; }

  const chinh = { B1: "🔍", B2: "🚪", OK: "✅" }[dher];
  console.log(`${chinh} ${q.slice(0, 58)}`);
  console.log(`   pool ${pool.length} · isme ${GRANTH}: ${mere.length}`
    + (meraBest != null ? ` · uska best ${meraBest.toFixed(4)} (sthaan #${sthaan})` : "")
    + ` · jeeta: ${jeeta ? `${jeeta.book} ${jeeta.rerank.toFixed(4)}` : "koi nahi"}`);

  byora.push({ q, mere: mere.length, meraBest, sthaan, jeeta: jeeta?.book, jeetaAnk: jeeta?.rerank });
  await so(400);
}

console.log("\n" + "═".repeat(78));
console.log(`  🔍 B1  pool me ek bhi ansh nahi   : ${poolMeNahi}/${byora.length}`);
console.log(`  🚪 B2  pool me hai par neeche     : ${poolMeHaiParNeeche}/${byora.length}`);
console.log(`  ✅ OK  sabse upar                 : ${upar}/${byora.length}`);

// ⚠️ Ye faisla hi is script ka matlab hai — ilaaj dono ka ULTA hai.
console.log("");
if (poolMeNahi > poolMeHaiParNeeche) {
  console.log(`  🔴 SROT: DHOONDHNA (B1). Sahi granth pool me aata hi nahi.`);
  console.log(`     Reranker bekasoor hai — wo jo cheez saamne hi nahi, use`);
  console.log(`     upar nahi la sakta. Ilaaj pool banane me hai: chhote`);
  console.log(`     granthon ke liye jagah pakki karo, ya topK badhao.`);
} else if (poolMeHaiParNeeche > 0) {
  console.log(`  🔴 SROT: AANKNA (B2). Ansh pool me hain par neeche rank karte.`);
  console.log(`     Ilaaj reranker/kram me hai, pool me nahi.`);
} else {
  console.log(`  🟢 Is granth par koi rog nahi dikha.`);
}

const jeetneWale = {};
for (const r of byora) if (r.jeeta && r.jeeta !== GRANTH) jeetneWale[r.jeeta] = (jeetneWale[r.jeeta] || 0) + 1;
const top = Object.entries(jeetneWale).sort((a, b) => b[1] - a[1]);
if (top.length) {
  console.log(`\n  Kaun jeet raha hai iski jagah:`);
  for (const [b, n] of top) console.log(`     ${b.padEnd(24)} ${n} baar`);
}
