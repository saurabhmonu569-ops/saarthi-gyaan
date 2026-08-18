/**
 * SAARTHI — EK sawaal, poora chittha                        2026-08-18
 * =====================================================================
 * Ek sawaal par retrieval ne jo kiya, wo poora saamne rakhta hai:
 * banayi hui query, poore pool ke ank, kaun paas hua aur kaun kis ank
 * par gira.
 *
 * ⚠️ YE `debug-query.mjs` KI JAGAH HAI. Wo purani script DO BAAR JHOOTH
 * bol chuki hai:
 *   • usme MIN_RERANK_SCORE = 0.5 likha tha jabki server 0.30/0.18 par
 *     chal raha tha
 *   • wo `toDevanagari(q)` seedha bhejti thi, jabki app teen kadam se
 *     guzarti hai (normalize → stripMetaFraming → paryay)
 * Uske saare nidaan APP KE THE HI NAHI.
 *
 * Ye script wo galti nahi kar sakti: query WORKER banata hai (kaccha `q`
 * bheja jaata hai) aur ank bhi WORKER se aate hain (`debug: true` →
 * stats.poolScores). Yahan koi nakal nahi hai, isliye drift ho hi nahi
 * sakta.
 *
 * CHALAO:
 *   node scripts/36_ek_sawaal.mjs "kal ka mausam kaisa rahega"
 *   node scripts/36_ek_sawaal.mjs "गीता में कर्म योग क्या है?" --baar 3
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
const API = (env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
if (!API) { console.error("❌ .env me VITE_AI_PROXY_URL chahiye"); process.exit(1); }
const ORIGIN  = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SESSION = (env.EVAL_SESSION || "").trim();

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BAAR = parseInt(arg("baar", "1"), 10) || 1;
const q = process.argv.slice(2).filter(a => !a.startsWith("--") && process.argv[process.argv.indexOf(a) - 1] !== "--baar")[0];
if (!q) { console.error('❌ sawaal dijiye:  node scripts/36_ek_sawaal.mjs "sawaal yahan"'); process.exit(1); }

const so = (ms) => new Promise(s => setTimeout(s, ms));

for (let daur = 1; daur <= BAAR; daur++) {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  const r = await fetch(API + "/search", {
    method: "POST", headers: h, body: JSON.stringify({ q, debug: true }),
  });
  if (!r.ok) { console.error(`❌ HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  const j = await r.json();
  const s = j.stats || {};
  const pool = s.poolScores || [];
  const laute = new Set((j.chunks || []).map(c => c.id));

  console.log(`\n${"═".repeat(76)}`);
  console.log(`SAWAAL : ${q}` + (BAAR > 1 ? `   (daur ${daur}/${BAAR})` : ""));
  console.log(`findQ  : ${s.q?.findQ ?? "—"}`);
  console.log(`rerankQ: ${s.q?.rerankQ ?? "—"}`);
  console.log(`hint   : ${s.hinted ?? "koi nahi"}   ·   pool ${s.pool ?? 0}   ·   laute ${(j.chunks || []).length}`
    + `   ·   best ${s.best ?? "—"}` + (s.skipped ? `   ⚠️ ${s.skipped} rerank batch chhoote` : ""));

  if (!pool.length) { console.log(`\npoolScores nahi aaye — worker deploy hua?`); continue; }

  // ⚠️ `usable` bhi dikhao. hasSentences/looksGarbled ka chhanna ank se
  // PEHLE lagta hai — bina iske ye samajh nahi aata ki ooncha ank paakar
  // bhi ansh kyun bahar reh gaya.
  const sorted = [...pool].sort((a, b) => b.rerank - a.rerank);
  console.log(`\nsabse ooncha 15 (kul ${pool.length}):`);
  console.log(`  ${"ank".padEnd(10)} ${"granth".padEnd(24)} haal`);
  for (const c of sorted.slice(0, 15)) {
    const haal = laute.has(c.id) ? "✅ jawab me gaya"
               : !c.usable       ? "— paath chhan gaya (tootey vaakya/OCR)"
                                 : "✗ gate par gira";
    console.log(`  ${c.rerank.toFixed(6).padEnd(10)} ${c.book.padEnd(24)} ${haal}`);
  }

  // ⚠️ PAATH BHI DIKHAO — ank akela kabhi nahi batata ki GALTI KYA HAI.
  // "kal ka mausam" par Mahabharata ko 0.97 mila; wo number dekhkar lagta
  // hai reranker toota hai. Panna padhne par hi pata chalta hai ki usme
  // sach me kya likha hai. (poolScores me paath jaan-boojhkar nahi jaata
  // — bhaar bachane ke liye — par laute hue ansh ka paath aata hai.)
  const upar = (j.chunks || []).slice(0, 3);
  if (upar.length) {
    console.log(`\njo ansh jawab me gaye — sabse upar ke ${upar.length} ka paath:`);
    for (const c of upar) {
      console.log(`\n  [${c.book} · p.${c.page ?? "?"}]`);
      console.log(`  ${String(c.text || "").replace(/\s+/g, " ").slice(0, 300)}…`);
    }
  }

  const granthBaant = {};
  for (const c of pool) (granthBaant[c.book] ||= []).push(c.rerank);
  console.log(`\npool ka batwara (granth — ansh, sabse ooncha ank):`);
  for (const [b, arr] of Object.entries(granthBaant).sort((a, b2) => b2[1].length - a[1].length).slice(0, 8))
    console.log(`  ${b.padEnd(24)} ${String(arr.length).padStart(3)} ansh   ooncha ${Math.max(...arr).toFixed(4)}`);

  if (daur < BAAR) await so(800);
}
