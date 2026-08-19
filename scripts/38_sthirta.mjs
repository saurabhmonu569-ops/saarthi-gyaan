/**
 * SAARTHI — WAHI SAWAAL, ALAG JAWAB: SROT KAHAN HAI?      2026-08-19
 * =====================================================================
 * 18 Agast ko naapa gaya: `/search` ko BILKUL WAHI body do baar bhejne par
 * ausat 29% ansh alag aate hain — ek sawaal par 100%. Yaani ek user wahi
 * sawaal dobara poochhe to alag granth mil sakta hai.
 *
 * Us din ye ANK to mila, par SROT nahi. Aur srot jaane bina koi ilaaj
 * nahi ho sakta, kyunki teen bilkul alag jagah ho sakti hai:
 *
 *   A. VECTORIZE (ANN) — uska search anumanit hai. Har baar pool me thode
 *      alag ansh aa sakte hain. Tab rog DHOONDHNE me hai.
 *
 *   B. RERANK — wahi ansh ko har baar alag ank mile. 33_rerank_swabhav.mjs
 *      ne is par pehle hi mana kar diya tha (ank chaaron dashamlav tak
 *      sthir the), par wo EK sawaal par tha. Yahan dobara jaanchenge.
 *
 *   C. GATE — pool aur ank dono sthir hon, par paas hone wale ansh badlein.
 *      Ye tabhi hoga jab kai ansh gate (0.30) ke bilkul aas-paas hon.
 *
 * ⚠️ EK CHAUTHI SAMBHAVNA BHI HAI, AUR WO SABSE CHUPI HUI HAI:
 *   D. RERANK BATCH KA TIMEOUT — rerankAll har batch ko 4 second deta hai.
 *      Jo batch atak gaya, uske SAARE 20 ansh ko ank 0 milta hai aur wo
 *      chup-chaap gir jaate hain. `stats.skipped` ye ginti rakhta hai, par
 *      aaj tak kisi naap ne use dekha hi nahi. Ye "ANN ka shor" jaisa
 *      dikhta hai par hai bilkul alag cheez.
 *
 * YE SCRIPT CHAARON KO ALAG KARTI HAI — ek hi sawaal N baar, aur har baar:
 *   pool ke ansh ki soochi · har ansh ka ank · paas hue ansh · skipped
 *
 * /chat par ek bhi call nahi jaati — AI ka kota kharch nahi hota.
 *
 * CHALAO:
 *   node scripts/38_sthirta.mjs
 *   node scripts/38_sthirta.mjs --baar 7
 *   node scripts/38_sthirta.mjs --sawaal "गीता में कर्म योग क्या है?"
 */

import { khojo, so } from "./lib/pipeline.mjs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BAAR = parseInt(arg("baar", "5"), 10) || 5;
const EK = arg("sawaal", null);

// Jaan-boojhkar wo sawaal jinpar 18 Agast ko sabse zyada shor mila tha,
// aur do sthir wale — taaki farak dikhe.
const SAWAAL = EK ? [EK] : [
  "महाभारत में धर्म क्या है",          // us din 100% alag
  "रामचरितमानस में भक्ति के बारे में क्या कहा है?",  // 76%
  "Yoga Sutra me kleshas kitne hain",   // 67%
  "गीता में कर्म योग क्या है?",         // 0% — sthir tha
  "पति पत्नी में झगड़ा हो तो क्या करें", // 0%
];

const jodo = (a) => a.slice().sort().join(",");
const pct = (x) => `${(x * 100).toFixed(0)}%`;

/** Do soochiyon me kitna saajha — 1 = bilkul ek. */
function saajha(a, b) {
  if (!a.length && !b.length) return 1;
  const A = new Set(a), B = new Set(b);
  let mila = 0;
  for (const x of A) if (B.has(x)) mila++;
  return mila / new Set([...a, ...b]).size;
}

console.log(`\nSTHIRTA — har sawaal ${BAAR} baar (sirf /search, koi /chat nahi)`);
console.log("═".repeat(78));

const saar = [];

for (const q of SAWAAL) {
  const daur = [];
  for (let i = 0; i < BAAR; i++) {
    try {
      const { chunks, stats } = await khojo(q, { debug: true });
      const pool = stats?.poolScores || [];
      daur.push({
        poolIds: pool.map(c => c.id),
        ank: Object.fromEntries(pool.map(c => [c.id, c.rerank])),
        laute: chunks.map(c => c.id),
        granth: [...new Set(chunks.map(c => c.book))],
        skipped: stats?.skipped ?? 0,
        best: stats?.best ?? null,
      });
    } catch (e) {
      console.log(`  ⚠️ ${q.slice(0, 40)} — ${e.message}`);
    }
    await so(500);
  }
  if (daur.length < 2) continue;

  // ── A: POOL sthir hai? ────────────────────────────────────────────
  const poolEkJaisa = daur.every(d => jodo(d.poolIds) === jodo(daur[0].poolIds));
  const poolSaajha = daur.slice(1).reduce((m, d) => Math.min(m, saajha(daur[0].poolIds, d.poolIds)), 1);

  // ── B: WAHI ansh ko WAHI ank mila? ────────────────────────────────
  // Sirf un ansho par jo HAR daur ke pool me the — warna "alag ank" aur
  // "ansh hi nahi tha" ghul-mil jaate hain.
  const sabMe = daur[0].poolIds.filter(id => daur.every(d => id in d.ank));
  let ankBadla = 0, sabseBadaAntar = 0;
  for (const id of sabMe) {
    const v = daur.map(d => d.ank[id]);
    const antar = Math.max(...v) - Math.min(...v);
    if (antar > 0.0001) ankBadla++;
    sabseBadaAntar = Math.max(sabseBadaAntar, antar);
  }

  // ── C: LAUTE hue ansh sthir hain? ─────────────────────────────────
  const lauteEkJaise = daur.every(d => jodo(d.laute) === jodo(daur[0].laute));
  const lauteSaajha = daur.slice(1).reduce((m, d) => Math.min(m, saajha(daur[0].laute, d.laute)), 1);

  // ── D: rerank batch chhoote? ──────────────────────────────────────
  const skipped = daur.map(d => d.skipped);
  const kuchChhoota = skipped.some(s => s > 0);

  console.log(`\n${q}`);
  console.log(`  A. POOL      : ${poolEkJaisa ? "sthir ✅" : `BADALTA ⚠️  (kam se kam ${pct(poolSaajha)} saajha)`}`);
  console.log(`  B. ANK       : ${sabMe.length} ansh sab daur me the · ${ankBadla ? `${ankBadla} ka ank BADLA ⚠️ (sabse bada antar ${sabseBadaAntar.toFixed(4)})` : "sabke ank BILKUL wahi ✅"}`);
  console.log(`  C. JAWAB     : ${lauteEkJaise ? "sthir ✅" : `BADALTA ⚠️  (kam se kam ${pct(lauteSaajha)} saajha)`}`);
  console.log(`  D. rerank batch chhoote : ${skipped.join(", ")}${kuchChhoota ? "  ⚠️" : "  ✅"}`);
  console.log(`     ansh laute: ${daur.map(d => d.laute.length).join(", ")} · best: ${daur.map(d => d.best).join(", ")}`);
  console.log(`     granth    : ${daur.map(d => d.granth.length).join(", ")} alag-alag daur me`);

  saar.push({ q, poolEkJaisa, ankBadla, lauteEkJaise, kuchChhoota });
}

// ── FAISLA ────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(78));
const poolHile   = saar.filter(s => !s.poolEkJaisa).length;
const ankHile    = saar.filter(s => s.ankBadla > 0).length;
const jawabHile  = saar.filter(s => !s.lauteEkJaise).length;
const batchChhoote = saar.filter(s => s.kuchChhoota).length;

console.log(`  ${saar.length} sawaal me se —`);
console.log(`    pool badla        : ${poolHile}`);
console.log(`    ank badle         : ${ankHile}`);
console.log(`    jawab badla       : ${jawabHile}`);
console.log(`    rerank batch chhoote: ${batchChhoote}`);

// ⚠️ Ye faisla hi is script ka poora matlab hai. Ilaaj teeno ka ALAG hai,
// aur galat jagah ilaaj karne me 18 Agast ka poora din gaya tha.
console.log("");
if (!jawabHile) {
  console.log(`  🟢 Sab sthir hai. Ya to #42 theek ho chuka, ya wo sirf kuch`);
  console.log(`     khaas sawaalon par hai — aur set badalkar dobara dekhna hoga.`);
} else if (batchChhoote) {
  console.log(`  🔴 SROT: RERANK BATCH KA TIMEOUT (4s). Jo batch atka, uske 20`);
  console.log(`     ansh ko ank 0 mila aur wo chup-chaap gir gaye. Ye "ANN ka`);
  console.log(`     shor" jaisa dikhta hai par hai bilkul alag — aur iska ilaaj`);
  console.log(`     seedha hai: RERANK_TIMEOUT_MS badhao ya batch chhote karo.`);
} else if (poolHile) {
  console.log(`  🔴 SROT: VECTORIZE (ANN). Pool hi har baar alag ban raha hai.`);
  console.log(`     Rerank aur gate bekasoor hain. Ilaaj dhoondhne ke kadam me`);
  console.log(`     hai — topK badhao, ya cosine se pehle ek sthir chhanni.`);
} else if (ankHile) {
  console.log(`  🔴 SROT: RERANK khud. Wahi ansh, wahi pool, phir bhi alag ank.`);
  console.log(`     33_rerank_swabhav.mjs ne EK sawaal par ise sthir paaya tha —`);
  console.log(`     yaani wo naap adhoori thi.`);
} else {
  console.log(`  🔴 SROT: GATE. Pool sthir, ank sthir, phir bhi jawab badalta —`);
  console.log(`     matlab kai ansh 0.30 ke bilkul aas-paas hain aur zara sa`);
  console.log(`     fer-badal unhe aar-paar dhakel deta hai.`);
}
