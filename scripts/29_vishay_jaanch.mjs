/**
 * SAARTHI — SABSE UPAR WALA ANSH SAWAAL KE VISHAY KA HAI BHI YA NAHI?
 * =====================================================================
 * 2026-08-18.  YE NAAP HAI, SUDHAAR NAHI. App me kuch nahi badalta.
 *
 * KYUN YE BANA — EK ASLI JAWAB SE
 * --------------------------------
 * Sawaal : "Sati ke janm ki story kya hai?"
 * Jawab  : "सती का जन्म... वह पहले ऋषि भृगु की पुत्री के रूप में जन्मी...
 *           श्लोक – 'पहले भृगुजीकी पुत्री होकर फिर लक्ष्मीजी क्षीर-समुद्रसे'"
 *
 * Wo LAKSHMI ki katha hai, Sati ki nahi. Model ne jo shlok uddhrit kiya
 * usme KHUD "लक्ष्मीजी" likha hai — aur wo use "सती" bata raha hai.
 *
 * Aur jad model me nahi thi. debug-query se naapa:
 *     "...फिर लक्ष्मीजी क्षीर-समुद्रसे"      rerank 0.9961   ← sabse upar
 *     "शोभामयी सती किस प्रकार उत्पन्न हुईं"   rerank 0.1181   ← gate ne kaata
 *
 * Doosra ansh sawaal ka SHABD-BA-SHABD jawab hai. Reranker ne use phenk
 * diya aur galat vyakti wale ansh ko sabse upar bitha diya. Model ne wahi
 * kiya jo koi bhi karta — pehla ansh uthaya.
 *
 * ⚠️ YE KAMI 19_eval_perbook KABHI NAHI PAKAD SAKTI.
 * Wo naapti hai "sahi GRANTH mila ya nahi". Yahan sahi granth MILA HI THA
 * (Vishnu Puran). Galti granth ke ANDAR thi. Ye wahi khaali jagah hai jo
 * 14 Agast ke audit me likhi thi — "granth naapti hai, paath nahi".
 *
 * YE SCRIPT KYA KARTI HAI
 * ------------------------
 * Har sawaal ke VISHISHT SHABD nikaalti hai (naam, paribhashik shabd),
 * phir /search se sabse upar wala ansh uthati hai, aur poochhti hai:
 *
 *     "kya us ansh me sawaal ka koi bhi vishisht shabd hai?"
 *
 * Nahi hai → SANDIGDH. Insaan ke padhne ke liye chhap jaata hai.
 *
 * ⚠️ YE FAISLA NAHI, CHHANNI HAI — dono taraf galti sambhav hai:
 *   • Ansh sahi ho sakta hai bina shabd mile (paryayvachi, sandhi,
 *     "उत्पन्न हुईं" vs "जन्म")
 *   • Ansh galat ho sakta hai shabd milne ke baad bhi
 * Isliye ank par faisla mat kijiye — neeche chhapa paath PADHIYE.
 * Yahi galti 14 Agast ko Aadhaar wale shabd-mel me ho chuki hai, jahan
 * 12 unit-test hare the aur asli jawab par 5 me se 4 ulte nikle.
 *
 * CHALAO:
 *   node scripts/29_vishay_jaanch.mjs              # 40 sawaal
 *   node scripts/29_vishay_jaanch.mjs --n 100
 *   node scripts/29_vishay_jaanch.mjs --sab        # theek wale bhi dikhao
 *
 * AI kota kharch NAHI hota — sirf /search chalti hai.
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

const { vishishtShabd } = await import("../src/knowledge/aadhaar.js");
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { BOOK_META } = await import("../src/data/bookMeta.js");
const { normalizeQueryForSearch, expandQueryWithParyay, questionToTopic, stripMetaFraming } =
  await import("../src/knowledge/translit.js");

const naam = id => (BOOK_META[id]?.en || BOOK_META[id]?.title || id);

/**
 * ⚠️ PRASHN-SHABD HATAO — warna chhanni NARM ho jaati hai.
 *
 * `vishishtShabd()` "क्या", "कैसे", "क्यों" ko vishisht ginta hai (wo
 * aadhaar.js ki AAM_SHABD soochi me nahi hain). Par ye har Hindi paath
 * me bikhre pade hain. Agar sawaal ka "क्या" kisi bhi ansh me mil jaye,
 * chhanni use "vishay mil gaya" maan legi — jabki usse kuch saabit nahi
 * hota.
 *
 * Nateeja ULTA hota: asli kamiyan chhoot jaati aur ank achha dikhta.
 * Wahi galti 14 Agast ko Aadhaar wale shabd-mel me ho chuki hai.
 *
 * Ye soochi yahin rakhi hai, aadhaar.js me nahi — kyunki ye IS jaanch ki
 * zaroorat hai, us module ki nahi. Wahan badalne se uske 12 test aur
 * uska apna maqsad chhed jaate.
 */
const PRASHN_SHABD = new Set([
  "क्या", "कैसे", "क्यों", "कौन", "कहाँ", "कहां", "कब", "किस", "किसे",
  "किसका", "किसकी", "किसके", "कितना", "कितने", "कितनी", "बताओ", "बताइए",
  "समझाओ", "समझाइए", "मतलब", "अर्थ", "बारे", "संबंध", "विषय",
]);
const sawaalKeShabd = (t) => new Set([...vishishtShabd(t)].filter(w => !PRASHN_SHABD.has(w)));

/** ChatView jo bhejta hai, bilkul wahi */
function queryBanao(q) {
  const { query: searchQ } = normalizeQueryForSearch(q);
  const baseQ = stripMetaFraming(searchQ);
  return { findQ: expandQueryWithParyay(baseQ), rerankQ: questionToTopic(baseQ), hintedBook: detectHintedBook(q) };
}

async function khojo(q, koshish = 1) {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  const r = await fetch(API + "/search", { method: "POST", headers: h, body: JSON.stringify(queryBanao(q)) });
  if (r.status === 429 && koshish <= 4) {
    await new Promise(s => setTimeout(s, 6000 * koshish));
    return khojo(q, koshish + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).chunks || [];
}

// ── sawaal chuno ─────────────────────────────────────────────────────
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const WANT = parseInt(arg("n", "40"), 10);
const SAB  = process.argv.includes("--sab");

const EVAL = join(ROOT, "eval-perbook.json");
if (!existsSync(EVAL)) { console.error("❌ eval-perbook.json nahi mili"); process.exit(1); }
const all = JSON.parse(readFileSync(EVAL, "utf8"));

// ⚠️ Sirf wo sawaal jinme kam se kam 2 vishisht shabd hain. Jinme ek bhi
// nahi ("Ye kya hai?" jaise), unpar ye chhanni kuch keh hi nahi sakti —
// unhe rakhna sirf shor badhata.
const layak = all.filter(r => {
  const { query } = normalizeQueryForSearch(r.q);
  return sawaalKeShabd(query).size >= 2;
});
const step = Math.max(1, Math.floor(layak.length / WANT));
const sawaal = Array.from({ length: Math.min(WANT, layak.length) }, (_, i) => layak[i * step]).filter(Boolean);

console.log(`\n  ${sawaal.length} sawaal — sabse upar wale ansh ka vishay milaya ja raha hai`);
console.log(`  (${all.length} me se ${layak.length} me 2+ vishisht shabd hain)\n`);
console.log(`  ⚠️  Ye CHHANNI hai, faisla nahi. Neeche chhapa paath PADHIYE.\n`);
console.log(`  ${"═".repeat(74)}`);

const byora = [];
let sandigdh = 0, theek = 0, khaali = 0;

for (let i = 0; i < sawaal.length; i++) {
  const r = sawaal[i];
  let ch;
  try { ch = await khojo(r.q); }
  catch (e) { console.log(`  ❌ ${r.q.slice(0, 50)} — ${e.message}`); continue; }

  if (!ch.length) { khaali++; continue; }

  const { query } = normalizeQueryForSearch(r.q);
  const qShabd = sawaalKeShabd(query);
  const top    = ch[0];
  const tShabd = vishishtShabd(top.text || "");

  const mile = [...qShabd].filter(w => tShabd.has(w));
  // ⚠️ Sirf poora shabd nahi — sandhi/vibhakti ke kaaran "सती" paath me
  // "सतीकी" bankar aata hai. Isliye substring bhi dekhte hain.
  const paathMe = [...qShabd].filter(w => (top.text || "").includes(w));
  const ok = mile.length > 0 || paathMe.length > 0;

  if (ok) { theek++; if (!SAB) { byora.push({ q: r.q, ok: true }); continue; } }
  else sandigdh++;

  console.log(`\n  ── ${i + 1}/${sawaal.length}  ${ok ? "theek" : "⚠️ SANDIGDH"} ─────────────────────`);
  console.log(`  SAWAAL      : ${r.q.slice(0, 68)}`);
  console.log(`  vishisht    : ${[...qShabd].slice(0, 6).join(" · ")}`);
  console.log(`  sabse upar  : ${naam(top.book)}   rerank ${(top.rerank ?? 0).toFixed(4)}`);
  console.log(`  mile shabd  : ${paathMe.length ? paathMe.join(" · ") : "(EK BHI NAHI)"}`);
  console.log(`  paath       : ${(top.text || "").replace(/\s+/g, " ").slice(0, 200)}`);

  byora.push({ q: r.q, ok, top: top.book, rerank: top.rerank, mile: paathMe, paath: (top.text || "").slice(0, 400) });
  await new Promise(s => setTimeout(s, 300));
}

writeFileSync(join(ROOT, "vishay-jaanch.json"), JSON.stringify(byora, null, 1), "utf8");

const kul = theek + sandigdh;
console.log(`\n  ${"═".repeat(74)}`);
console.log(`  jaanche gaye   : ${kul}   (${khaali} sawaal par koi ansh nahi mila)`);
console.log(`  theek          : ${theek}   (${(100 * theek / Math.max(kul, 1)).toFixed(0)}%)`);
console.log(`  ⚠️ SANDIGDH    : ${sandigdh}   (${(100 * sandigdh / Math.max(kul, 1)).toFixed(0)}%)`);
console.log(`
  KAISE PADHEIN — ank par nahi, PAATH par:

    Har SANDIGDH par khud tay kijiye:
      "kya ye ansh is sawaal ka jawab deta hai?"

      haan  →  chhanni ki galti (paryayvachi, sandhi). Ginti se hatao.
      nahi  →  ASLI KAMI. Reranker ne galat ansh sabse upar bithaya.

  ⚠️ 10% se zyada ASLI nikle to reranker par kaam karna hoga —
     wo #20 (Ramcharitmanas 4 guna peeche) aur #21 (score batch-sapeksh)
     ke saath ek hi jad hai.

  poora byora: vishay-jaanch.json
`);
