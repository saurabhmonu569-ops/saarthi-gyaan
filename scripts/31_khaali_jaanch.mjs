/**
 * SAARTHI — "khaali lautta hai" PAKKA hai ya DOLTA hai?     2026-08-18
 * =====================================================================
 * KYUN YE SCRIPT ALAG HAI:
 *
 * 19_eval_perbook.mjs har sawaal EK BAAR poochhti hai. Us naap se pata
 * chala tha ki bina granth-naam wale sawaalon par kuch granth khaali
 * lautte hain — lal_kitab 9/10, ishadi_upanishad 6/8, garuda_purana_1 2/3.
 *
 * ⚠️ PAR AAJ (18 Agast) NAAPA GAYA KI /search KHUD STHIR NAHI HAI.
 * Bilkul wahi body do baar bhejne par ausat 29% ansh alag aate hain, aur
 * "महाभारत में धर्म क्या है" par 100% alag. Yaani ek-baar-wali naap me
 * "khaali" ka matlab do bilkul alag cheezein ho sakti hai:
 *
 *    PAKKA KHAALI  — wo sawaal sach me kabhi kuch nahi laata.
 *                    Ye asli kami hai. Isse theek karna hai.
 *
 *    DOLTA         — kabhi ansh aate hain, kabhi nahi. Ye #42 ka rog hai,
 *                    is granth ka nahi. Isse "granth ki kami" maankar
 *                    theek karne baithna GALAT ILAAJ hai — aur usme din
 *                    lag jaate.
 *
 * Aur "dolta" apne aap me BADI shikayat hai: user ko wahi sawaal kabhi
 * jawab deta hai kabhi nahi. Par uska ilaaj retrieval me hai (#42/#21),
 * granth ke chunks ya hint me nahi.
 *
 * ISLIYE: har sawaal N baar (default 3). Phir teen dher:
 *    0/N khaali  → theek chalta hai
 *    N/N khaali  → PAKKA KHAALI, asli kami
 *    beech me    → DOLTA, #42 ka hissa
 *
 * ⚠️ Ye script KACCHA sawaal (`{ q }`) bhejti hai — wahi jo app bhejti
 * hai. Purani eval-scripts apni nakal se findQ/rerankQ banati thi, aur
 * 18 Agast ko pata chala ki debug-query.mjs ki nakal DRIFT kar chuki thi.
 * Ab query worker banata hai, isliye ye naap app par hi hoti hai.
 *
 * CHALAO:
 *   node scripts/31_khaali_jaanch.mjs                    # jo granth 50%+ khaali the
 *   node scripts/31_khaali_jaanch.mjs --baar 5
 *   node scripts/31_khaali_jaanch.mjs --books lal_kitab,rigveda_1
 *   node scripts/31_khaali_jaanch.mjs --sab              # saare bina-hint sawaal
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(ROOT, "eval-perbook.json");
const OUT  = join(ROOT, "khaali-jaanch.json");

if (!existsSync(SRC)) {
  console.error(`❌ ${SRC} nahi mili — pehle 19_eval_perbook.mjs chalayein.`);
  process.exit(1);
}

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

// ⚠️ SESSION ke bina har call anonymous jaati hai aur din-bhar ke kote par
// 429 khaati hai — jo is script me "khaali" jaisa hi dikhta. 18 Agast ko
// 17_smoke_check.mjs me yahi chhoot gaya tha aur ek JHOOTHA outage report
// hua. Isliye 429 ko neeche alag se pakda jaata hai, khaali nahi gina jaata.
if (!SESSION) {
  console.warn("⚠️  .env me EVAL_SESSION nahi hai — call anonymous jayengi aur");
  console.warn("    429 mil sakta hai. Us haalat me naap bharosemand NAHI hai.\n");
}

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BAAR = parseInt(arg("baar", "3"), 10) || 3;
const onlyBooks = (arg("books") || "").split(",").map(x => x.trim()).filter(Boolean);
const SAB = process.argv.includes("--sab");

// ── bina-hint sawaal chuno ────────────────────────────────────────────
const rows = JSON.parse(readFileSync(SRC, "utf8"));
const binaHint = rows.filter(r => !r.hinted);

// har granth ka purana khaali-anupaat
const perBook = {};
for (const r of binaHint) {
  (perBook[r.book] ||= { kul: 0, khaali: 0, q: [] });
  perBook[r.book].kul++;
  if (r.nat === "khaali") perBook[r.book].khaali++;
  perBook[r.book].q.push(r.q);
}

let books;
if (onlyBooks.length)  books = onlyBooks.filter(b => perBook[b]);
else if (SAB)          books = Object.keys(perBook);
else                   books = Object.keys(perBook).filter(b => perBook[b].khaali / perBook[b].kul >= 0.5);

if (!books.length) { console.error("❌ koi granth nahi chuna gaya."); process.exit(1); }

const kaam = [];
for (const b of books) for (const q of perBook[b].q) kaam.push({ book: b, q });

console.log(`\nKHAALI PAKKA hai ya DOLTA — har sawaal ${BAAR} baar`);
console.log(`granth: ${books.join(", ")}`);
console.log(`sawaal: ${kaam.length}   ·   kul call: ${kaam.length * BAAR}`);
console.log("─".repeat(74));

const PACE_MS = SESSION ? 250 : 3200;
const so = (ms) => new Promise(s => setTimeout(s, ms));

async function poochho(q, koshish = 1) {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  try {
    const r = await fetch(SEARCH, { method: "POST", headers: h, body: JSON.stringify({ q }) });
    // ⚠️ 429 ko KHAALI mat ginna — wo kota hai, retrieval ki kami nahi.
    if (r.status === 429) {
      if (koshish > 5) return { err: "raftaar-seema" };
      await so(8000 * koshish);
      return poochho(q, koshish + 1);
    }
    if (!r.ok) return { err: `HTTP ${r.status}` };
    const j = await r.json();
    const ch = j.chunks || [];
    return { n: ch.length, granth: [...new Set(ch.map(c => c.book))], stats: j.stats || null };
  } catch (e) { return { err: e.message }; }
}

const nateeja = [];
let done = 0;

for (const { book, q } of kaam) {
  const daur = [];
  for (let i = 0; i < BAAR; i++) {
    daur.push(await poochho(q));
    await so(PACE_MS);
  }
  done++;

  const gadbad = daur.filter(d => d.err);
  const theek  = daur.filter(d => !d.err);
  const khaaliBaar = theek.filter(d => d.n === 0).length;
  const sahiBaar   = theek.filter(d => (d.granth || []).includes(book)).length;

  let dher;
  if (!theek.length)                    dher = "gadbad";
  else if (khaaliBaar === theek.length) dher = "pakka-khaali";
  else if (khaaliBaar > 0)              dher = "dolta";
  else                                  dher = "theek";

  nateeja.push({ book, q, dher, khaaliBaar, sahiBaar, kulDaur: theek.length,
                 granth: [...new Set(theek.flatMap(d => d.granth || []))],
                 err: gadbad[0]?.err || null });

  const chinh = { "pakka-khaali": "❌", "dolta": "🔁", "theek": "✅", "gadbad": "⚠️ " }[dher];
  console.log(`${chinh} [${done}/${kaam.length}] ${book} — ${q.slice(0, 56)}`);
  if (dher === "dolta")
    console.log(`     ${theek.length} me se ${khaaliBaar} baar khaali · sahi granth ${sahiBaar} baar`);
  else if (dher === "theek" && sahiBaar === 0)
    console.log(`     ansh mile par SAHI granth kabhi nahi — mila: ${nateeja.at(-1).granth.slice(0,3).join(", ")}`);
  else if (dher === "gadbad")
    console.log(`     ${gadbad[0].err}`);
}

// ── saar ──────────────────────────────────────────────────────────────
const ginti = (b, d) => nateeja.filter(r => r.book === b && r.dher === d).length;

console.log("\n" + "─".repeat(74));
console.log(`${"granth".padEnd(22)} ${"pakka-khaali".padEnd(13)} ${"dolta".padEnd(7)} ${"theek".padEnd(7)} purana`);
console.log("─".repeat(74));
for (const b of books) {
  const kul = nateeja.filter(r => r.book === b).length;
  const p = perBook[b];
  console.log(
    `${b.padEnd(22)} ${String(ginti(b,"pakka-khaali")).padEnd(13)}`
    + ` ${String(ginti(b,"dolta")).padEnd(7)} ${String(ginti(b,"theek")).padEnd(7)}`
    + ` ${p.khaali}/${p.kul} khaali tha  (ab kul ${kul})`
  );
}

const P = nateeja.filter(r => r.dher === "pakka-khaali").length;
const D = nateeja.filter(r => r.dher === "dolta").length;
const T = nateeja.filter(r => r.dher === "theek").length;
const G = nateeja.filter(r => r.dher === "gadbad").length;

console.log("─".repeat(74));
console.log(`PAKKA KHAALI ${P}   ·   DOLTA ${D}   ·   THEEK ${T}` + (G ? `   ·   gadbad ${G}` : ""));

// ⚠️ YE DO LINE HI IS SCRIPT KA POORA MATLAB HAIN.
if (D > P) {
  console.log(`\n⚠️ DOLTE SAWAAL (${D}) PAKKA-KHAALI (${P}) SE ZYADA HAIN.`);
  console.log(`   Yaani #25 zyadatar RETRIEVAL KI ASTHIRTA hai (#42/#21), granth ki`);
  console.log(`   kami nahi. Chunks, hint ya paryay chhedne se ye theek NAHI hoga.`);
} else if (P) {
  console.log(`\n${P} sawaal HAR BAAR khaali lautte hain — ye asli kami hai, shor nahi.`);
}

writeFileSync(OUT, JSON.stringify(nateeja, null, 2));
console.log(`\npoora byora: ${OUT}`);
