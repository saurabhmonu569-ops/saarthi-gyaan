/**
 * SAARTHI — ANAATH ANSH DHOONDHO AUR MITAO                   (2026-08-14)
 * =====================================================================
 * "Anaath" = wo id jo D1 / Vectorize me PADI HAI, par ab kisi granth-file
 * me hai hi nahi. Yaani uska paath mit chuka, par uska vector zinda hai.
 *
 * KYUN YE FILE BANI — TEEN BAAR HO CHUKA HAI
 * -------------------------------------------
 *   11 Aug  nitya_karm_pooja  — 14 ansh D1/Vectorize me gum (task #24)
 *   14 Aug  nitya_karm_pooja  — 1 phantom bacha (Vectorize 57,485 vs D1 57,484)
 *   14 Aug  ekadashi_mahatmya — 54 anaath (155 ansh se 103 rah gaye)
 *
 * Teenon baar wajah EK HI hai, aur wo dhaanche me hai:
 *
 *     chunk id = hash(granth :: panna :: kram)  — PAATH SE NAHI
 *
 * Iska ek bada fayda hai (paath thoda badle to id wahi rehti hai, poora
 * corpus dobara embed nahi karna padta — 2 ghante bachte hain). Par uske
 * saath ek jaal hai:
 *
 *     Agar dobara chunk karne par ansh KAM ban gaye, to bache hue purane
 *     id kisi ke bhi haath nahi aate. D1 `INSERT OR REPLACE` hai aur
 *     Vectorize `upsert` — dono BADALTE hain, MITATE nahi.
 *
 * NUKSAAN KYA HAI (chhota, par asli):
 * Worker Vectorize se sirf ID uthata hai aur paath D1 se laata hai. Anaath
 * vector topK ke 45 me se ek jagah kha jaata hai aur badle me kuch nahi
 * deta — pool chup-chaap chhota ho jaata hai. Kabhi error nahi aata.
 *
 * ⚠️ YE SCRIPT SIRF STHANEEY FILES SE FAISLA KARTI HAI
 * -----------------------------------------------------
 * Vectorize apni saari id-ein list nahi karne deta. Isliye "anaath" ka
 * matlab yahan hai:
 *     jo id `embeddings/chunk_index*.json` me hai  (yaani chadhayi gayi thi)
 *     par `knowledge/books/*.json` me AB NAHI hai  (yaani paath ja chuka)
 *
 * Iska ek natija: agar koi id KABHI local index me thi hi nahi par
 * production me chadh gayi, ye script use nahi pakdegi. Aisi soorat me
 * D1 aur Vectorize ki ginti milaiye (§ neeche).
 *
 * CHALAO:
 *   node scripts/26_anaath_safai.mjs                    # sirf dikhao
 *   node scripts/26_anaath_safai.mjs --granth ekadashi_mahatmya
 *   node scripts/26_anaath_safai.mjs --mitao            # SACH ME mitao
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const EMB   = join(ROOT, "public", "knowledge", "embeddings");
const INDEX = "saarthi-chunks";
const DB    = "saarthi-knowledge";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const EK    = arg("granth", null);
const MITAO = process.argv.includes("--mitao");

// ── .env ──────────────────────────────────────────────────────────────
const env = { ...process.env };
const ep = join(ROOT, ".env");
if (existsSync(ep)) for (const line of readFileSync(ep, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const ACC = (env.CF_ACCOUNT_ID || "").trim();
const TOK = (env.CF_API_TOKEN  || "").trim();

// ── 1. SACH: jo id abhi granth-files me hain ──────────────────────────
const sach = new Set();
const granthKa = new Map();
for (const f of readdirSync(BOOKS).filter(f => f.endsWith(".json"))) {
  const j = JSON.parse(readFileSync(join(BOOKS, f), "utf8"));
  for (const c of j.chunks || []) { sach.add(c.id); granthKa.set(c.id, j.book); }
}
console.log(`\n  granth-files me      : ${sach.size.toLocaleString()} ansh`);

// ── 2. CHADHAYA GAYA: har chunk_index file ki id ──────────────────────
// yoga_sutra aur nitya_karm_pooja ki apni alag files hain (baad me jude the)
const chadha = new Map();          // id → granth
for (const f of readdirSync(EMB).filter(f => /^chunk_index.*\.json$/.test(f))) {
  const j = JSON.parse(readFileSync(join(EMB, f), "utf8"));
  for (const c of j.chunks || []) chadha.set(c.id, c.book);
}
console.log(`  chadhaye gaye        : ${chadha.size.toLocaleString()} ansh`);

// ── 3. ANAATH ────────────────────────────────────────────────────────
let anaath = [...chadha.entries()].filter(([id]) => !sach.has(id));
if (EK) anaath = anaath.filter(([, b]) => b === EK);

const perGranth = {};
for (const [, b] of anaath) perGranth[b] = (perGranth[b] || 0) + 1;

console.log(`  ${"─".repeat(52)}`);
console.log(`  ANAATH               : ${anaath.length.toLocaleString()}${EK ? `  (sirf ${EK})` : ""}\n`);

if (!anaath.length) {
  console.log(`  ✅ Koi anaath ansh nahi.

  Phir bhi ye milaa lijiye — ye jaanch alag hai:
      npx wrangler d1 execute ${DB} --remote --command "SELECT COUNT(*) FROM chunks"
      npx wrangler vectorize info ${INDEX}
  Dono me ${sach.size.toLocaleString()} aana chahiye.
`);
  process.exit(0);
}

for (const [b, n] of Object.entries(perGranth).sort((x, y) => y[1] - x[1]))
  console.log(`     ${b.padEnd(24)} ${String(n).padStart(5)}`);

const ids = anaath.map(([id]) => id);
writeFileSync(join(ROOT, "anaath-ids.txt"), ids.join("\n"), "utf8");
console.log(`\n  poori soochi: anaath-ids.txt`);

if (!MITAO) {
  console.log(`
  ${"═".repeat(64)}
  Abhi kuch MITAYA NAHI gaya.

  Mitane ke liye:  node scripts/26_anaath_safai.mjs${EK ? ` --granth ${EK}` : ""} --mitao

  ⚠️ Mitane se pehle upar ki ginti dekhiye. Agar ye ginti aapki ummeed se
     BAHUT zyada hai, to rukiye — ho sakta hai koi granth-file adhoori
     bani ho, aur tab ye script sahi ansh mita degi.
`);
  process.exit(0);
}

// ── 4. MITAO ─────────────────────────────────────────────────────────
if (!ACC || !TOK) { console.error("\n❌ .env me CF_ACCOUNT_ID / CF_API_TOKEN chahiye"); process.exit(1); }

console.log(`\n  ${"═".repeat(64)}\n  MITA RAHA HOON — ${ids.length} ansh\n`);

// ── 4a. Vectorize ────────────────────────────────────────────────────
const vapi = `https://api.cloudflare.com/client/v4/accounts/${ACC}/vectorize/v2/indexes/${INDEX}/delete_by_ids`;
const VBATCH = 500;
let vDone = 0;
for (let i = 0; i < ids.length; i += VBATCH) {
  const slice = ids.slice(i, i + VBATCH);
  const res = await fetch(vapi, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: slice }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.success === false) {
    console.error(`  ❌ Vectorize: ${JSON.stringify(j?.errors || j).slice(0, 240)}`);
    process.exit(1);
  }
  vDone += slice.length;
  process.stdout.write(`\r  Vectorize: ${vDone}/${ids.length}   `);
}
console.log(`\n  ✅ Vectorize se ${vDone} mitaye (mutation queue me — ginti kuch der me girti hai)`);

// ── 4b. D1 ───────────────────────────────────────────────────────────
// ⚠️ SQL --command SE MAT BHEJNA — 14 Aug ko yahi galti ho chuki hai.
// Windows par `shell: true` ke saath SQL ki spaces par command tukdon me
// toot jaati hai, aur wrangler kehta hai:
//     Unknown arguments: FROM, chunks, WHERE, id, IN, (...)
// Vectorize saaf ho chuka tha par D1 me 54 ansh pade rah gaye — aur
// script "ho gaya" jaisa dikh rahi thi.
//
// Isliye 12_load_d1.mjs wala ajmaya hua raasta: SQL ek FILE me likho aur
// `--file` do. Tab quoting ka sawaal hi nahi uthta.
//
// D1 ki 100-parameter wali seema yahan laagu NAHI hoti (wo bound
// parameter par hai, seedhe likhe hue SQL par nahi) — par file ko
// padhne-laayak rakhne ke liye 90 prati line par hi baante hain.
const { execFileSync } = await import("node:child_process");
const DBATCH = 90;
const lines = [];
for (let i = 0; i < ids.length; i += DBATCH) {
  const slice = ids.slice(i, i + DBATCH);
  lines.push(`DELETE FROM chunks WHERE id IN (${slice.map(x => `'${x}'`).join(",")});`);
}
const sqlFile = join(ROOT, "anaath-delete.sql");
writeFileSync(sqlFile, lines.join("\n") + "\n", "utf8");

try {
  execFileSync("npx", ["wrangler", "d1", "execute", DB, "--remote", "--yes", "--file", `"${sqlFile}"`],
    { encoding: "utf8", stdio: "inherit", shell: true });
} catch (e) {
  console.error(`\n  ❌ D1 nahi mita: ${String(e.stderr || e.message).slice(0, 300)}`);
  console.error(`     SQL yahan padi hai: ${sqlFile}`);
  process.exit(1);
}
console.log(`\n  ✅ D1 se ${ids.length} mitaye (FTS trigger apne aap saaf karta hai)`);

console.log(`
  ${"═".repeat(64)}
  Ab milaiye — dono me ${sach.size.toLocaleString()} aana chahiye:

    npx wrangler d1 execute ${DB} --remote --command "SELECT COUNT(*) FROM chunks"
    npx wrangler vectorize info ${INDEX}

  ⚠️ Vectorize ki ginti TURANT nahi girti — wo mutation queue se chalta
     hai. Kuch minute ruk kar dobara dekhiye.
`);
