/**
 * SAARTHI — purana raasta aur naya raasta EK JAISA hai ya nahi   2026-08-18
 * =====================================================================
 * KYUN YE SCRIPT HAI:
 *
 * Aaj query banane ka poora tark client se worker par gaya. Ab do raaste
 * hain jo EK HI cheez karni chahiye:
 *
 *   PURANA :  client hi findQ/rerankQ/hintedBook banata hai aur bhejta hai
 *   NAYA   :  client sirf kaccha sawaal `q` bhejta hai, worker banata hai
 *
 * Purana raasta abhi bhi zinda hai — kyunki kisi user ke browser me purani
 * file cache me padi ho sakti hai. Yaani dono raaste saath-saath chalenge,
 * aur do jagah ek hi tark ka matlab hai ki wo tark ALAG HO JAYEGA.
 *
 * ── PEHLI KOSHISH GALAT THI, AUR YE BAAT YAHIN LIKHI JAANI CHAHIYE ──
 *
 * Is script ka pehla roop kehta tha: "dono raaston ke ansh ki ID BILKUL
 * ek jaisi honi chahiye." 12 me se 7 fail hue. Par unhe padhne par kuch
 * ajeeb dikha:
 *
 *   "गीता में कर्म योग क्या है?" — poori Devanagari, yaani lipyantaran
 *   chhoota hi nahi. Dono taraf findQ akshar-dar-akshar EK. Fir bhi ek
 *   taraf 13 ansh aaye, doosri taraf wahi 12 — sirf aakhri ghayab.
 *
 *   "मुझे डर लगता है क्या करूं" — WAHI ansh, sirf KRAM alag.
 *
 * Ek hi input do alag output de raha tha. Yaani gadbad naye raaste me
 * nahi thi — /search KHUD hi har baar bilkul wahi jawab nahi deta.
 *
 * DO WAJAH, DONO PEHLE SE JAANI HUI:
 *   1. Vectorize ka ANN search ANUMANIT hai, theek nahi. Bराबरी ke
 *      paas wale score par kaun pehle aaya, ye baar-baar badal sakta hai.
 *   2. #21 — rerank ka score BATCH-SAPEKSH hai. Pool me ek ansh idhar-
 *      udhar hua to BAAKI SAB ke score hil jaate hain, aur gate alag
 *      ansh paas karta hai. Yaani ANN ka chhota-sa shor yahan aakar
 *      bada ho jaata hai.
 *
 * ⚠️ ISLIYE "BILKUL EK JAISA" GALAT KASAUTI HAI. Us kasauti par ye
 * script tab bhi fail deti jab naya raasta bilkul theek hota — aur main
 * ek aisa bug ghanton dhoondhta jo hai hi nahi.
 *
 * ── DOOSRI KOSHISH BHI GALAT THI ────────────────────────────────────
 *
 * Phir maine socha: shor naap lo, aur dekho ki naya raasta shor se zyada
 * to nahi bhatka. Teen call — A1, A2 (wahi body dobara), B.
 *
 * Naap ye nikli:
 *      /search ka apna shor : ausat 29%
 *      "महाभारत में धर्म क्या है"  →  100%   (poore alag ansh!)
 *      "रामचरितमानस में भक्ति"      →   76%
 *
 * Yaani ek hi sawaal do baar poochhne par bilkul alag granth aa sakte
 * hain. Us 29% shor ke saamne "naye ka antar 28%" kuch SABIT NAHI karta
 * — na paas, na fail. Do "fail" me shor 0% dikha, par jis sawaal ne 100%
 * dikhaya usse saaf hai ki shor sthir seema hai hi nahi.
 *
 * (Wo 29% shor apne aap me ek badi khoj hai — par ALAG samasya hai, #21
 * ka natija. Is script ka usse koi lena-dena nahi.)
 *
 * ── AB KASAUTI YE HAI ────────────────────────────────────────────────
 *
 * Maine QUERY BANANE ka tark badla hai — search ka natija NAHI. Natija
 * shor se bhara hai; tark bilkul shuddh hai. To seedhe TARK ko naapo.
 *
 * Worker ab `stats.q = { findQ, rerankQ }` lautata hai — wo string jo
 * usne khud banayi. Client wahi string apne purane tark se banata hai.
 * Dono AKSHAR-DAR-AKSHAR milni chahiye. Isme ANN ka shor ghus hi nahi
 * sakta, isliye ye jaanch nirnayak hai:
 *
 *      findQ    milta hai?   →  Vectorize/FTS ko wahi ja raha hai
 *      rerankQ  milta hai?   →  reranker ko wahi ja raha hai
 *      hinted   milta hai?   →  granth-hint ka tark wahi hai
 *
 * Teeno mile = query-prep sahi jagah pahunch gaya. Ansh alag aayein to
 * wo /search ka purana rog hai, is badlaav ka nahi.
 *
 * SEEKH, jo yahan likhi rehni chahiye: jab kisi cheez ki naap uske shor
 * se chhoti ho, to naap ki jagah badlo — chhoot mat badhao. Yahan asli
 * badlaav do string ka tha; unhe seedhe naapna hamesha se maujood tha,
 * bas maine do baar ghoom kar dekha.
 *
 * ⚠️ YE NAAP NAHI HAI. Ye ye NAHI batati ki jawab achha hai — sirf ye ki
 * naya raasta purane jaisa chal raha hai. Achhai 14_eval_search.mjs se.
 *
 * CHALAO (worker deploy ke BAAD):
 *   node scripts/30_query_prep_jaanch.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const ORIGIN = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SEARCH = API + "/search";

// ⚠️ SESSION HEADER — bina iske call anonymous jaati hai, din-bhar ke kote
// par 429 khaati hai, aur script "sab toot gaya" chhaap deti hai. 18 Agast
// ko 17_smoke_check.mjs me yahi chhoot gaya tha aur ek JHOOTHA outage
// report hua. Asli outage aur script ki apni galti bilkul ek jaise dikhte
// hain — isliye ye header yahan sabse upar likha ja raha hai.
const sirHeader = () => {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  const t = (env.EVAL_SESSION || "").trim();
  if (t) h["X-Saarthi-Session"] = t;
  return h;
};

// ⚠️ Ye wahi teen kadam hain jo ChatView.jsx me the — na kam, na zyada.
// Purana raasta jaanchna hai to purana tark yahin chahiye. Jis din client
// se ye hat jayega, ye script hi purane raaste ki aakhri gawah hogi.
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { normalizeQueryForSearch, expandQueryWithParyay, questionToTopic, stripMetaFraming } =
  await import("../src/knowledge/translit.js");

function puraanaDhaancha(q) {
  const { query: searchQ } = normalizeQueryForSearch(q);
  const baseQ = stripMetaFraming(searchQ);
  return {
    findQ: expandQueryWithParyay(baseQ).trim(),
    rerankQ: questionToTopic(baseQ).trim(),
    hintedBook: detectHintedBook(q),
  };
}

/**
 * SAWAAL — jaan-boojhkar teeno bhasha aur dono haalat (granth ka naam
 * hai / nahi hai). Query-prep ka tark inhi par alag-alag chalta hai:
 *   • Devanagari      → translit chhoota hi nahi (ratio ≥ 0.3 par turant return)
 *   • Hinglish        → poora lipyantaran chalta hai
 *   • Angrezi         → detectQueryLanguage "en" par lipyantaran BAND
 *   • bina granth ke  → hintedBook null aana chahiye, dono taraf
 */
const SAWAAL = [
  "गीता में कर्म योग क्या है?",
  "gita me karma yog kya hai",
  "what does the gita say about karma",
  "रामचरितमानस में भक्ति के बारे में क्या कहा है?",
  "ramayan me maryada kya hai",
  "महाभारत में धर्म क्या है",
  "मकर राशि वालों के लिए उपाय",
  "मुझे डर लगता है क्या करूं",
  "I feel anxious about the future",
  "पति पत्नी में झगड़ा हो तो क्या करें",
  "Yoga Sutra me kleshas kitne hain",
  "एकादशी व्रत का महत्व क्या है",
];

async function poochho(body) {
  const res = await fetch(SEARCH, {
    method: "POST",
    headers: sirHeader(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { err: `HTTP ${res.status} — ${t.slice(0, 160)}` };
  }
  const j = await res.json();
  const chunks = Array.isArray(j?.chunks) ? j.chunks : [];
  return {
    ids: chunks.map(c => c.id ?? c.chunk_id ?? `${c.book}#${c.idx}`),
    granth: [...new Set(chunks.map(c => c.book))],
    hinted: j?.stats?.hinted ?? null,
    q: j?.stats?.q ?? null,      // ⚠️ ASLI naap — worker ne kya banaya
  };
}

/**
 * ⚠️ EK BAAR ME EK — jaan-boojhkar dhima. /search har call par Workers AI
 * se embedding aur rerank karwata hai; ek saath bhejne par rate-limit
 * lagta hai aur us par "raaste alag hain" ka bhram hota hai.
 */
let paas = 0, fail = 0;
const gadbad = [];

console.log(`\nQUERY-PREP: client ka tark vs worker ka tark — ${SAWAAL.length} sawaal`);
console.log(`(findQ / rerankQ / hint — teeno akshar-dar-akshar milne chahiye)`);
console.log("─".repeat(72));

for (const q of SAWAAL) {
  const p = puraanaDhaancha(q);   // client jo banata (aur banata tha)
  const B = await poochho({ q }); // worker ne kaccha sawaal par kya banaya

  if (B.err) {
    fail++;
    gadbad.push({ q, kyun: B.err });
    console.log(`❌ ${q}\n   ${B.err}`);
    continue;
  }

  // ⚠️ `stats.q` na aaye to CHUP-CHAAP paas mat karna. Uska matlab hai ki
  // purana worker chal raha hai — yaani jaanch hui hi nahi. Bina iske ye
  // script har baar ✅ deti aur kuch bhi jaanchti nahi.
  if (!B.q) {
    fail++;
    gadbad.push({ q, kyun: "stats.q nahi aaya — purana worker chal raha hai? deploy karein." });
    console.log(`❌ ${q}\n   stats.q nahi aaya — worker deploy hua?`);
    continue;
  }

  const findMila   = B.q.findQ   === p.findQ;
  const rerankMila = B.q.rerankQ === p.rerankQ;
  const hintMila   = (B.hinted ?? null) === (p.hintedBook ?? null);

  if (findMila && rerankMila && hintMila) {
    paas++;
    console.log(`✅ ${q}`);
    console.log(`   findQ  : ${p.findQ}`);
    if (p.rerankQ !== p.findQ) console.log(`   rerankQ: ${p.rerankQ}`);
    console.log(`   hint   : ${p.hintedBook ?? "koi nahi"}   ·   ${B.ids.length} ansh mile`);
  } else {
    fail++;
    console.log(`❌ ${q}`);
    if (!findMila) {
      console.log(`   findQ ALAG`);
      console.log(`     client: ${JSON.stringify(p.findQ)}`);
      console.log(`     worker: ${JSON.stringify(B.q.findQ)}`);
    }
    if (!rerankMila) {
      console.log(`   rerankQ ALAG`);
      console.log(`     client: ${JSON.stringify(p.rerankQ)}`);
      console.log(`     worker: ${JSON.stringify(B.q.rerankQ)}`);
    }
    if (!hintMila) console.log(`   hint ALAG — client=${p.hintedBook} worker=${B.hinted}`);
    gadbad.push({ q, client: p, worker: { ...B.q, hinted: B.hinted } });
  }
}

console.log("─".repeat(72));
console.log(`mile: ${paas}/${SAWAAL.length}   alag: ${fail}`);

if (fail) {
  console.log(`\n⚠️ CLIENT AUR WORKER ALAG QUERY BANA RAHE HAIN.`);
  console.log(`   Client ko abhi mat badalna — pehle worker ka /search theek karo.`);
  console.log(JSON.stringify(gadbad, null, 2).slice(0, 4000));
  process.exit(1);   // ⚠️ pipeline rok do — ye pehra hai, riport nahi
}

console.log(`\n✅ Dono taraf bilkul ek hi query banti hai. Client badalna surakshit hai.`);
console.log(`\nℹ️  Ye ye NAHI kehta ki dono ke ANSH ek jaise aayenge. /search khud`);
console.log(`   sthir nahi hai — wahi body do baar bhejne par 29% tak alag ansh`);
console.log(`   aate hain (ek sawaal par 100%). Wo #21 ka rog hai, alag kaam.`);
