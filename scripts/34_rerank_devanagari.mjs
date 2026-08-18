/**
 * SAARTHI — kya reranker DEVANAGARI par kaam bhi karta hai?  2026-08-18
 * =====================================================================
 * 33_rerank_swabhav.mjs ne #21 ko KHAARIJ kar diya: score bilkul absolute
 * hai (0.0057, chaaron dashamlav tak, har batch/kram/aakar par). Batch me
 * todna nuksaandeh nahi hai.
 *
 * PAR USI NAAP ME EK AUR BAAT NIKLI, JO ISSE BADI HAI:
 *     sawaal : "वैराग्य और विषाद में क्या भेद है"
 *     ansh   : Yoga Vasishtha ka wo panna jisme "वैराग्य" shabd MAUJOOD hai
 *     score  : 0.0057          (gate 0.30 par hai)
 *
 * Do bilkul alag wajah ho sakti hain, aur inka ilaaj ULTA hai:
 *
 *   A. Wo ansh sach me bekaar tha (vishay-suchi ki line, ya adhoora
 *      OCR). Tab reranker theek hai aur galti meri chunne me thi.
 *
 *   B. Reranker Devanagari par kaam hi nahi karta — sab kuch shoonya ke
 *      paas deta hai. Tab gate 0.30 ka matlab hai "lagbhag sab kuch giro",
 *      aur jo bachta hai wo yogyata se nahi, ittefaq se bachta hai.
 *
 * ⚠️ B ka matlab bahut bada hoga: #2, #20, #25, #42 — sab ek hi jagah se
 * aa rahe honge. Aur ye BHI samjhata ki 13 Agast ko COSINE_PAKKA=3 ne
 * jhoothi citations 0 → 21 kyun kar di: agar rerank ke ank bekaar hain to
 * unhe darkinar karne par jo bacha wo bhi bekaar hi tha.
 *
 * ⚠️ PAR SAAVDHAN — reranker NAAP PAR joda gaya tha: cosine ka gap
 * +0.0059 vs reranker ka +0.8878 (150 guna). Yaani kabhi to wo kaam
 * karta hi hai. Isliye "kaam nahi karta" kehne se pehle ye script uske
 * ANK BAANTKAR dekhti hai, ek namoone par nahi.
 *
 * ── KYA NAAPA JAATA HAI ──────────────────────────────────────────────
 *  1. BAANT — 20 SAHI-vishay ansh vs 20 ASAMBANDHIT ansh. Reranker ka
 *     kaam sirf ooncha ank dena nahi, DONO ME FARAK karna hai. Isliye
 *     dekha jaata hai ki kitni baar sahi ansh galat se upar aaya
 *     (jodi-dar-jodi — yahi AUC hai). 1.00 = poora sahi, 0.50 = sikka
 *     uchhaalne jitna, 0.00 = ULTA.
 *  2. GATE — un 40 me se kitne 0.30 paar karte hain.
 *  3. ANGREZI KI TULNA — WAHI sawaal aur WAHI baat angrezi me. Agar
 *     angrezi par ank ooncha aur Devanagari par shoonya — to rog bhasha
 *     ka hai, ansh ka nahi.
 *
 * CHALAO:
 *   node scripts/34_rerank_devanagari.mjs
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
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
const API = (env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
if (!API) { console.error("❌ .env me VITE_AI_PROXY_URL chahiye"); process.exit(1); }
const ORIGIN  = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SESSION = (env.EVAL_SESSION || "").trim();
const RERANK  = API + "/rerank";
const GATE    = 0.30;

const so = (ms) => new Promise(s => setTimeout(s, ms));

async function score(query, texts, koshish = 1) {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  const r = await fetch(RERANK, {
    method: "POST", headers: h,
    body: JSON.stringify({ query, contexts: texts.map(t => ({ text: t })) }),
  });
  if (r.status === 429 && koshish <= 4) { await so(6000 * koshish); return score(query, texts, koshish + 1); }
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 120)}`);
  return (await r.json()).scores;
}

function anshLo(book, kitne, chhaano = null) {
  const dir = join(ROOT, "data", "chunks", book);
  const files = readdirSync(dir).filter(f => f.startsWith("chunk_")).sort();
  const out = [];
  for (const f of files) {
    let d; try { d = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { continue; }
    const t = (d.text || "").replace(/\s+/g, " ").trim();
    if (t.length < 220) continue;
    if (chhaano && !chhaano.test(t)) continue;
    out.push({ t: t.slice(0, 1200), page: d.page_display, id: d.chunk_id });
    if (out.length >= kitne) break;
  }
  return out;
}

const f = (x) => x.toFixed(4);

const SAWAAL = "वैराग्य और विषाद में क्या भेद है";
const sahi = anshLo("yoga_vasishtha", 20, /वैराग्य/);
const galat = anshLo("lal_kitab", 20);

if (sahi.length < 8 || galat.length < 8) {
  console.error(`❌ kaafi ansh nahi mile (sahi ${sahi.length}, galat ${galat.length})`);
  process.exit(1);
}

console.log(`\nRERANKER DEVANAGARI PAR — sawaal: "${SAWAAL}"`);
console.log(`   sahi-vishay ansh: ${sahi.length} (Yoga Vasishtha, jinme "वैराग्य" hai)`);
console.log(`   asambandhit ansh: ${galat.length} (Lal Kitab)`);
console.log("═".repeat(76));

// ⚠️ 20-20 karke bhejo — bilkul waise hi jaise worker bhejta hai
// (RERANK_MAX_CONTEXTS = 20). 33 ne sabit kiya ki batch se farak nahi
// padta, isliye ye sirf raftaar ke liye hai, natije ke liye nahi.
const sS = [], gS = [];
for (let i = 0; i < sahi.length; i += 20) { sS.push(...await score(SAWAAL, sahi.slice(i, i + 20).map(x => x.t))); await so(400); }
for (let i = 0; i < galat.length; i += 20) { gS.push(...await score(SAWAAL, galat.slice(i, i + 20).map(x => x.t))); await so(400); }

// ── 1. BAANT ──────────────────────────────────────────────────────────
const sSort = [...sS].sort((a, b) => b - a);
const gSort = [...gS].sort((a, b) => b - a);
console.log(`\n1️⃣  ANK KI BAANT`);
console.log(`   sahi-vishay : sabse ooncha ${f(sSort[0])}   beech ka ${f(sSort[Math.floor(sSort.length/2)])}   sabse neecha ${f(sSort.at(-1))}`);
console.log(`   asambandhit : sabse ooncha ${f(gSort[0])}   beech ka ${f(gSort[Math.floor(gSort.length/2)])}   sabse neecha ${f(gSort.at(-1))}`);

// jodi-dar-jodi: kitni baar sahi ansh galat se upar (AUC)
let jeet = 0, barabar = 0;
for (const a of sS) for (const b of gS) { if (a > b) jeet++; else if (a === b) barabar++; }
const auc = (jeet + barabar / 2) / (sS.length * gS.length);
console.log(`\n   FARAK KARNE KI KSHAMTA (AUC): ${auc.toFixed(3)}`);
console.log(`   ${auc >= 0.80 ? "✅ reranker sahi-galat me farak kar raha hai"
           : auc >= 0.60 ? "🟡 halka farak — bharosemand nahi"
           : auc >= 0.45 ? "🔴 sikka uchhaalne jitna — koi farak nahi kar raha"
                         : "🔴 ULTA chal raha hai — galat ansh ko upar rakh raha hai"}`);

// ── 2. GATE ───────────────────────────────────────────────────────────
const sPaar = sS.filter(x => x >= GATE).length, gPaar = gS.filter(x => x >= GATE).length;
console.log(`\n2️⃣  GATE (${GATE})`);
console.log(`   sahi-vishay ansh gate paar : ${sPaar}/${sS.length}`);
console.log(`   asambandhit ansh gate paar : ${gPaar}/${gS.length}`);
if (!sPaar) console.log(`   ⚠️ EK BHI sahi-vishay ansh gate paar nahi kar paya.`);

// ── 3. ANGREZI KI TULNA ───────────────────────────────────────────────
// ⚠️ Ye NAKLI paath hai, corpus ka nahi — jaan-boojhkar. Sawaal ye nahi ki
// hamara corpus kaisa hai; sawaal ye hai ki MODEL angrezi par wahi kaam
// karta hai ya nahi jo Devanagari par nahi kar pa raha.
const enQ = "what is the difference between dispassion and despondency";
const enSahi = "Dispassion (vairagya) is the calm turning away of the mind from worldly objects after seeing their true nature. Despondency is grief and dejection of the heart. The two look alike from outside, but dispassion brings clarity and peace, while despondency brings dullness and sorrow.";
const enGalat = "The second house of the horoscope is examined for family, wealth and speech. Remedies for this house include feeding cows and offering water to the rising sun on Tuesday mornings.";
const en = await score(enQ, [enSahi, enGalat]);
console.log(`\n3️⃣  WAHI BAAT ANGREZI ME (nakli paath — sirf model jaanchne ko)`);
console.log(`   sahi jawab   : ${f(en[0])}`);
console.log(`   asambandhit  : ${f(en[1])}`);

// ── FAISLA ────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(76));
if (en[0] >= 0.5 && sSort[0] < 0.30) {
  console.log(`🔴 ROG BHASHA KA HAI, ANSH KA NAHI.`);
  console.log(`   Angrezi par ${f(en[0])}, Devanagari par sabse ooncha ${f(sSort[0])}.`);
  console.log(`   Yaani @cf/baai/bge-reranker-base Devanagari par kaam nahi karta.`);
  console.log(`   Tab gate 0.30 ka matlab hai "lagbhag sab giro" — aur jo bachta`);
  console.log(`   hai wo yogyata se nahi, ittefaq se bachta hai. #2/#20/#25/#42`);
  console.log(`   sab isi ek jagah se aa rahe honge.`);
} else if (auc >= 0.80) {
  console.log(`🟢 RERANKER FARAK KAR RAHA HAI. Ank chhote hain par kram sahi hai.`);
  console.log(`   Tab ilaaj gate ka hai (0.30 bahut ooncha), model ka nahi.`);
} else {
  console.log(`🟡 Saaf faisla nahi. Neeche ke ank khud padhein — aur ek doosre`);
  console.log(`   sawaal par dobara chalayein; ek namoona kaafi nahi hai.`);
}

console.log(`\nSabse ooncha sahi-vishay ansh (score ${f(sSort[0])}):`);
console.log(`   ${sahi[sS.indexOf(sSort[0])].t.slice(0, 220)}…`);
