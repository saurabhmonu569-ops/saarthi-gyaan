/**
 * SAARTHI — reranker ne kis ansh ko kya score diya? (2026-08-10)
 * =====================================================================
 * KYUN YE BANA:
 * "Bharat ji jab Ram ko wapas lane van gaye…" par naapa gaya —
 *     pool mein ramcharitmanas ke 40 ansh aaye
 *     gate (0.30) EK ne bhi paar nahi kiya
 *     jawab Mahabharat se juda
 *
 * Yahan tak sab dikhta hai. Par AAGE andhera hai: un 40 mein se sahi ansh
 * tha bhi ya nahi? Agar tha, to usse kya score mila — 0.28 (baal-baal
 * chooka) ya 0.02 (reranker ne pehchana hi nahi)? Ye do bilkul alag
 * bimariyan hain:
 *     0.28 → gate ka masla, threshold dekho
 *     0.02 → reranker Awadhi/chhand ko nahi samajh raha, chunking dekho
 * Bina naap ke inme se kisi bhi ek par kaam karna tukka hai.
 *
 * YE SCRIPT: local JSON se chune hue ansh uthata hai, unhe Workers AI ke
 * reranker par bhejta hai (wahi model jo /search mein chalta hai), aur
 * score dikhata hai. Netlify ka koi build nahi, worker deploy nahi.
 *
 * CHALAO:
 *   node scripts/13_probe_rerank.mjs --q "भरत जी जब राम को वापस लाने वन गये तो उनकी राम से क्या बात हुई" --book ramcharitmanas --has भरत
 *   node scripts/13_probe_rerank.mjs --q "..." --book mahabharata --has भरत --n 10
 *
 * --q     sawaal (wahi jo rerankQ banta hai — Devanagari mein)
 * --book  kis granth ke ansh dekhne hain
 * --has   ansh mein ye shabd hona chahiye (baar-baar de sakte hain)
 * --n     kitne ansh (default 12)
 * --page  panne ki seema, jaise --page 4090-4120 (jab jagah pata ho)
 *
 * Ansh SAWAAL ke shabdon se chunte hain, kitaab ke kram se nahi — kyun,
 * ye neeche "CHUNAAV" wali tippani mein likha hai.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const MODEL = "@cf/baai/bge-reranker-base";

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}
function argAll(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === `--${name}`) out.push(process.argv[i + 1]); });
  return out;
}

function loadEnv() {
  const out = { ...process.env };
  const p = join(ROOT, ".env");
  if (existsSync(p)) for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const ACC = (env.CF_ACCOUNT_ID || "").trim();
const TOK = (env.CF_API_TOKEN  || "").trim();
if (!ACC || !TOK) {
  console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye.");
  process.exit(1);
}

const query = arg("q");
const book  = arg("book");
const has   = argAll("has");
const N     = parseInt(arg("n", "12"), 10);

/**
 * --vs "<doosri query>"  — EK HI ansh par DO query ka score naapo.
 *
 * KYUN: stripMetaFraming "क्रोध को नियंत्रित करने के लिए शास्त्र क्या कहते
 * hain?" ko "क्रोध को नियंत्रित करने के लिए?" bana deta hai — ek adhoora
 * tukda. Us par 0.0331 mila. Sawaal ye hai ki kaunsi shakl behtar hai:
 * adhoora tukda, mool sawaal, ya koi teesri shakl?
 *
 * Ise andaaze se tay karna aasan hai aur galat bhi. Yahan DONO query ko
 * WAHI ansh diye jaate hain, isliye tulna imaandaar hai.
 *
 * ⚠️ Ek zaroori baat: dono query ALAG call me jaati hain, isliye batch
 * bhi alag hota hai. Aur aaj hi pata chala ki rerank ka score batch-sapeksh
 * hai. Par yahan ansh WAHI hain aur kram bhi wahi — sirf query badalti hai.
 * Isliye tulna theek hai.
 */
const vsQuery = arg("vs");

if (!query || !book) {
  console.log("Istemal:");
  console.log('  node scripts/13_probe_rerank.mjs --q "<sawaal>" --book <granth> [--has <shabd>] [--n 12]');
  process.exit(0);
}

const file = join(BOOKS, `${book}.json`);
if (!existsSync(file)) {
  console.error(`❌ ${book}.json nahi mili. Maujood granth:`);
  console.error("   " + readFileSync(join(ROOT, "public", "knowledge", "meta.json"), "utf8")
    .match(/"books":\s*\[([^\]]*)\]/s)?.[1].replace(/["\s]/g, "").split(",").join(", "));
  process.exit(1);
}

// SUCHI/TABLE hata do — wo kabhi jawab nahi dete, aur is naap mein sirf
// dhyan batatate hain. (Yahi jaanch worker ke hasSentences se milti-julti
// hai, par yahan hum saaf-saaf dekhna chahte hain ki ASLI PAATH ko kya
// score mila.)
const isToc = t => /[.·]{4,}/.test(t) || /पृष्ठ-?संख्या|विषय-?सूची|अनुक्रम/.test(t)
  || ((t.match(/[०-९]/g) || []).length / Math.max(t.length, 1)) > 0.06;

const all = JSON.parse(readFileSync(file, "utf8")).chunks || [];

// ⚠️ CHUNAAV — pehla version yahan `.slice(0, N)` karta tha, yaani kitaab ke
// SHURU ke N ansh. Mahabharata mein 25,856 ansh hain; uske pehle ansh Adi
// Parva ki vanshavali hain, jahan "भरत" Dushyant ka beta hai — Ram ka bhai
// nahi. Us naap ne 0.058 dikhaya aur maine galat nateeja nikal liya.
// Asli jawab p.4103 (Ramopakhyana) mein tha, jahan tak filter pahuncha hi
// nahi. Ye script galat jagah dekh rahi thi, aur mujhe pata bhi nahi chala.
//
// Ab chunaav SAWAAL ke shabdon se hota hai — jitne alag shabd milte hain
// utna upar. Ye bilkul wahi kaam hai jo D1 ka FTS/bm25 karta hai, isliye
// jo ansh yahan chunte hain wo asli pool ke kareeb hote hain.
const STOP = new Set("का के की को कि में से और पर यह जो है ने भी एक था थी थे क्या कब कैसे कौन कहाँ क्यों तो हुई हुआ".split(" "));
const qWords = [...new Set((query.match(/[ऀ-ॿ]{2,}/g) || []).filter(w => !STOP.has(w)))];

const pageArg = arg("page");
let [pLo, pHi] = [-Infinity, Infinity];
if (pageArg) {
  const m = pageArg.split("-").map(Number);
  pLo = m[0]; pHi = m.length > 1 ? m[1] : m[0];
}

const cand = all
  .filter(c => {
    const t = (c.text || "").trim();
    if (t.length < 300 || isToc(t)) return false;
    if (c.page != null && (c.page < pLo || c.page > pHi)) return false;
    return has.every(w => t.includes(w));
  })
  .map(c => {
    const t = c.text;
    // kitne ALAG sawaal-shabd mile (ginti nahi, vividhta) + halki density
    const hit = qWords.filter(w => t.includes(w)).length;
    return { c, hit, dens: hit / Math.sqrt(t.length) };
  })
  .filter(x => x.hit > 0)
  .sort((a, b) => (b.hit - a.hit) || (b.dens - a.dens))
  .slice(0, N)
  .map(x => x.c);

if (!cand.length) {
  console.error(`❌ ${book} mein aise ansh nahi mile (shabd: ${has.join(", ") || "koi nahi"})`);
  process.exit(1);
}

console.log(`\nsawaal : ${query}`);
console.log(`granth : ${book}  —  ${cand.length} ansh naap rahe hain\n`);

const api = `https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${MODEL}`;

async function rerank(q) {
  const res = await fetch(api, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: q,
      // 1200 — wahi seema jo ChatView/worker rerank se pehle lagate hain
      contexts: cand.map(c => ({ text: c.text.slice(0, 1200) })),
      top_k: cand.length,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.success === false) {
    console.error("❌ Workers AI ne mana kiya:");
    console.error(JSON.stringify(j?.errors || j).slice(0, 400));
    console.error("\n   Token mein 'Workers AI → Read' ki anumati honi chahiye.");
    process.exit(1);
  }
  const list = j?.result?.response || j?.result || [];
  const out = new Array(cand.length).fill(0);
  for (const it of list) {
    const i = it?.id ?? it?.index, v = it?.score ?? it?.relevance_score;
    if (Number.isInteger(i) && i >= 0 && i < out.length) out[i] = v;
  }
  return out;
}

const scores = await rerank(query);
const scoresB = vsQuery ? await rerank(vsQuery) : null;

const GATE = 0.30;   // wahi gate jo worker mein hai (SEARCH_MIN_RERANK)
const rows = cand.map((c, i) => ({ page: c.page, s: scores[i], b: scoresB ? scoresB[i] : null, t: c.text }))
  .sort((a, b) => Math.max(b.s, b.b ?? 0) - Math.max(a.s, a.b ?? 0));

if (scoresB) {
  console.log(`  A = "${query}"`);
  console.log(`  B = "${vsQuery}"\n`);
  console.log("     A       B      farak   panna");
  for (const r of rows) {
    const d = r.b - r.s;
    const arrow = d > 0.05 ? "B behtar" : d < -0.05 ? "A behtar" : "barabar";
    console.log(`  ${r.s.toFixed(4)}  ${r.b.toFixed(4)}  ${(d >= 0 ? "+" : "") + d.toFixed(4)}  p.${String(r.page).padEnd(6)} ${arrow}`);
  }
  const bestA = Math.max(...scores), bestB = Math.max(...scoresB);
  const paasA = scores.filter(x => x >= GATE).length, paasB = scoresB.filter(x => x >= GATE).length;
  console.log(`\n  A: sabse ooncha ${bestA.toFixed(4)}, gate paar ${paasA}/${rows.length}`);
  console.log(`  B: sabse ooncha ${bestB.toFixed(4)}, gate paar ${paasB}/${rows.length}`);
  console.log(`\n  → ${bestB > bestA ? "B" : bestA > bestB ? "A" : "dono barabar"} behtar hai`
    + (Math.abs(bestB - bestA) > 0.05 ? `  (${Math.abs(bestB - bestA).toFixed(3)} ka farak)` : "  (farak mamooli)"));
  process.exit(0);
}

for (const r of rows) {
  const mark = r.s >= GATE ? "✅" : "❌";
  console.log(`${mark} ${r.s.toFixed(4)}  p.${String(r.page).padEnd(6)} ${r.t.replace(/\s+/g, " ").slice(0, 95)}`);
}

const paas = rows.filter(r => r.s >= GATE).length;
const best = rows[0]?.s ?? 0;
console.log(`\n${paas}/${rows.length} ne gate (${GATE}) paar kiya  ·  sabse ooncha ${best.toFixed(4)}`);

if (best >= GATE) {
  console.log("\n→ Sahi ansh ko ACCHA score mil raha hai. Matlab gadbad DHOONDHNE");
  console.log("  mein hai (ye ansh pool tak pahunch hi nahi rahe), aankne mein nahi.");
} else if (best >= 0.15) {
  console.log(`\n→ Sahi ansh ko ${best.toFixed(3)} mila — gate se neeche par shor se ooncha.`);
  console.log("  Ye GATE ka masla hai. Par threshold girane se pehle control sawaal");
  console.log("  dobara naapo (jhoothi citation 0 rehni chahiye).");
} else {
  console.log(`\n→ Sahi ansh ko sirf ${best.toFixed(3)} mila. Reranker is granth ki bhasha`);
  console.log("  ko pehchan hi nahi raha. Sawaal ki SHAKL bhi dekho — adhoora tukda");
  console.log("  (jaise '...ke liye?') cross-encoder ko bilkul bekaar lagta hai.");
}
