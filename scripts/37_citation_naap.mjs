/**
 * SAARTHI — JO USER KO DIKHTA HAI, WAHI NAAPO             2026-08-19
 * =====================================================================
 * ⚠️ YE SCRIPT ISLIYE BANI KI HAMARI SAARI "JHOOTHI CITATION" WALI NAAP
 * ASAL ME RETRIEVAL NAAP RAHI THI, CITATION NAHI.
 *
 * `14_eval_search --set control` ye ginti hai ki `/search` ne kaunse
 * granth LAUTAYE. Par user ko wo nahi dikhte. User ko jo dikhta hai wo
 * teen aur kadam ke BAAD banta hai:
 *
 *     /search ke ansh  →  /chat (asli jawab)
 *                      →  model `[[GRANTH: A | B]]` likhta hai
 *                      →  us soochi ko bheje gaye granthon se MILAYA
 *                         jaata hai (src/shared/aadhaar.js)
 *                      →  tab "📚 Aadhaar: …" banta hai
 *
 * Beech ka har kadam citation GHATA sakta hai. Isliye retrieval ki ginti
 * hamesha ASLI se ZYADA hoti hai — aur us zyada ginti par faisle liye
 * gaye. 18 Agast ko maine gate ka badlaav "muft" bataya kyunki retrieval
 * ki ginti dono taraf barabar thi; deploy karne par citation 0 se 1 ho
 * gayi. Naap galat cheez naap rahi thi, code galat nahi tha.
 *
 * ── KYA GINTI HAI ────────────────────────────────────────────────────
 *   CHUP RAHA      — isOutOfScope ne roka, ya koi ansh mila hi nahi
 *   AADHAAR AAYA   — user ko granth ka naam dikha
 *   GADHE NAAM     — model ne aisa granth likha jo bheja hi nahi tha
 *                    (mel ne roka, par ye ginti chhupani nahi chahiye)
 *   GIR GAYA       — model ki soochi kaam nahi aayi, saare granth dikhe
 *
 * control / control_kathin par AADHAAR AAYA = 0 hona chahiye.
 * Baaki set par AADHAAR AAYA jitna zyada, utna achha.
 *
 * ⚠️ HAR SAWAAL PAR EK /chat CALL JAATI HAI — AI ka kota kharch hota hai,
 * aur Groq ki seema 8K TPM hai. Isliye default sirf 20 sawaal.
 *
 * CHALAO:
 *   node scripts/37_citation_naap.mjs --set control
 *   node scripts/37_citation_naap.mjs --set control_kathin
 *   node scripts/37_citation_naap.mjs --set hindi_100 --n 15
 *   node scripts/37_citation_naap.mjs --set control --jawab   # jawab bhi dikhao
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, khojo, dhaalo, jawabLo, promptBanao, so } from "./lib/pipeline.mjs";

const { isOutOfScope } = await import("../src/knowledge/translit.js");
const { granthPanktiNikaalo, aadhaarBanao } = await import("../src/shared/aadhaar.js");

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SET  = arg("set", "control");
const WANT = parseInt(arg("n", "0"), 10) || 0;
const DIKHAO = process.argv.includes("--jawab");

const QS = JSON.parse(readFileSync(join(ROOT, "scripts", "eval-questions.json"), "utf8"));
if (!QS[SET]) {
  console.error(`❌ "${SET}" naam ka set nahi hai. Maujood: ${Object.keys(QS).filter(k => k !== "_readme").join(", ")}`);
  process.exit(1);
}

// ⚠️ SET DO SHAKL ME HAIN — kuch me seedhe string hain, kuch me
// `{ q, book }` jaise object. Pehli baar maine sirf string liye the aur
// `--set hindi_100` par script ne 0 SAWAAL uthaye — phir bhi "0/0 ✅"
// jaisa saar chhaap diya. Chup-chaap.
//
// ⚠️ `_` se shuru hone wali line TIPPANI hai, sawaal nahi. 18 Agast tak
// control me aisi 6 line thi aur wo har naap me /search par jaati thi —
// 6 bekaar call, aur denominator galat (1/38 asal me 1/32 tha).
let sawaal = QS[SET]
  .map(it => (typeof it === "string" ? it : it && it.q))
  .filter(q => typeof q === "string" && q.trim() && !q.startsWith("_"));

// ⚠️ KHAALI PAR CHUP MAT RAHO. Ek script jo 0 sawaal chala kar "0 ✅"
// chhaap de, wo us script se bilkul alag nahi dikhti jo sach me 0 galti
// paayi ho. Ye poori file usi farak ke liye likhi gayi hai.
if (!sawaal.length) {
  console.error(`❌ "${SET}" se ek bhi sawaal nahi mila.`);
  console.error(`   Set me ${QS[SET].length} entry hain — shayad unka dhaancha alag hai.`);
  console.error(`   Pehli entry: ${JSON.stringify(QS[SET][0]).slice(0, 160)}`);
  process.exit(1);
}
if (WANT && WANT < sawaal.length) {
  const step = Math.max(1, Math.floor(sawaal.length / WANT));
  sawaal = Array.from({ length: WANT }, (_, i) => sawaal[i * step]).filter(Boolean);
}

const isControl = /control/i.test(SET);
const prompt = await promptBanao();

console.log(`\n${"═".repeat(74)}`);
console.log(`  CITATION KI NAAP — set "${SET}", ${sawaal.length} sawaal`);
console.log(`  (jo USER KO DIKHTA HAI wahi gina ja raha hai, retrieval nahi)`);
console.log(`  andaazan samay: ${Math.ceil(sawaal.length * 7 / 60)} minute · har sawaal par ek /chat call`);
console.log(`${"═".repeat(74)}\n`);

const byora = [];
let chup = 0, aadhaarAaya = 0, kulGadhe = 0, girGaye = 0, binaSoochi = 0, gadbad = 0, khaali = 0;

for (let i = 0; i < sawaal.length; i++) {
  const q = sawaal[i];
  const n = `[${String(i + 1).padStart(2)}/${sawaal.length}]`;

  // ── kadam 1: client ka pehra (ChatView isi kram me karta hai) ──────
  if (isOutOfScope(q)) {
    chup++;
    byora.push({ q, kyun: "isOutOfScope", aadhaar: [] });
    console.log(`  🔇 ${n} chup (daayre se bahar) — ${q.slice(0, 50)}`);
    continue;
  }

  let ch, jawab;
  try {
    ({ chunks: ch } = await khojo(q));
  } catch (e) {
    gadbad++; console.log(`  ⚠️  ${n} /search fail — ${e.message}`); continue;
  }

  if (!ch.length) {
    chup++;
    byora.push({ q, kyun: "koi ansh nahi", aadhaar: [] });
    console.log(`  🔇 ${n} chup (koi ansh nahi) — ${q.slice(0, 50)}`);
    await so(300);
    continue;
  }

  const dhale = await dhaalo(ch);
  try {
    jawab = await jawabLo(q, dhale, prompt);
  } catch (e) {
    gadbad++; console.log(`  ⚠️  ${n} /chat fail — ${e.message}`); continue;
  }

  // ── kadam 2: wahi tark jo app chalati hai ──────────────────────────
  const { text, granthKahe } = granthPanktiNikaalo(jawab);
  let { granth, gadhe, soochiMili, girGaya } = aadhaarBanao(granthKahe, dhale);

  // ⚠️ APP KA PEHRA — useChat.js line ~615:
  //     if (responseText && groundedChunks.length > 0 && …)
  // Yaani KHAALI jawab par Aadhaar lagta hi nahi. Pehli baar ye shart
  // yahan nahi thi aur script ne teen khaali jawabon par "Aadhaar aaya"
  // gina — jo APP KA BARTAAV HAI HI NAHI. Ek naap ko app se ZYADA
  // sakht hona bhi utna hi galat hai jitna kam.
  const khaaliJawab = !String(text || "").trim();
  if (khaaliJawab) granth = [];

  if (gadhe.length) kulGadhe += gadhe.length;
  if (!soochiMili) binaSoochi++;
  if (girGaya) girGaye++;

  if (khaaliJawab) {
    khaali++;
    console.log(`  ⬛ ${n} JAWAB KHAALI (${dhale.length} ansh bheje the) — ${q.slice(0, 46)}`);
  } else if (granth.length) {
    aadhaarAaya++;
    const chinh = isControl ? "❌" : "📚";
    console.log(`  ${chinh} ${n} Aadhaar: ${granth.join(" · ")}`);
    console.log(`      ${q.slice(0, 62)}`);
  } else {
    chup++;
    console.log(`  🔇 ${n} chup (Aadhaar khaali) — ${q.slice(0, 50)}`);
  }
  if (gadhe.length) console.log(`      ⚠️ model ne gadha: ${gadhe.join(" · ")}`);
  if (DIKHAO) console.log(`\n${text.split("\n").map(l => "      " + l).join("\n")}\n`);

  byora.push({ q, aadhaar: granth, gadhe, soochiMili, girGaya, khaaliJawab, bheje: dhale.length, jawab: text });
  await so(400);
}

// ── saar ──────────────────────────────────────────────────────────────
const kul = byora.length;
console.log(`\n${"═".repeat(74)}`);
console.log(`  ${kul} sawaal chale` + (gadbad ? `  (${gadbad} gadbad)` : ""));
console.log(`  CHUP RAHA        : ${chup}/${kul}`);
// ⚠️ KHAALI JAWAB ALAG SE — ye "chup rehna" NAHI hai. Chup rehna ek faisla
// hai (daayre se bahar, ya koi ansh nahi mila). Khaali jawab ek KHARABI
// hai: hamne ansh dhoondhe, model ko bheje, aur user ko kuch nahi mila.
console.log(`  JAWAB KHAALI AAYA: ${khaali}/${kul}` + (khaali ? "   ⚠️ ye alag rog hai — model ne token 'sochne' me kharch kiye" : ""));
console.log(`  AADHAAR AAYA     : ${aadhaarAaya}/${kul}` + (isControl ? (aadhaarAaya ? "   ⚠️ ZERO HONI CHAHIYE" : "   ✅") : ""));
console.log(`  model ne gadhe naam likhe : ${kulGadhe}   ← mel ne roka`);
console.log(`  model ne soochi hi nahi di : ${binaSoochi}`);
console.log(`  purane vyavhaar par gire   : ${girGaye}   ← saare granth dikhe`);

// ⚠️ Ye tulna hi is script ka poora matlab hai.
if (isControl) {
  console.log(`\n  ⚠️ ISE 14_eval_search --set ${SET} SE MILAYEIN.`);
  console.log(`     Wo RETRIEVAL ginti hai (kaunse granth laute), ye CITATION`);
  console.log(`     (user ko kya dikha). Dono ke ank ALAG honge — aur faisla`);
  console.log(`     hamesha ISI par lena hai.`);
}

writeFileSync(join(ROOT, `citation-${SET}.json`), JSON.stringify(byora, null, 1), "utf8");
console.log(`\n  poora byora: citation-${SET}.json\n`);
