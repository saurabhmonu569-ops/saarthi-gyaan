/**
 * SAARTHI — rerank ka score ABSOLUTE hai ya BATCH-SAPEKSH?   2026-08-18
 * =====================================================================
 * YE SCRIPT EK MAANYATA JAANCHTI HAI JISPAR POORA RETRIEVAL TIKA HAI.
 *
 * Worker aisa karta hai (rerankAll → cloudflare-worker.js):
 *     pool 85 ansh  →  20-20 ke 5 ALAG BATCH
 *                   →  har batch ALAG call me score hota hai
 *                   →  phir SAB ek hi gate (0.30) par tole jaate hain
 *
 * Ye tabhi sahi hai jab score ABSOLUTE ho — yaani "0.42" ka matlab har
 * batch me ek hi ho. Agar score batch ke ANDAR sapeksh hai (batch me sabse
 * achha kaun), to alag batch ke score aapas me tulnaneey hain hi nahi, aur
 * ek hi gate un par lagana galat hai.
 *
 * ⚠️ AGAR YE SAPEKSH NIKLA TO CHAAR ALAG SHIKAYATEN EK HI ROG NIKLENGI:
 *
 *   #21 — "score batch-sapeksh hai" (shak, abhi tak sabit nahi)
 *   #42 — WAHI sawaal do baar, 29% alag ansh (ek par 100%).
 *         Wajah saaf ho jaayegi: Vectorize ka ANN anumanit hai → pool ka
 *         KRAM har baar thoda badalta hai → ansh ALAG BATCH me girta hai
 *         → uska score badalta hai → gate alag ansh paas karta hai.
 *   #2/#20 — sahi ansh gir jaata hai, galat granth upar aa jaata hai.
 *         Makar Rashi: sahi ansh cosine par #1 (0.6184) par rerank 0.1238;
 *         nau GALAT-rashi ansh 0.61-0.99 par paas.
 *   #25 — (aaj) 19/29 sawaalon me sahi granth ke ansh POOL ME THE, phir
 *         bhi best score kabhi 0.30 tak nahi pahuncha.
 *
 * ⚠️ AUR AGAR YE ABSOLUTE NIKLA — to ye poora anumaan GALAT hai aur
 * #42/#2/#20 ki wajah kahin aur hai. Isliye ye script pehle chalti hai,
 * koi ilaaj likhne se PEHLE. Aaj do baar aisa ho chuka hai ki ilaaj pehle
 * soch liya aur naap ne baad me mana kar diya.
 *
 * ── TEEN PRAYOG ──────────────────────────────────────────────────────
 *
 *  1. KRAM  — wahi 20 ansh, sirf kram badal kar. Score ansh ke saath
 *             chalna chahiye, jagah ke saath nahi.
 *  2. SAATH — wahi ek ansh, par alag SAATHIYON ke beech: (a) 19 bilkul
 *             asambandhit ansh, (b) 19 usi vishay ke ansh. Absolute score
 *             dono me ek jaisa aana chahiye.
 *  3. BATCH KA AAKAR — wahi ansh akela (n=1), n=5, n=20 me. Absolute score
 *             aakar se nahi badalna chahiye.
 *
 * CHALAO:
 *   node scripts/33_rerank_swabhav.mjs
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
  const j = await r.json();
  if (!Array.isArray(j.scores)) throw new Error("scores nahi aaye: " + JSON.stringify(j).slice(0, 160));
  return j.scores;
}

// ── ansh utháo — seedhe data/chunks se, D1 ki zarurat nahi ────────────
function anshLo(book, kitne, chhaano = null) {
  const dir = join(ROOT, "data", "chunks", book);
  const files = readdirSync(dir).filter(f => f.startsWith("chunk_")).sort();
  const out = [];
  for (const f of files) {
    let d; try { d = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { continue; }
    const t = (d.text || "").replace(/\s+/g, " ").trim();
    // chhote/tootey ansh chhod do — wahi `hasSentences` bhi karta hai
    if (t.length < 220) continue;
    if (chhaano && !chhaano.test(t)) continue;
    out.push(t.slice(0, 1200));            // RERANK_MAX_CHARS jitna
    if (out.length >= kitne) break;
  }
  return out;
}

const SAWAAL = "वैराग्य और विषाद में क्या भेद है";

// LAKSHYA — usi vishay ka ansh (Yoga Vasishtha me vairagya ka prakaran)
const lakshyaSab = anshLo("yoga_vasishtha", 1, /वैराग्य/);
if (!lakshyaSab.length) { console.error("❌ vairagya wala ansh nahi mila."); process.exit(1); }
const LAKSHYA = lakshyaSab[0];

// SAATHI (a) — bilkul alag vishay: jyotish ke upay
const doorKe = anshLo("lal_kitab", 19);
// SAATHI (b) — usi vishay ke aur ansh
const paasKe = anshLo("yoga_vasishtha", 19, /वैराग्य|विरक्ति|संसार/);

if (doorKe.length < 19 || paasKe.length < 19) {
  console.error(`❌ kaafi ansh nahi mile (door ${doorKe.length}, paas ${paasKe.length})`);
  process.exit(1);
}

const f = (x) => x.toFixed(4);
console.log(`\nRERANK KA SWABHAV — sawaal: "${SAWAAL}"`);
console.log("═".repeat(74));

// ── 1. KRAM ───────────────────────────────────────────────────────────
{
  const set = [LAKSHYA, ...doorKe];
  const seedha = await score(SAWAAL, set);            await so(400);
  const ulta   = await score(SAWAAL, [...set].reverse()); await so(400);

  // ulta[] ko wapas seedhe kram me lao, taaki ansh-dar-ansh tulna ho
  const ultaWapas = [...ulta].reverse();
  const farak = set.map((_, i) => Math.abs(seedha[i] - ultaWapas[i]));
  const sabseBada = Math.max(...farak);

  console.log(`\n1️⃣  KRAM — wahi 20 ansh, kram ulta`);
  console.log(`   lakshya ansh:  seedhe kram me ${f(seedha[0])}   ulte kram me ${f(ultaWapas[0])}`);
  console.log(`   sabse bada farak (kisi bhi ansh par): ${f(sabseBada)}`);
  console.log(sabseBada < 0.01
    ? `   ✅ score ANSH ke saath chalta hai, jagah se nahi.`
    : `   ⚠️ score JAGAH ke saath badal raha hai — ye apne aap me bug hai.`);
}

// ── 2. SAATH ──────────────────────────────────────────────────────────
let s2a, s2b;
{
  s2a = (await score(SAWAAL, [LAKSHYA, ...doorKe]))[0]; await so(400);
  s2b = (await score(SAWAAL, [LAKSHYA, ...paasKe]))[0]; await so(400);

  console.log(`\n2️⃣  SAATH — WAHI ek ansh, alag saathiyon ke beech`);
  console.log(`   19 ASAMBANDHIT ansh ke saath (Lal Kitab)  : ${f(s2a)}`);
  console.log(`   19 USI VISHAY ke ansh ke saath            : ${f(s2b)}`);
  console.log(`   farak: ${f(Math.abs(s2a - s2b))}`);
}

// ── 3. BATCH KA AAKAR ─────────────────────────────────────────────────
const aakar = {};
for (const n of [1, 3, 5, 10, 20]) {
  aakar[n] = (await score(SAWAAL, [LAKSHYA, ...doorKe.slice(0, n - 1)]))[0];
  await so(400);
}
console.log(`\n3️⃣  BATCH KA AAKAR — wahi ansh, batch chhota se bada`);
for (const n of [1, 3, 5, 10, 20]) console.log(`   n=${String(n).padStart(2)}  →  ${f(aakar[n])}`);

// ── FAISLA ────────────────────────────────────────────────────────────
const saathFarak = Math.abs(s2a - s2b);
const aakarFarak = Math.max(...Object.values(aakar)) - Math.min(...Object.values(aakar));

console.log("\n" + "═".repeat(74));
console.log(`saath badalne se farak : ${f(saathFarak)}`);
console.log(`aakar badalne se farak : ${f(aakarFarak)}`);

// ⚠️ Seema 0.05 jaan-boojhkar dhili hai. Gate 0.30 par hai; 0.05 ka farak
// bhi gate ke aar-paar dhakel sakta hai, par usse chhota farak model ka
// apna shor ho sakta hai. Faisla is se BADE farak par hi liya jaayega.
if (saathFarak > 0.05 || aakarFarak > 0.05) {
  console.log(`\n🔴 SCORE BATCH-SAPEKSH HAI — #21 SABIT.`);
  console.log(`   Worker pool ko 20-20 ke 5 batch me alag-alag score karta hai`);
  console.log(`   aur phir sabko EK gate (0.30) par tolta hai. Wo galat hai:`);
  console.log(`   alag batch ke score aapas me tulnaneey hain hi nahi.`);
  console.log(`   Yahi #42 (29% asthirta), #2 aur #20 ki bhi wajah ho sakti hai —`);
  console.log(`   pool ka kram badalte hi ansh ka batch badalta hai.`);
} else {
  console.log(`\n🟢 SCORE ABSOLUTE LAGTA HAI — #21 ka anumaan GALAT.`);
  console.log(`   Batch me todna nuksaandeh nahi hai. #42/#2/#20 ki wajah`);
  console.log(`   kahin aur hai — usi disha me dobara dekhna hoga.`);
}
