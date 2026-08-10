/**
 * SAARTHI — 57,339 ansh ka text Cloudflare D1 par (P2, 2026-08-10)
 * =====================================================================
 * Vectorize sirf VECTOR rakhta hai — wo bata deta hai ki kaunse ansh
 * milte-julte hain, par ansh ka TEXT nahi deta. Wo text D1 mein rakhte
 * hain, saath mein keyword search bhi.
 *
 * DO TABLE:
 *   chunks     — id, book, page, text  (Vectorize ke id se joda jaata hai)
 *   chunks_fts — SQLite ka FTS5 full-text index, keyword search ke liye
 *
 * KEYWORD SEARCH KYUN ZAROORI: aaj ke eval mein 85 ummeedwaaron mein se
 * 20 keyword raaste se aate hain. "दान का महत्व" jaise sawaal par semantic
 * dhundhla pad jaata hai par keyword ke liye wo bacchon ka khel hai —
 * दान shabd 21,097 jagah likha hai. Dono raaste chahiye.
 *
 * ⚠️ FTS5 aur DEVANAGARI: SQLite ka default `unicode61` tokenizer
 * Devanagari ko theek se todta hai (whitespace/punctuation par). Par
 * hamare corpus mein shabd JUDE HUE roop mein hain — "भयसे", "भयके".
 * Isliye Worker mein query ke saath prefix-match (`भय*`) bhi lagta hai,
 * bilkul waise jaise engine.js substring match karta tha.
 *
 * CHALAO (teen kadam, kram se):
 *   node scripts/12_load_d1.mjs --schema     # table banao (ek baar)
 *   node scripts/12_load_d1.mjs --load       # 57,339 ansh bhejo
 *   node scripts/12_load_d1.mjs --verify     # ginti milao
 *
 * --load resumable hai; beech mein ruke to dobara chalao.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "public", "knowledge", "books");
const DB    = "saarthi-knowledge";
const PROG  = join(ROOT, "public", "knowledge", ".d1-progress.json");

// Ek SQL file mein kitne ansh.
const BATCH = 300;

// ⚠️ Ek INSERT statement mein kitne ansh — YAHI wo cheez hai jispar pehli
// koshish tooti thi: "statement too long: SQLITE_TOOBIG".
// Maine poore 300 ansh ek hi INSERT ... VALUES (...),(...) mein daal diye
// the — Devanagari UTF-8 mein 3 byte prati akshar, toh wo ~900 KB ka EK
// statement ban raha tha. SQLite ki seema 1 MB PRATI STATEMENT hai.
// File kitni bhi badi ho sakti hai, bas ek statement nahi.
// 25 par har statement ~75 KB rehta hai — seema se kaafi neeche.
const PER_STMT = 25;

const wrangler = (args, opts = {}) =>
  execFileSync("npx", ["wrangler", ...args], {
    encoding: "utf8", stdio: opts.quiet ? "pipe" : "inherit", shell: true, ...opts,
  });

const sqlEsc = (s) => "'" + String(s ?? "").replace(/'/g, "''") + "'";

// ── SCHEMA ────────────────────────────────────────────────────────────
if (process.argv.includes("--schema")) {
  const sql = `
DROP TABLE IF EXISTS chunks_fts;
DROP TABLE IF EXISTS chunks;

CREATE TABLE chunks (
  id    TEXT PRIMARY KEY,
  book  TEXT NOT NULL,
  page  INTEGER,
  text  TEXT NOT NULL
);
CREATE INDEX idx_chunks_book ON chunks(book);

-- FTS5: keyword search. content='chunks' matlab text dobara store nahi
-- hota (jagah aadhi bachti hai), sirf index banta hai.
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,
  content='chunks',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 0'
);

-- chunks mein kuch bhi jude/badle to FTS apne aap sudhre
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.rowid, old.text);
END;
CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.rowid, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
`;
  const f = join(mkdtempSync(join(tmpdir(), "saarthi-")), "schema.sql");
  writeFileSync(f, sql, "utf8");
  console.log("schema bana raha hoon…\n");
  wrangler(["d1", "execute", DB, "--remote", "--yes", "--file", `"${f}"`]);
  console.log("\n✅ chunks + chunks_fts taiyaar");
  process.exit(0);
}

// ── VERIFY ────────────────────────────────────────────────────────────
if (process.argv.includes("--verify")) {
  console.log("D1 mein kitne ansh hain:\n");
  wrangler(["d1", "execute", DB, "--remote", "--yes", "--command",
    `"SELECT (SELECT COUNT(*) FROM chunks) AS chunks, (SELECT COUNT(*) FROM chunks_fts) AS fts, (SELECT COUNT(DISTINCT book) FROM chunks) AS books"`]);
  console.log("\nEk keyword search ka namoona (दान):\n");
  wrangler(["d1", "execute", DB, "--remote", "--yes", "--command",
    `"SELECT c.book, substr(c.text,1,60) AS ansh FROM chunks_fts f JOIN chunks c ON c.rowid=f.rowid WHERE chunks_fts MATCH 'दान*' LIMIT 3"`]);
  process.exit(0);
}

// ── LOAD ──────────────────────────────────────────────────────────────
if (!process.argv.includes("--load")) {
  console.log("Istemal:");
  console.log("  node scripts/12_load_d1.mjs --schema    # pehle ye (ek baar)");
  console.log("  node scripts/12_load_d1.mjs --load      # phir ye");
  console.log("  node scripts/12_load_d1.mjs --verify    # ant mein ye");
  process.exit(0);
}

console.log("corpus load ho raha…");
const rows = [];
for (const f of readdirSync(BOOKS).filter(x => x.endsWith(".json")).sort()) {
  const b = JSON.parse(readFileSync(join(BOOKS, f), "utf8"));
  for (const c of (b.chunks || [])) {
    const t = (c.text || "").trim();
    if (!t) continue;
    rows.push([c.id, c.book, c.page ?? null, t]);
  }
}
console.log(`  ${rows.length.toLocaleString()} ansh\n`);

let start = 0;
if (existsSync(PROG)) {
  try {
    const p = JSON.parse(readFileSync(PROG, "utf8"));
    if (p.total === rows.length && p.done) { start = p.done; console.log(`⏩ checkpoint: ${start.toLocaleString()} pehle se\n`); }
  } catch { /* shuru se */ }
}

const dir = mkdtempSync(join(tmpdir(), "saarthi-d1-"));
const t0 = Date.now();

for (let i = start; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH);
  // INSERT OR REPLACE — dobara chalane par duplicate nahi banega.
  // Ek file mein kai CHHOTE statements, ek bada nahi (upar PER_STMT dekho).
  let sql = "";
  for (let k = 0; k < slice.length; k += PER_STMT) {
    sql += "INSERT OR REPLACE INTO chunks (id, book, page, text) VALUES\n"
      + slice.slice(k, k + PER_STMT).map(([id, book, page, text]) =>
          `(${sqlEsc(id)}, ${sqlEsc(book)}, ${page == null ? "NULL" : Number(page)}, ${sqlEsc(text)})`
        ).join(",\n") + ";\n";
  }
  const f = join(dir, `b${i}.sql`);
  writeFileSync(f, sql, "utf8");
  try {
    wrangler(["d1", "execute", DB, "--remote", "--yes", "--file", `"${f}"`], { quiet: true });
  } catch (e) {
    // POORA error dikhao. Pehle sirf stdout ke 400 akshar chhapte the,
    // aur wrangler asli galti STDERR par likhta hai — isliye pehli baar
    // "batch @0 fail" ke alawa kuch pata hi nahi chala.
    console.error(`\n❌ batch @${i} fail`);
    const out = String(e.stdout || ""), err = String(e.stderr || "");
    if (err.trim()) { console.error("\n─── stderr ───"); console.error(err.trim().slice(-2000)); }
    if (out.trim()) { console.error("\n─── stdout ───"); console.error(out.trim().slice(-2000)); }
    if (!err.trim() && !out.trim()) console.error(e.message);
    console.error(`\nDobara chalayein — checkpoint se aage badhega:`);
    console.error(`  node scripts/12_load_d1.mjs --load`);
    writeFileSync(PROG, JSON.stringify({ total: rows.length, done: i }), "utf8");
    process.exit(1);
  }
  const done = Math.min(i + BATCH, rows.length);
  writeFileSync(PROG, JSON.stringify({ total: rows.length, done }), "utf8");
  const el = (Date.now() - t0) / 1000;
  const eta = done > start ? el / (done - start) * (rows.length - done) : 0;
  process.stdout.write(`\r   ${(100 * done / rows.length).toFixed(1)}%  ${done.toLocaleString()}/${rows.length.toLocaleString()}`
    + `  •  ETA ${Math.floor(eta / 60)}m ${Math.round(eta % 60)}s    `);
}

console.log(`\n\n✅ ho gaya — ${((Date.now() - t0) / 60000).toFixed(1)} min`);
console.log("   Ab jaanchein:  node scripts/12_load_d1.mjs --verify");
