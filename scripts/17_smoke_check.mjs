/**
 * SAARTHI — jhatpat jaanch (smoke check)   2026-08-11
 * =====================================================================
 * KYUN: poori naap (728+ sawaal) ~40 minute leti hai. Usse pehle 60
 * second me itna to pata chal jaana chahiye ki pipeline zinda hai —
 * naya granth jud gaya, purane tootey nahi, aur bahar ka sawaal abhi
 * bhi khaali lautta hai.
 *
 * Ye naap NAHI hai. Ye sirf "kahin kuch poori tarah toota to nahi"
 * wali jaanch hai. Ank yahan se mat lijiye — wo 14_eval_search.mjs se
 * aate hain.
 *
 * KASAUTI: sirf "Aadhaar mila" kaafi nahi. Dekha jaata hai ki jo granth
 * chahiye tha, wahi mila ya nahi. Gita ka sawaal Ramcharitmanas se
 * jawab paaye to wo FAIL hai — chahe jawab sunne me achha lage.
 *
 * CHALAO:
 *   node scripts/17_smoke_check.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// .env padho — wahi tareeka jo 14_eval_search.mjs me hai
const env = {};
if (existsSync(join(ROOT, ".env"))) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const API = (env.VITE_AI_PROXY_URL || process.env.AI_PROXY_URL || "").trim().replace(/\/+$/, "");

if (!API) {
  console.error("❌ .env me VITE_AI_PROXY_URL chahiye (Worker ka pata).");
  process.exit(1);
}

/**
 * ORIGIN BHEJNA ZAROORI HAI.
 *
 * Worker ALLOWED_ORIGINS se poori tarah mel dekhta hai (`origin === a`),
 * isliye ek akshar ka fark bhi 403 deta hai. Pehli baar maine yahan
 * "saarthigyaan.netlify.app" likh diya tha — asli naam me hyphen hai,
 * aur saare 10 sawaal 403 me gir gaye.
 *
 * Isliye ab wahi default jo 14_eval_search.mjs me hai, aur wahi .env
 * chaabi (EVAL_ORIGIN) — do jagah do alag pate rakhne ka koi matlab nahi.
 */
const ORIGIN = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SEARCH = API + "/search";

/**
 * ⚠️ SESSION HEADER DONO CALL PAR — 18 Agast 2026 ko yahi chhoot gaya tha.
 *
 * Us din `/chat` wali jaanch jodte waqt maine `H()` ki jagah plain object
 * likh diya, aur usme `X-Saarthi-Session` reh hi nahi gaya. Nateeja: call
 * anonymous jaati thi, din-bhar ke kote par 429 khaati thi, aur script
 * "Ask section user ke liye BAND hai" chhaap deti thi — jo JHOOTH tha.
 *
 * Ye khatarnak isliye hai ki asli outage aur script ki apni galti bilkul
 * ek jaise dikhte hain. Aur aaj subah asli outage hua bhi tha.
 */
const sirHeader = () => {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  const t = (env.EVAL_SESSION || "").trim();
  if (t) h["X-Saarthi-Session"] = t;
  return h;
};

const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { normalizeQueryForSearch, expandQueryWithParyay, questionToTopic, stripMetaFraming } =
  await import("../src/knowledge/translit.js");

/**
 * ChatView.jsx jo karta hai, BILKUL WAHI — na kam, na zyada.
 *
 * ⚠️ Pehli baar maine yahan `normalizeQueryForSearch` chhod diya tha, aur
 * seedha stripMetaFraming se shuru kar diya. Nateeja: Roman me likha sawaal
 * Roman hi chala gaya — "Hanuman ji ko Jambavan ne kya yaad dilaya". Corpus
 * poora Devanagari me hai, isliye FTS ko Ramcharitmanas me kuch mila hi
 * nahi, pool sirf vector-search se bhara, aur sawaal fail dikha.
 *
 * App bilkul theek thi. Galti naapne wale auzaar mein thi — aur wo sabse
 * mehngi kism ki galti hai, kyunki wo aapko sahi cheez todne bhejti hai.
 *
 * Isiliye ye chaar kadam ek hi jagah hain: kal ChatView badle to yahan bhi
 * badalna hai, aur ye tippani wo yaad dilayegi.
 */
function queryBanao(q) {
  const { query: searchQ } = normalizeQueryForSearch(q);   // Roman → Devanagari
  const baseQ = stripMetaFraming(searchQ);
  return {
    findQ:      expandQueryWithParyay(baseQ),   // FTS + Vectorize ke liye
    rerankQ:    questionToTopic(baseQ),         // prashn → vishay-vaakya
    hintedBook: detectHintedBook(q),            // ⚠️ MOOL sawaal par, searchQ par nahi
  };
}

/**
 * Har pankti: [sawaal, kaun sa granth aana chahiye]
 *   null  = koi Aadhaar NAHI aana chahiye (bahar ka sawaal)
 *
 * Chuna is tarah gaya hai ki teen alag khatre dikhein:
 *   1-3   naya granth (Yogasutra) — sach me juda ya sirf ginti me?
 *   4     wo granth jise abhi dobara bhara (nitya_karm_pooja)
 *   5-8   purane granth — kahin ye kaam tod to nahi gaya
 *   9-10  bahar ke sawaal — jhoothi citation abhi bhi 0 hai?
 */
const JAANCH = [
  ["Yoga Sutras me Kleshas kya hain",                              "yoga_sutra"],
  ["Patanjali ke according chittavritti nirodh ka arth kya hai",   "yoga_sutra"],
  ["Ashtanga yoga ke aath ang kaunse hain",                        "yoga_sutra"],
  ["Nitya karm pooja me vihit aur nishiddh patra pushp kaunse hain","nitya_karm_pooja"],
  ["Gita me karmayog ka saar kya hai",                     "bhagavad_gita_shankar"],
  ["Hanuman ji ko Jambavan ne kya yaad dilaya",                 "ramcharitmanas"],
  ["Mahabharat me Yaksha Prashna kya tha",                         "mahabharata"],
  ["Ekadashi vrat ka mahatva kya hai",                       "ekadashi_mahatmya"],
  ["Dhammapada me krodh ko jeetne ka upay kya hai",                        null],
  ["SAARTHI GYAAN app kis technology par bana hai",                        null],
];

console.log(`\n  ${SEARCH}\n`);

let pass = 0, fail = 0;
const der = [];

for (const [q, chahiye] of JAANCH) {
  const body = queryBanao(q);
  const t0 = Date.now();
  let ch = [], stats = null, err = null;
  try {
    const r = await fetch(SEARCH, {
      method: "POST",
      headers: sirHeader(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 120)}`);
    const j = await r.json();
    ch = j.chunks || []; stats = j.stats || null;
  } catch (e) { err = e.message; }
  const ms = Date.now() - t0;
  der.push(ms);

  const books = [...new Set(ch.map(c => c.book))];
  // chahiye===null  → koi Aadhaar nahi aana chahiye
  // chahiye===naam  → us granth ka ansh aana chahiye
  const theek = err ? false : (chahiye === null ? ch.length === 0 : books.includes(chahiye));
  theek ? pass++ : fail++;

  console.log(`${theek ? "✅" : "❌"} ${q.slice(0, 50).padEnd(52)} ${String(ms).padStart(5)}ms  `
    + (err ? `ERROR: ${err}` : `${String(ch.length).padStart(2)} ansh  ${books.join(", ") || "(khaali)"}`));

  if (!theek && !err) {
    console.log(`      chahiye tha: ${chahiye === null ? "KOI AADHAAR NAHI" : chahiye}`);
    // FAIL par worker ki apni ginti dikhao — warna andaaza lagana padta hai.
    // Yahi ginti batati hai ki granth pool tak pahuncha hi nahi, ya pahunch
    // kar gate se gira, ya rerank timeout me chhoot gaya. Teenon ka ilaaj
    // alag hai, isliye inhe alag-alag dekhna zaroori hai.
    if (stats) {
      const k = ["hinted", "poolSize", "hintedInPool", "hintedPassed", "hintedPakka", "skipped", "kept"];
      console.log("      worker: " + k.filter(x => stats[x] !== undefined)
        .map(x => `${x}=${JSON.stringify(stats[x])}`).join("  "));
      if (stats.poolByBook) {
        const top = Object.entries(stats.poolByBook).sort((a, b) => b[1] - a[1]).slice(0, 5);
        console.log("      pool: " + top.map(([b, n]) => `${b}:${n}`).join("  "));
      }
      if (stats.lap) console.log("      der : " + JSON.stringify(stats.lap));
    }
    console.log(`      findQ  : ${body.findQ.slice(0, 110)}`);
    console.log(`      rerankQ: ${body.rerankQ.slice(0, 110)}`);
  }
  if (theek && chahiye && ch.length) {
    const c = ch.find(x => x.book === chahiye);
    if (c) console.log(`      → ${(c.text || "").replace(/\s+/g, " ").slice(0, 95)}`);
  }
}

der.sort((a, b) => a - b);
console.log(`\n  ${pass}/${JAANCH.length} theek`
  + `   |  der: madhya ${der[Math.floor(der.length / 2)]}ms, sabse zyada ${der[der.length - 1]}ms`);
if (fail) console.log(`\n  ⚠️  ${fail} fail — poori naap chalane se pehle ye dekhna zaroori hai.`);
else      console.log(`\n  /search zinda hai.`);

// ── /chat BHI JAANCHO — 18 AGAST 2026 KO JODA ────────────────────────────
//
// KYUN: 17 Agast ko release se pehle yehi script chalayi thi. 10/10 pass.
// Agle din subah Ask POORA BAND tha — Groq ne model retire kar diya tha.
//
// Wajah ye nahi ki jaanch kamzor thi. Wajah ye hai ki ye script SIRF
// /search dekhti thi, aur toota /chat tha. Yaani jaancha wo gaya jo tha,
// dekha wo nahi gaya jo badla tha.
//
// Ab ek asli sawaal /chat par bhi jaata hai. Ye do cheezein pakadta hai
// jo 18 Agast ko ek ke peeche ek aayi thi:
//     404 — model ka naam mar chuka hai
//     413 — request Groq ke token-budget se badi hai
//
// ⚠️ Ye AI kota kharch karta hai — isliye SIRF EK sawaal, aur `--nochat`
//    se band bhi kiya ja sakta hai (jab sirf retrieval jaanchni ho).
if (!process.argv.includes("--nochat")) {
  console.log(`\n  ── /chat ki jaanch (1 sawaal, AI kota kharch hoga) ──`);
  const t0 = Date.now();
  try {
    const r = await fetch(API + "/chat", {
      method: "POST", headers: sirHeader(),
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Reply in one short line." },
          { role: "user", content: "Dharm ka ek line me arth batao." },
        ],
        temperature: 0.3, max_tokens: 80,
      }),
    });
    const txt = await r.text();
    if (!r.ok) {
      console.log(`  ❌ /chat HTTP ${r.status} — ${txt.slice(0, 160)}`);
      if (r.status === 404) console.log(`     → model ka naam mar chuka hai. https://console.groq.com/docs/deprecations dekhein.`);
      if (r.status === 413) console.log(`     → request Groq ke token-budget se badi hai. worker me TOKEN_BUDGET dekhein.`);
      // ⚠️ 429 KHARABI NAHI HAI — wo hamara apna din-bhar ka kota hai.
      // Ise fail ginna matlab asli outage aur kote ke khatam hone me koi
      // farq na rakhna. Owner token .env me ho to ye aata hi nahi.
      if (r.status === 429) {
        console.log(`     → Ye hamara apna kota hai, worker ki kharabi NAHI.`);
        console.log(`     → .env me EVAL_SESSION (owner token) daalne par ye nahi aayega.\n`);
        console.log(`  /search zinda hai. /chat jaancha nahi ja saka (kota).\n`);
        process.exit(0);
      }
      console.log(`\n  ⚠️  /search theek hai par /chat NAHI. Ask section user ke liye BAND hai.\n`);
      process.exit(1);
    }
    const j = JSON.parse(txt);
    const jawab = j?.choices?.[0]?.message?.content || j?.text || "";
    console.log(`  ✅ /chat theek — ${Date.now() - t0}ms`);
    console.log(`     → ${jawab.replace(/\s+/g, " ").slice(0, 100)}`);
    if (!jawab.trim()) {
      console.log(`\n  ⚠️  jawab KHAALI aaya. Model ne token "sochne" me kharch kar diye`);
      console.log(`      hon to aisa hota hai — max_tokens ya reasoning-setting dekhein.\n`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`  ❌ /chat: ${e.message}\n`);
    process.exit(1);
  }
  console.log(`\n  Dono zinda hain — /search aur /chat.`);
}
console.log();
