/**
 * SAARTHI — Ask section ka scorecard (2026-08-06)
 * =====================================================================
 * KYUN: ab tak "kabhi-kabhi galat aata hai" ek EHSAAS tha, number nahi.
 * Bina number ke na ye pata chalta hai ki kitna kharab hai, na ye ki
 * koi badlaav sach mein sudhaar laaya ya sirf alag tarah se toota.
 *
 * YE KYA NAAPTA HAI — do cheezein, dono zaroori:
 *
 *   1. RECALL  — jab jawab kitaabon mein HAI, kya humne use dhoondha?
 *      (30 sawaal, har ek ke saath wo shabd jo sahi ansh mein hone hi
 *       chahiye — ye shabd corpus se pehle hi verify kiye gaye hain)
 *
 *   2. SURAKSHA — jab jawab kitaabon mein NAHI hai, kya humne chup rehne
 *      ka faisla kiya? (6 control sawaal — inka sahi natija "kuch nahi
 *      mila" hai. Yahan koi bhi citation JHOOTHI citation hai.)
 *
 * DAAYRA (2026-08-07 se POORA): pehle ye sirf SEMANTIC + RERANK naapta
 * tha — yaani ChatView ke 85 ummeedwaaron mein se 45. Isliye score app ka
 * aadha hissa dikhata tha (298 sawaal par 55%, jabki app usse behtar
 * karti hai). Ab keyword search, cross-book search aur detectHintedBook
 * bhi chalte hain — aur wo bhi engine.js ka ASLI code, dobara likha hua
 * nahi (upar fetch-shim dekho).
 *
 * CHALAO:
 *   node scripts/eval-ask.mjs --300              # 298 sawaal, POORA raasta
 *   node scripts/eval-ask.mjs --300 --both       # aadha vs poora, tulna
 *   node scripts/eval-ask.mjs --300 --paryay     # purana vs paryay (aadha)
 *   node scripts/eval-ask.mjs --hinglish         # Hinglish 100
 *   node scripts/eval-ask.mjs                    # Hindi 100, poora
 *
 * Sawaal scripts/eval-questions.json mein hain — nayi sawaal jodne ke liye
 * bas wahi file badlein, ye script chhune ki zaroorat nahi.
 *
 * .env mein CF_ACCOUNT_ID aur CF_API_TOKEN chahiye.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toDevanagari, expandQueryWithParyay, stripMetaFraming, isOutOfScope } from "../src/knowledge/translit.js";
import { detectHintedBook } from "../src/knowledge/bookHints.js";

// ── ENGINE KA ASLI CODE, DOBARA LIKHE BINA (2026-08-07) ──────────────
//
// Pehle ye script sirf SEMANTIC + RERANK naapti thi. Asli app teen aur
// cheezein chalati hai — keyword search, cross-book search, aur
// detectHintedBook — jo 85 ummeedwaaron mein se 40 dete hain. Un teenon
// ke bina 55% ka number app ka aadha hissa naap raha tha.
//
// Unhe yahan DOBARA LIKHNA sabse aasan tha, par sabse kharab bhi: do
// copies hamesha alag ho jaati hain, aur phir eval jhooth bolne lagta
// hai. Isliye engine.js ka ASLI code hi chalate hain.
//
// Ek hi rukawat thi — engine.js browser ke liye bana hai aur `fetch` se
// /knowledge/... uthata hai. Toh yahan fetch par ek patli parat chadha
// dete hain: /knowledge/ waale raaste disk se padho, baaki (Cloudflare
// API) asli fetch ko de do. engine.js ko pata bhi nahi chalta.
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const _realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith("/knowledge/")) {
    const p = join(ROOT_DIR, "public", u.replace(/^\//, ""));
    if (!existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
    const txt = readFileSync(p, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(txt) };
  }
  return _realFetch(url, opts);
};

const { loadKnowledge, hybridSearch, crossBookSearch, getChunk, getBookChunks }
  = await import("../src/knowledge/engine.js");

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB   = join(ROOT, "public", "knowledge", "embeddings");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const DIM = 1024, ROW = 1028;
const MIN_RERANK = 0.30;         // ChatView.jsx ka MIN_RERANK_SCORE (2026-08-10: 0.5 se ghataya)
const MAX_FRAG   = 0.40;         // ChatView.jsx ka MAX_FRAGMENT_RATIO
const PER_BOOK_CAP = 3;          // ChatView.jsx — ek granth ke max 3 ansh
const KEEP = 12;                 // ChatView.jsx — kul kitne ansh AI ko jaate hain

// Purana vs naya funnel — yahi wo badlaav hai jise naapna hai.
// `paryay`: kya query ke saath granth-shabd jode jaayein (2026-08-07)?
//   dhoondhne mein paryay jodte hain, par RERANK hamesha asli sawaal par —
//   ChatView.jsx mein bilkul yahi antar hai.
// `full: true` = teenon raaste (semantic + keyword + cross-book +
// detectHintedBook) — bilkul ChatView.jsx jaisa. `quota` = SRC_QUOTA.
const CONFIGS = {
  purana: { sem: 12, rerank: 20,  paryay: false, full: false },
  naya:   { sem: 50, rerank: 100, paryay: false, full: false },
  // sirf paryay, purana aadha-harness — tulna ke liye
  adha:   { sem: 50, rerank: 100, paryay: true,  full: false },
  // `paryay: true` ab teen cheezein ek saath karta hai —
  //   1. meta-dhaancha hatana ("शास्त्र क्या कहते हैं", "के अनुसार")
  //   2. angrezi shabd ko UNKI JAGAH par Devanagari ("Forgiveness ka
  //      importance" → "क्षमा का महत्व") — jodna nahi, badalna
  //   3. bolchaal → granth-shabd  ("झगड़ा" ke saath "कलह")
  vistar: { sem: 50, rerank: 100, paryay: true,  full: false },
  // POORA — jo asli app chalati hai
  poora:  { sem: 50, rerank: 100, paryay: true,  full: true, quota: [45, 20, 20] },
};

// ── Sawaal ────────────────────────────────────────────────────────────
// scripts/eval-questions.json se aate hain. `any` = wo shabd jinme se KOI
// EK sahi ansh mein hona chahiye; ye corpus mein pehle se ginkar chune gaye
// hain, isliye fail hona = DHOONDHNE ki galti, kitab mein kami nahi.
const QFILE = JSON.parse(readFileSync(join(ROOT, "scripts", "eval-questions.json"), "utf8"));
const SET  = process.argv.includes("--300")      ? "hinglish_300"
           : process.argv.includes("--hinglish") ? "hinglish_100"
           : "hindi_100";
const ALL  = QFILE[SET];

// META sawaal alag gine jaate hain — "Mahabharat aur Ramayan mein antar"
// ka jawab kisi EK ansh mein ho hi nahi sakta, wo kai anshon ko milakar
// banta hai. Inhe fail maanna score ko JHOOTHA bana dega.
//
// COMPARE ("X aur Y mein kya antar hai") ko maine JAAN-BOOJH KAR main score
// MEIN HI rakha hai — chhipaya nahi. Pichhli baar aise 4 me se 4 fail hue
// the; agar unhe bhi meta bana deta to score sudhar jaata bina kuch theek
// kiye. Wo naapna nahi, naap badalna hota. Bas alag se bhi dikhate hain.
const QUESTIONS = ALL.filter(x => !x.meta);
const META      = ALL.filter(x =>  x.meta);
const COMPARE   = new Set(ALL.filter(x => x.compare).map(x => x.q));
const CONTROL   = QFILE.control.filter(q => !q.startsWith("_"));

// ── setup ─────────────────────────────────────────────────────────────
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
const ACC = (env.CF_ACCOUNT_ID || "").trim(), TOK = (env.CF_API_TOKEN || "").trim();
if (!ACC || !TOK) { console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye"); process.exit(1); }
const api = (m) => `https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${m}`;

console.log("corpus load ho raha…");
const idx = JSON.parse(readFileSync(join(EMB, "chunk_index.json"), "utf8"));
const buf = readFileSync(join(EMB, "vectors_int8.bin"));
const n = idx.count;
const scales = new Float32Array(n), q8 = new Int8Array(n * DIM);
for (let i = 0; i < n; i++) {
  scales[i] = buf.readFloatLE(i * ROW);
  for (let d = 0; d < DIM; d++) q8[i * DIM + d] = buf.readInt8(i * ROW + 4 + d);
}
const TEXT = new Map();
const CORPUS_SHARE = new Map();   // book → corpus ka hissa (0..1)
{
  const cnt = new Map();
  for (const f of readdirSync(BOOKS).filter(x => x.endsWith(".json"))) {
    const b = JSON.parse(readFileSync(join(BOOKS, f), "utf8"));
    const id = f.replace(/\.json$/, "");
    cnt.set(id, (b.chunks || []).length);
    for (const c of (b.chunks || [])) TEXT.set(c.id, (c.text || "").trim());
  }
  const tot = [...cnt.values()].reduce((a, b) => a + b, 0);
  for (const [k, v] of cnt) CORPUS_SHARE.set(k, v / tot);
}
console.log(`  ${n.toLocaleString()} chunks, ${TEXT.size.toLocaleString()} texts`);
// engine.js ka apna knowledge store — keyword aur cross-book iske bina
// nahi chalte. fetch-shim ki wajah se ye disk se load ho jaata hai.
const _kOk = await loadKnowledge();
console.log(`  engine.js knowledge store: ${_kOk ? "load ho gaya ✅" : "FAIL ❌"}\n`);

// ChatView.jsx ke gate — yahan bilkul wahi tark hona chahiye
const hasSentences = (t) => !!String(t || "").trim() &&
  /।|॥|(?:है|हैं|था|थी|थे|हुआ|हुई|होता|होती|करते|करना|चाहिये|चाहिए|गया|गयी|रहता|रहती)(?=[\s।॥,.]|$)/.test(t);
function looksGarbled(t) {
  const w = String(t || "").match(/[ऀ-ॿ]+/g);
  if (!w || w.length < 12) return false;
  return w.filter(x => x.length <= 2).length / w.length > MAX_FRAG;
}

// QUOTA KHATAM HONE PAR TURANT RUKO (2026-08-07)
// Pehle aisa nahi tha: quota khatam hui to script 35 minute tak wahi
// error 298 baar chhapti rahi aur ant mein "0/298" likh diya — jo
// nateeja LAGTA hai par hai nahi. Ab pehli hi quota-error par rukte
// hain, taaki jhootha score kabhi na bane.
function assertQuota(j) {
  const msg = JSON.stringify(j?.errors || j || "");
  if (/free allocation|neurons|quota|rate limit/i.test(msg)) {
    console.error("\n" + "=".repeat(72));
    console.error("  ⛔ CLOUDFLARE KA QUOTA KHATAM — run rok diya");
    console.error("=".repeat(72));
    console.error("  Aaj ke 10,000 free neurons istemal ho chuke hain.");
    console.error("  Ye NATEEJA NAHI hai — aadha run kabhi score mat maano.\n");
    console.error("  Do raaste:");
    console.error("    1. Kal dobara chalayein (quota roz UTC aadhi raat ko reset)");
    console.error("    2. Workers Paid ($5/mah) — uske baad ek poora run ~$0.03\n");
    process.exit(2);
  }
}

async function embed(text) {
  const r = await fetch(api("@cf/baai/bge-m3"), {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [text], truncate_inputs: true }),
  });
  const j = await r.json();
  assertQuota(j);
  const raw = (j?.result?.data || j?.data)?.[0];
  if (!raw) throw new Error("embed fail: " + JSON.stringify(j).slice(0, 200));
  let nm = 0; for (const v of raw) nm += v * v; nm = Math.sqrt(nm) || 1;
  const out = new Float32Array(DIM); for (let d = 0; d < DIM; d++) out[d] = raw[d] / nm;
  return out;
}

/** 20-20 ke parallel batch — semanticSearch.js ke rerankPassages jaisa */
async function rerank(query, texts) {
  const batches = [];
  for (let i = 0; i < texts.length; i += 20) batches.push({ at: i, t: texts.slice(i, i + 20) });
  const res = await Promise.all(batches.map(async ({ at, t }) => {
    try {
      const r = await fetch(api("@cf/baai/bge-reranker-base"), {
        method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, contexts: t.map(text => ({ text: text.slice(0, 1200) })), top_k: t.length }),
      });
      const j = await r.json();
      assertQuota(j);
      const list = j?.result?.response || j?.response;
      if (!Array.isArray(list)) return { at, s: null };
      const s = new Array(t.length).fill(0);
      for (const it of list) {
        const i = it?.id ?? it?.index, v = it?.score ?? it?.relevance_score;
        if (Number.isInteger(i) && i >= 0 && i < s.length && typeof v === "number") s[i] = v;
      }
      return { at, s };
    } catch { return { at, s: null }; }
  }));
  const out = new Array(texts.length).fill(0);
  for (const { at, s } of res) if (s) for (let j = 0; j < s.length; j++) out[at + j] = s[j];
  return out;
}

/** Ek sawaal ka poora raasta — grounded passages lautata hai */
async function run(query, cfg) {
  // ChatView.jsx jaisa hi — daayre se bahar ka sawaal, koi citation nahi
  if (isOutOfScope(query)) { const e = []; e.best = 0; e.pool = 0; e.oos = true; return e; }
  const dev = toDevanagari(query);
  // ChatView.jsx ka wahi teen-query wala tark:
  //   rerankQ = meta-dhaancha hataya   → reranker ko
  //   findQ   = rerankQ + granth-paryay → dhoondhne ko
  const rerankQ = cfg.paryay ? stripMetaFraming(dev) : dev;
  const findQ   = cfg.paryay ? expandQueryWithParyay(rerankQ) : dev;
  const qv = await embed(findQ);
  const sc = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * DIM; let dot = 0;
    for (let d = 0; d < DIM; d++) dot += q8[off + d] * qv[d];
    sc[i] = dot * scales[i] / 127;
  }
  // ── SOURCE-BALANCED MERGE — ChatView.jsx jaisa hi ─────────────────
  // Pehle yahan sirf semantic ke top-N jaate the. Ab teenon raaste, wahi
  // kote ke saath: semantic 45 + keyword 20 + cross-book 20 = ~85.
  const semTop = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => sc[b] - sc[a]).slice(0, cfg.sem)
    .map(i => ({ id: idx.chunks[i].id, book: idx.chunks[i].book,
                 text: TEXT.get(idx.chunks[i].id) || "", score: sc[i] }))
    .filter(c => c.text);

  const byId = new Map();
  const push = (arr, k) => {
    for (const r of [...arr].sort((a, b) => b.score - a.score).slice(0, k)) {
      if (!byId.has(r.id) && r.text) byId.set(r.id, r);
    }
  };
  push(semTop, cfg.quota ? cfg.quota[0] : cfg.sem);

  if (cfg.full) {
    const asRow = (r) => ({ id: r.chunk.id, book: r.chunk.book,
                            text: (r.chunk.text || "").trim(), score: r.score });
    push(hybridSearch(findQ, null, {}, 40).map(asRow), cfg.quota[1]);
    push(crossBookSearch(findQ, null, 3).flatMap(b => b.results).map(asRow), cfg.quota[2]);

    // detectHintedBook — user ne granth ka naam liya ho to usi granth se
    // asli ansh milna GUARANTEE karo (ChatView.jsx step 3.6).
    const hinted = detectHintedBook(query);
    if (hinted) {
      const have = [...byId.values()].filter(r => r.book === hinted).length;
      if (have < 2) {
        push(hybridSearch(findQ, null, { book: hinted }, 6).map(asRow), 6);
        const now = [...byId.values()].filter(r => r.book === hinted).length;
        if (now < 2) {
          const all = (getBookChunks(hinted) || []).filter(c => (c.text || "").trim().length > 120);
          for (const frac of [0.15, 0.5, 0.85]) {
            const c = all[Math.floor(all.length * frac)];
            if (c && !byId.has(c.id)) byId.set(c.id, { id: c.id, book: c.book, text: c.text.trim(), score: 0.05 });
          }
        }
      }
    }
  }

  const top = [...byId.values()].slice(0, cfg.rerank);
  if (!top.length) { const e = []; e.best = 0; e.pool = 0; return e; }
  const scores = await rerank(rerankQ, top.map(c => c.text));

  // DIAGNOSIS (2026-08-07): fail hone par sabse zaroori sawaal ye hai —
  // "koi ansh MILA hi nahi, ya mila par gate ne roka?" Isliye SABSE ACHHA
  // rerank score sambhal kar rakhte hain, chahe wo gate se neeche ho.
  //   best 0.45  → jawab tha, 0.5 ke gate ne roka   → gate ki baat hai
  //   best 0.02  → sach mein kuch tha hi nahi        → corpus ki baat hai
  // Bina is antar ke gate ko chhedna juaa hoga — aur wahi gate aaj tak
  // 0 jhoothi citation de raha hai.
  const scored = top.map((c, i) => ({ ...c, rerank: scores[i] }));
  const usable = scored.filter(c => hasSentences(c.text) && !looksGarbled(c.text));
  const best   = usable.length ? Math.max(...usable.map(c => c.rerank)) : 0;

  const passed = usable
    .filter(c => c.rerank >= MIN_RERANK)
    .sort((a, b) => b.rerank - a.rerank);

  // ChatView.jsx ka DIVERSITY step — pehle ye yahan tha hi nahi, isliye eval
  // sirf JEETNE WALI kitab dikhata tha. Asli app 12 ansh rakhti hai jisme ek
  // kitab ke zyada se zyada 3 — yaani jawab mein kai granth aate hain. Bina
  // is kadam ke ye lagta tha ki "har baar ek hi kitab aa rahi hai".
  const perBook = new Map();
  const kept = [];
  for (const r of passed) {
    const n = perBook.get(r.book) || 0;
    if (n >= PER_BOOK_CAP) continue;
    perBook.set(r.book, n + 1);
    kept.push(r);
    if (kept.length >= KEEP) break;
  }
  kept.best = best;         // gate se neeche ho tab bhi
  kept.pool = top.length;   // kitne ummeedwaar bheje the
  return kept;
}

// ── chalao ────────────────────────────────────────────────────────────
const only = process.argv.includes("--new")    ? ["naya"]
           : process.argv.includes("--full")   ? ["poora"]
           : process.argv.includes("--both")   ? ["vistar", "poora"]
           : process.argv.includes("--paryay") ? ["naya", "vistar"]
           : ["poora"];
const summary = {};

for (const name of only) {
  const cfg = CONFIGS[name];
  console.log(`\n${"=".repeat(72)}\n  CONFIG: ${name}  (semantic top-${cfg.sem} → rerank ${cfg.rerank}`
    + `${cfg.paryay ? " + granth-paryay" : ""})\n${"=".repeat(72)}`);
  let hit = 0, grounded = 0, cmpTotal = 0, cmpHit = 0;
  const bookHits = new Map();   // kaun si kitab kitne ansh mein aayi
  const distinct = [];          // har sawaal mein kitni alag kitaabein
  const failBest = [];          // fail sawaalon ka sabse achha rerank score
  const ctrlBest = [];          // control sawaalon ka sabse achha score
  console.log(`  ${"sawaal".padEnd(38)}${"aadhaar".padStart(6)}${"vishay".padStart(6)}  #  granth`);
  console.log("  " + "-".repeat(84));
  for (const { q, any } of QUESTIONS) {
    let g = [];
    try { g = await run(q, cfg); } catch (e) { console.log(`  ${q.slice(0, 40)}  ERROR ${e.message}`); continue; }
    const ok = g.length > 0;
    const rel = g.some(c => any.some(w => c.text.includes(w)));
    if (ok) grounded++;
    if (rel) hit++;
    if (COMPARE.has(q)) { cmpTotal++; if (rel) cmpHit++; }
    // saari kitaabein — sirf jeetne wali nahi
    const bks = [...new Set(g.map(c => c.book))];
    for (const c of g) bookHits.set(c.book, (bookHits.get(c.book) || 0) + 1);
    if (bks.length) distinct.push(bks.length);
    const shown = bks.slice(0, 3).map(b => b.slice(0, 13)).join(", ") + (bks.length > 3 ? ` +${bks.length - 3}` : "");
    // fail par: sabse achha rerank score — yahi batata hai ki gate ki
    // galti hai ya corpus ki
    if (!ok) { failBest.push(g.best ?? 0); }
    const tail = ok ? (shown || "—")
      : `best-rerank ${(g.best ?? 0).toFixed(3)}` + ((g.best ?? 0) >= 0.30 ? "  ← gate ke kareeb" : "");
    console.log(`  ${(COMPARE.has(q) ? "⇄ " : "  ") + q.slice(0, 34)}`.padEnd(38)
      + `${(ok ? "✅" : "❌").padStart(6)}${(rel ? "✅" : "❌").padStart(6)}  ${String(bks.length).padStart(2)}  ${tail}`);
  }
  // META — tulna waale sawaal. Inka jawab kisi EK ansh mein ho hi nahi
  // sakta, isliye inhe ALAG gina jaata hai, ASLI SCORE mein nahi. Yahan
  // "aadhaar mila" ka matlab itna hi hai ki AI ke paas kehne ko kuch to
  // tha — poora jawab wo kai anshon se banayega.
  let metaOk = 0;
  if (META.length) {
    console.log("  " + "-".repeat(78));
    for (const { q, any } of META) {
      let g = [];
      try { g = await run(q, cfg); } catch { continue; }
      const rel = g.some(c => any.some(w => c.text.includes(w)));
      if (rel) metaOk++;
      console.log(`  [tulna] ${q.slice(0, 36).padEnd(38)}${(rel ? "✅" : "—").padStart(9)}   ${g[0]?.book || "—"}`);
    }
  }

  let falseCite = 0;
  console.log("  " + "-".repeat(78));
  for (const q of CONTROL) {
    let g = [];
    try { g = await run(q, cfg); } catch { continue; }
    if (g.length) falseCite++;
    ctrlBest.push(g.best ?? 0);
    console.log(`  [control] ${q.slice(0, 30).padEnd(32)}${(g.length ? "⚠ JHOOTHI" : "✅ chup").padStart(11)}`
      + `   best-rerank ${(g.best ?? 0).toFixed(3)}`);
  }
  summary[name] = { hit, grounded, falseCite, metaOk, cmpHit, cmpTotal };
  console.log("  " + "-".repeat(78));
  console.log(`  aadhaar mila : ${grounded}/${QUESTIONS.length}  (${(100 * grounded / QUESTIONS.length).toFixed(0)}%)`);
  console.log(`  sahi vishay  : ${hit}/${QUESTIONS.length}  (${(100 * hit / QUESTIONS.length).toFixed(0)}%)   ← ASLI SCORE`);
  if (cmpTotal) {
    const rest = QUESTIONS.length - cmpTotal, restHit = hit - cmpHit;
    console.log(`     ⇄ tulna waale : ${cmpHit}/${cmpTotal}   |   baaki : ${restHit}/${rest}`
      + `  (dono upar wale score me shaamil hain)`);
  }
  if (META.length) console.log(`  meta-sawaal  : ${metaOk}/${META.length}  (alag gina — ek ansh se jawab banta hi nahi)`);
  console.log(`  jhoothi cite : ${falseCite}/${CONTROL.length}  (kam = behtar, 0 chahiye)`);

  // ── FAIL KYUN HUE — gate ki galti ya corpus ki? ────────────────────
  if (failBest.length) {
    const b = (lo, hi) => failBest.filter(x => x >= lo && x < hi).length;
    const near = b(0.30, 0.50), mid = b(0.10, 0.30), none = b(0, 0.10);
    console.log(`\n  FAIL KA VISHLESHAN  —  ${failBest.length} sawaal`);
    console.log(`    best-rerank 0.30-0.50 : ${String(near).padStart(3)}  ← jawab THA, gate ne roka`);
    console.log(`    best-rerank 0.10-0.30 : ${String(mid).padStart(3)}  ← kuch mila, par kamzor`);
    console.log(`    best-rerank 0.00-0.10 : ${String(none).padStart(3)}  ← corpus mein sach mein nahi`);
    console.log(`    (gate abhi ${MIN_RERANK} par hai)`);

    // ── GATE GIRANA SURAKSHIT HAI YA NAHI ──────────────────────────
    // 33 sawaal 0.30-0.50 par atke hain. Gate girane se wo mil sakte
    // hain — par tabhi, jab CONTROL sawaal (jinka jawab hai hi nahi)
    // us line se saaf neeche hon. Warna gate girate hi jhoothi
    // citation shuru ho jayegi, aur wahi is app ki sabse keemti cheez
    // hai. Isliye faisla andaaze se nahi, is number se hoga.
    if (ctrlBest.length) {
      const cMax = Math.max(...ctrlBest);
      const cSort = [...ctrlBest].sort((a, b) => b - a);
      console.log(`\n  GATE KA FAISLA`);
      console.log(`    control ka sabse ooncha score : ${cMax.toFixed(3)}`);
      console.log(`    control ke top-3             : ${cSort.slice(0, 3).map(x => x.toFixed(3)).join(", ")}`);
      const safe = cMax + 0.05;
      if (safe < MIN_RERANK) {
        const gain = failBest.filter(x => x >= safe && x < MIN_RERANK).length;
        console.log(`    → gate ${safe.toFixed(2)} tak girana SURAKSHIT lagta hai (+${gain} sawaal mil sakte hain)`);
        console.log(`      par ye ek hi run ka namoona hai — badalne se pehle dobara jaanchna.`);
      } else {
        console.log(`    → gate girana KHATARNAK — control isi daayre mein aa rahe hain`);
      }
    }
  }

  // ── GRANTH-VITARAN ─────────────────────────────────────────────────
  // Saurabh ne pakda (2026-08-07): "aisa feel hai ki ye har baar same
  // aadhaar de raha hai". Naapa to sach nikla — 24 me se 11 kitaabein ek
  // baar bhi nahi aayi thi. Isliye ab har run par ye tasveer chhapti hai.
  const totalHits = [...bookHits.values()].reduce((a, b) => a + b, 0);
  const avgDistinct = distinct.length ? (distinct.reduce((a, b) => a + b, 0) / distinct.length) : 0;
  console.log(`\n  GRANTH-VITARAN  —  prati sawaal ausatan ${avgDistinct.toFixed(1)} alag granth`);
  console.log(`  ${"granth".padEnd(24)}${"ansh".padStart(6)}${"%".padStart(6)}${"corpus%".padStart(9)}${"kitna".padStart(7)}`);
  const sorted = [...bookHits.entries()].sort((a, b) => b[1] - a[1]);
  for (const [b, n] of sorted) {
    const share = 100 * (CORPUS_SHARE.get(b) || 0);
    const won = 100 * n / totalHits;
    console.log(`  ${b.padEnd(24)}${String(n).padStart(6)}${won.toFixed(0).padStart(5)}%${share.toFixed(1).padStart(8)}%`
      + `${(share ? (won / share).toFixed(1) + "x" : "—").padStart(7)}`);
  }
  const never = [...CORPUS_SHARE.keys()].filter(b => !bookHits.has(b));
  if (never.length) {
    console.log(`\n  ❌ EK BAAR BHI NAHI AAYI (${never.length}/${CORPUS_SHARE.size}):`);
    console.log("     " + never.sort((a, b) => CORPUS_SHARE.get(b) - CORPUS_SHARE.get(a)).join(", "));
  } else {
    console.log(`\n  ✅ saari ${CORPUS_SHARE.size} kitaabein kam se kam ek baar aayi`);
  }
}

if (only.length > 1) {
  const names = only;
  console.log(`\n${"=".repeat(72)}\n  TULNA\n${"=".repeat(72)}`);
  console.log("  " + "".padEnd(16) + names.map(n => n.padStart(10)).join("") + "farak".padStart(10));
  for (const [k, label] of [["hit", "sahi vishay"], ["grounded", "aadhaar mila"], ["falseCite", "jhoothi cite"]]) {
    const vals = names.map(n => summary[n][k]);
    const d = vals[vals.length - 1] - vals[0];
    console.log("  " + label.padEnd(16) + vals.map(v => String(v).padStart(10)).join("")
      + ((d > 0 ? "+" : "") + d).padStart(10));
  }
  console.log("\n  'sahi vishay' badhna chahiye, 'jhoothi cite' 0 rehni chahiye.");
  console.log("  Agar 'jhoothi cite' badhi ho — badlaav ne shor bhi laaya. Us soorat");
  console.log("  mein badlaav WAPAS lena hai, MIN_RERANK_SCORE dheela nahi karna.");
}
