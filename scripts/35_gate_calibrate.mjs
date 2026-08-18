/**
 * SAARTHI — rerank ka gate NAAP KAR chuno, andaaze se nahi   2026-08-18
 * =====================================================================
 * ABHI GATE 0.30 HAI. Wo kahan se aaya: 3 Agast, 13 sawaalon par lagta
 * tha ki score do-tarfa hai — sahi 0.90+, kachra 0.01 se neeche.
 *
 * AAJ KI NAAP US TASVEER SE MEL NAHI KHATI (34_rerank_devanagari.mjs,
 * 40 ansh, ek sawaal):
 *     reranker ka AUC 0.993          — wo sahi/galat me farak KARTA hai
 *     sahi-vishay ansh: sabse ooncha 0.7249, BEECH KA 0.0015
 *     asambandhit ansh: sabse ooncha 0.0003
 *     0.30 paar kiya: 20 me se 1 ne
 *
 * Yaani gate signal ka lagbhag poora hissa phenk raha hai — par phenk
 * "sahi" taraf raha hai, kyunki kachra 0.0003 se upar jaata hi nahi.
 *
 * ⚠️ PAR EK SAWAAL PAR GATE NAHI BADLA JAATA. Aur gate ka DOOSRA kaam
 * CHUP RAHNA hai — "kal ka mausam", "petrol ka rate", "Bible" jaise 38
 * control sawaalon par koi granth cite NAHI hona chahiye. 13 Agast ko
 * COSINE_PAKKA=3 lagane par jhoothi citations 0 se 21/38 ho gayi thi.
 * Wo galti dobara nahi honi chahiye.
 *
 * ISLIYE YE SCRIPT DONO TARAF EK SAATH TOLTI HAI:
 *   • bina-hint sawaal (jinme sahi granth pata hai) — kitne par SAHI
 *     granth ka koi ansh gate paar karta hai
 *   • 38 control sawaal — kitne par KOI BHI ansh gate paar karta hai
 *     (yahi jhoothi citation ka khatra hai; 0 rehna chahiye)
 *
 * EK BAAR NETWORK, PHIR SAB THRESHOLD OFFLINE. /search se poore pool ke
 * ank ek baar utaar liye jaate hain (`debug: true`), phir 20+ threshold
 * unhi ankon par tole jaate hain. Isse baar-baar deploy karke aazmaane
 * ki zarurat nahi padti — aur wahi galti aaj do baar ho chuki hai.
 *
 * ⚠️ HINT WALE SAWAAL JAAN-BOOJHKAR BAHAR HAIN. Un par alag niyam chalta
 * hai (HINTED_PAKKA=2, floor 0.18) aur wo pehle se 98.9% par hai. Rog
 * bina-hint waale raaste me hai (43%).
 *
 * CHALAO:
 *   node scripts/35_gate_calibrate.mjs           # ~20 min, checkpoint ke saath
 *   node scripts/35_gate_calibrate.mjs --naya-shuru
 *   node scripts/35_gate_calibrate.mjs --sirf-hisaab   # bina network, purane ank par
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = join(ROOT, "gate-calibrate.json");

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

if (!SESSION) console.warn("⚠️  EVAL_SESSION nahi hai — 429 mil sakta hai, naap bharosemand nahi hogi.\n");

const sirfHisaab = process.argv.includes("--sirf-hisaab");
const nayaShuru  = process.argv.includes("--naya-shuru");

// ── sawaal ────────────────────────────────────────────────────────────
const kaam = [];
{
  // bina-hint, granth ke naam ke saath — eval-perbook.json se
  const pb = join(ROOT, "eval-perbook.json");
  if (!existsSync(pb)) { console.error("❌ eval-perbook.json nahi mili."); process.exit(1); }
  for (const r of JSON.parse(readFileSync(pb, "utf8"))) {
    if (!r.hinted) kaam.push({ tarah: "corpus", book: r.book, q: r.q });
  }
  // control — inka jawab corpus me hai hi nahi
  const eq = JSON.parse(readFileSync(join(ROOT, "scripts", "eval-questions.json"), "utf8"));
  for (const q of (eq.control || [])) kaam.push({ tarah: "control", book: null, q: typeof q === "string" ? q : q.q });
}

const so = (ms) => new Promise(s => setTimeout(s, ms));
const PACE_MS = SESSION ? 250 : 3200;

async function poochho(q, koshish = 1) {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  try {
    const r = await fetch(SEARCH, { method: "POST", headers: h, body: JSON.stringify({ q, debug: true }) });
    if (r.status === 429) {
      if (koshish > 5) return { err: "raftaar-seema" };
      await so(8000 * koshish); return poochho(q, koshish + 1);
    }
    if (!r.ok) return { err: `HTTP ${r.status}` };
    const j = await r.json();
    return {
      pool: j?.stats?.poolScores || null,
      poolN: j?.stats?.pool ?? null,
      hinted: j?.stats?.hinted ?? null,
      skipped: j?.stats?.skipped ?? 0,
    };
  } catch (e) { return { err: e.message }; }
}

// ── ank utaaro (checkpoint ke saath) ──────────────────────────────────
let ank = [];
if (!nayaShuru && existsSync(OUT)) { try { ank = JSON.parse(readFileSync(OUT, "utf8")); } catch {} }
const hoChuke = new Set(ank.map(r => r.q));

if (!sirfHisaab) {
  const bacha = kaam.filter(k => !hoChuke.has(k.q));
  console.log(`\nANK UTAARNE HAIN: ${bacha.length} sawaal (kul ${kaam.length}, ho chuke ${hoChuke.size})`);
  let i = 0;
  for (const k of bacha) {
    const j = await poochho(k.q);
    i++;
    if (j.err) { console.log(`⚠️  [${i}/${bacha.length}] ${j.err} — ${k.q.slice(0, 44)}`); await so(PACE_MS); continue; }

    // ⚠️ POOL KHAALI HONA ASLI NATEEJA HAI, GALTI NAHI.
    // Jab cand/withText khaali ho to /search jaldi laut jaata hai aur
    // poolScores bhejta hi nahi. Ye khaas kar CONTROL sawaalon par hota
    // hai — aur wahi to unka SAHI bartaav hai. Ise "worker deploy nahi
    // hua" maankar ruk jaana galat tha: pehli hi baar script ruk gayi.
    if (!j.pool && j.poolN === 0) { ank.push({ ...k, pool: [], skipped: 0 }); await so(PACE_MS); continue; }

    // ⚠️ Ab bhi poolScores nahi? Ek baar aur poochho — deploy ka rollout
    // dheere-dheere failta hai. Aaj hi 30_query_prep_jaanch me pehli DO
    // call purane version par gayi thi aur wo "bug" jaisi dikhi thi.
    if (!j.pool) {
      await so(4000);
      const j2 = await poochho(k.q);
      if (!j2.pool && j2.poolN !== 0) {
        console.error(`\n❌ poolScores dobara bhi nahi aaye. Worker deploy hua?`);
        console.error(`   (npm run worker:deploy — aur 10 second ruk kar dobara chalayein)`);
        process.exit(1);
      }
      ank.push({ ...k, pool: j2.pool || [], skipped: j2.skipped });
      await so(PACE_MS); continue;
    }
    // ⚠️ hint lag gaya to ise chhod do — is naap ka wo hissa hai hi nahi
    if (k.tarah === "corpus" && j.hinted) { await so(PACE_MS); continue; }
    ank.push({ ...k, pool: j.pool, skipped: j.skipped });
    if (i % 20 === 0) { writeFileSync(OUT, JSON.stringify(ank)); console.log(`   … ${i}/${bacha.length}`); }
    await so(PACE_MS);
  }
  writeFileSync(OUT, JSON.stringify(ank));
  console.log(`ank utar gaye: ${ank.length} sawaal → ${OUT}`);
}

if (!ank.length) { console.error("❌ koi ank nahi."); process.exit(1); }

// ── ab SAB threshold offline ──────────────────────────────────────────
const corpus  = ank.filter(r => r.tarah === "corpus");
const control = ank.filter(r => r.tarah === "control");

// ⚠️ SIRF `usable` ansh gine jaate hain. hasSentences/looksGarbled ka
// chhanna gate se PEHLE lagta hai; use na ginne par threshold un ansho par
// bhi tola jata jo kisi bhi ank par bahar hi rehte — yaani naap jhooth
// bolti.
const use = (p) => p.filter(c => c.usable);

const SEEMA = [0.30, 0.20, 0.18, 0.10, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001,
               0.0005, 0.0002, 0.0001, 0.00005, 0.00001];

console.log(`\nbina-hint corpus sawaal: ${corpus.length}   ·   control sawaal: ${control.length}`);
console.log("═".repeat(78));
console.log(`${"gate".padEnd(10)} ${"SAHI granth mila".padEnd(18)} ${"kuch bhi mila".padEnd(15)} ${"CONTROL par bola"}`);
console.log("─".repeat(78));

const rows = [];
for (const T of SEEMA) {
  const sahi = corpus.filter(r => use(r.pool).some(c => c.book === r.book && c.rerank >= T)).length;
  const kuch = corpus.filter(r => use(r.pool).some(c => c.rerank >= T)).length;
  const bola = control.filter(r => use(r.pool).some(c => c.rerank >= T)).length;
  rows.push({ T, sahi, kuch, bola });
  const chinh = bola === 0 ? "  " : bola <= 1 ? "⚠️" : "🔴";
  console.log(
    `${String(T).padEnd(10)} ${`${sahi}/${corpus.length} (${(100*sahi/corpus.length).toFixed(0)}%)`.padEnd(18)}`
    + ` ${`${kuch}/${corpus.length} (${(100*kuch/corpus.length).toFixed(0)}%)`.padEnd(15)}`
    + ` ${chinh} ${bola}/${control.length}`
  );
}

console.log("═".repeat(78));

// ⚠️ CHUNNE KA NIYAM: pehle CHUP RAHNA, phir dhoondhna. Ulta karne par
// wahi hoga jo 13 Agast ko hua — jhoothi citation 0 se 21 ho gayi thi.
const surakshit = rows.filter(r => r.bola === 0).sort((a, b) => b.sahi - a.sahi)[0];
const abhi = rows.find(r => r.T === 0.30);

if (surakshit) {
  console.log(`\nAbhi (0.30)      : SAHI ${abhi.sahi}/${corpus.length}, control par bola ${abhi.bola}`);
  console.log(`Sabse achha gate : ${surakshit.T} → SAHI ${surakshit.sahi}/${corpus.length}, control par bola 0`);
  if (surakshit.sahi > abhi.sahi) {
    console.log(`\n✅ ${surakshit.T} par ${surakshit.sahi - abhi.sahi} aur sawaalon ko SAHI granth milta hai`);
    console.log(`   aur control par ab bhi ek bhi jhoothi citation nahi.`);
    console.log(`\n⚠️ Badalne se PEHLE: 14_eval_search.mjs --set control chalayein —`);
    console.log(`   ye naap poore jawab ki nahi, sirf retrieval ki hai. Citation`);
    console.log(`   Rule #2 aur [[GRANTH]] ke baad banti hai, aur wo yahan nahi dikhta.`);
  } else {
    console.log(`\n0.30 se behtar koi surakshit gate nahi mila. Gate badalna ilaaj nahi hai.`);
  }
} else {
  console.log(`\n⚠️ Har seema par control sawaal par kuch na kuch bol raha hai.`);
  console.log(`   Yaani chup rehna sirf gate se nahi ho raha — kahin aur dekhna hoga.`);
}
