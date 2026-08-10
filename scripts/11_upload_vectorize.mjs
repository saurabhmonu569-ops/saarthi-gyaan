/**
 * SAARTHI — 57,339 vector Cloudflare Vectorize par (P2, 2026-08-10)
 * =====================================================================
 * KYUN: abhi client HAR NAYE VISITOR par 316 MB utaarta hai (books 165 +
 * index 93 + vectors 56). Gzip ke baad bhi ~122 MB. Bharat mein mobile
 * par wo aadmi rukta hi nahi — yaani 80% sahi jawab kisi tak pahunchte
 * hi nahi. Isliye retrieval poora server par ja raha hai.
 *
 * YE SCRIPT: vectors_int8.bin ko wapas float32 mein kholkar Vectorize
 * mein bhejti hai, har vector ke saath uski kitab metadata mein.
 *
 * KHAAS BAAT — int8 se wapas float:
 * vectors_int8.bin ka har row = 4 byte float32 scale + 1024 int8.
 * Asli value = int8 * scale / 127. Ye quantization lossy hai (self-cosine
 * 0.9997 naapa gaya tha), par wahi vectors abhi bhi chal rahe hain aur
 * unhi par 80% ka score naapa gaya hai. Isliye YAHI bhej rahe hain —
 * naye sire se embed karke bhejte to score badal jaata aur pata nahi
 * chalta ki P2 ne kya toda.
 *
 * CHALAO:
 *   node scripts/11_upload_vectorize.mjs
 *   node scripts/11_upload_vectorize.mjs --from 20000   # beech se shuru
 *
 * Resumable hai — beech mein ruk jaye to --from se aage badhao.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMB  = join(ROOT, "public", "knowledge", "embeddings");
const DIM = 1024, ROW = 1028;
const INDEX = "saarthi-chunks";

// Vectorize ek call mein max 1000 vector leta hai; 1024 float ka JSON
// bada hota hai isliye 200 rakha — payload ~3 MB prati call.
const BATCH = 200;
const PROG = join(EMB, ".vectorize-progress.json");

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
const TOK = (env.CF_API_TOKEN || "").trim();
if (!ACC || !TOK) {
  console.error("❌ .env mein CF_ACCOUNT_ID / CF_API_TOKEN chahiye.");
  console.error("   Token mein Account → Vectorize → Edit ki anumati honi chahiye.");
  process.exit(1);
}

console.log("corpus load ho raha…");
const idx = JSON.parse(readFileSync(join(EMB, "chunk_index.json"), "utf8"));
const buf = readFileSync(join(EMB, "vectors_int8.bin"));
const n = idx.count;
if (buf.length !== n * ROW) {
  console.error(`❌ vectors_int8.bin ka aakaar mel nahi khata: ${buf.length} vs ${n * ROW}`);
  console.error("   Shayad embed-corpus.mjs aadha chala tha. Use dobara chalayein.");
  process.exit(1);
}
console.log(`  ${n.toLocaleString()} vector, ${idx.chunks.length.toLocaleString()} chunk-meta\n`);

/** Ek row int8 se wapas float32 — yahi ganit semanticSearch.js mein hai */
function readVector(i) {
  const scale = buf.readFloatLE(i * ROW);
  const out = new Array(DIM);
  for (let d = 0; d < DIM; d++) out[d] = buf.readInt8(i * ROW + 4 + d) * scale / 127;
  return out;
}

const api = `https://api.cloudflare.com/client/v4/accounts/${ACC}/vectorize/v2/indexes/${INDEX}/upsert`;

async function upsert(rows, attempt = 1) {
  // Vectorize NDJSON leta hai — har line ek vector
  const body = rows.map(r => JSON.stringify(r)).join("\n");
  try {
    const res = await fetch(api, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/x-ndjson" },
      body,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.success === false) {
      const msg = JSON.stringify(j?.errors || j).slice(0, 300);
      if (attempt < 4 && /rate|limit|503|502|timeout/i.test(msg)) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        return upsert(rows, attempt + 1);
      }
      throw new Error(msg);
    }
    return true;
  } catch (e) {
    if (attempt < 4) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return upsert(rows, attempt + 1);
    }
    throw e;
  }
}

// ── resume ────────────────────────────────────────────────────────────
let start = 0;
const fromArg = process.argv.indexOf("--from");
if (fromArg > -1) start = parseInt(process.argv[fromArg + 1], 10) || 0;
else if (existsSync(PROG)) {
  try {
    const p = JSON.parse(readFileSync(PROG, "utf8"));
    if (p.total === n && p.done) { start = p.done; console.log(`⏩ checkpoint: ${start.toLocaleString()} pehle se ho chuke\n`); }
  } catch { /* shuru se */ }
}

const t0 = Date.now();
console.log(`⚡ ${(n - start).toLocaleString()} vector bhejne hain (batch ${BATCH})\n`);

for (let i = start; i < n; i += BATCH) {
  const rows = [];
  for (let j = i; j < Math.min(i + BATCH, n); j++) {
    const meta = idx.chunks[j];
    rows.push({
      id: String(meta.id),
      values: readVector(j),
      // `book` metadata isliye taaki Worker per-book filter kar sake
      // (detectHintedBook wala raasta) bina D1 ko chhue.
      metadata: { book: String(meta.book || "") },
    });
  }
  try {
    await upsert(rows);
  } catch (e) {
    console.error(`\n❌ batch @${i} fail: ${e.message}`);
    console.error(`   Dobara chalayein:  node scripts/11_upload_vectorize.mjs --from ${i}`);
    writeFileSync(PROG, JSON.stringify({ total: n, done: i }), "utf8");
    process.exit(1);
  }
  const done = Math.min(i + BATCH, n);
  writeFileSync(PROG, JSON.stringify({ total: n, done }), "utf8");
  const pct = 100 * done / n;
  const el = (Date.now() - t0) / 1000;
  const eta = done > start ? el / (done - start) * (n - done) : 0;
  process.stdout.write(`\r   ${pct.toFixed(1)}%  ${done.toLocaleString()}/${n.toLocaleString()}`
    + `  •  ETA ${Math.floor(eta / 60)}m ${Math.round(eta % 60)}s    `);
}

console.log(`\n\n✅ ho gaya — ${((Date.now() - t0) / 60000).toFixed(1)} min`);
console.log(`   Vectorize index "${INDEX}" mein ${n.toLocaleString()} vector`);
console.log(`\n   Jaanch:  npx wrangler vectorize info ${INDEX}`);
