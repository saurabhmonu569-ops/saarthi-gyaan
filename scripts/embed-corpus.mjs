/**
 * SAARTHI — Corpus re-embedding (item #16, 2026-08-01)
 * =====================================================================
 * KYUN: purana embedding model (paraphrase-multilingual-MiniLM-L12-v2)
 * asal mein repo mein tha hi nahi — sirf 134-byte ka Git LFS pointer tha.
 * Isliye semanticSearch() hamesha [] laut raha tha aur app sirf keyword
 * search par chal rahi thi. Ab query ka embedding Cloudflare Workers AI
 * (bge-m3) se banta hai, aur corpus ke vectors yeh script banati hai.
 *
 * CHALANE SE PEHLE — .env mein do cheezein daalein:
 *   CF_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   CF_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 * (Token: dash.cloudflare.com/profile/api-tokens → Create Token →
 *  Custom token → Account → Workers AI → Read)
 *
 * CHALAO:
 *   node scripts/embed-corpus.mjs
 *
 * CHECKPOINT: beech mein ruk jaye (network/rate-limit) toh dobara wahi
 * command chalao — jitna ho chuka hai wahan se aage badhega, dobara
 * neurons kharch nahi honge.
 *
 * OUTPUT:
 *   public/knowledge/embeddings/vectors_int8.bin   (~19 MB)
 *   public/knowledge/embeddings/chunk_index.json   (v2)
 *
 * FORMAT (vectors_int8.bin) — har row 1028 bytes, 4-byte aligned:
 *   [0..3]     float32  scale  (us row ka max|v|)
 *   [4..1027]  int8 x1024      quantized vector
 * Asli value  =  int8 / 127 * scale
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, openSync, writeSync, closeSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS_DIR = join(ROOT, "public", "knowledge", "books");
const OUT_DIR   = join(ROOT, "data", "embeddings");

/**
 * --books <id,id>  — SIRF in granthon ke ansh embed karo.  (2026-08-11)
 *
 * KYUN: 24va granth (Yogasutra) jodte waqt sirf 160 naye ansh the, par ye
 * script poore 57,499 chalati. Do ghante aur hazaaron neuron us kaam par
 * jo pehle se ho chuka hai.
 *
 * ALAG FILE kyun: bin file me har vector apni jagah par likha jaata hai —
 * (i * rowBytes). Chhanni lagane se i badal jaata hai, to agar usi purani
 * file me likhte to poora corpus gadbada jaata. Isliye chhanni wale roop
 * ki apni file:  vectors_int8.yoga_sutra.bin
 *
 * Vectorize aur D1 dono upsert (INSERT OR REPLACE) hain, isliye alag se
 * chadhane par bhi kuch tootta nahi.
 */
const bArg  = process.argv.indexOf("--books");
const ONLY  = bArg > -1 ? (process.argv[bArg + 1] || "").split(",").map(x => x.trim()).filter(Boolean) : null;
const SUFF  = ONLY ? "." + ONLY.join("_") : "";

const BIN_PATH  = join(OUT_DIR, `vectors_int8${SUFF}.bin`);
const IDX_PATH  = join(OUT_DIR, `chunk_index${SUFF}.json`);
const PROG_PATH = join(OUT_DIR, `.embed-progress${SUFF}.json`);

const MODEL = "@cf/baai/bge-m3";
const DIM = 1024;
const ROW_BYTES = 4 + DIM;      // float32 scale + 1024 int8
// FIX (2026-08-03): pehle BATCH=100 tha aur script theek batch-2 par ruk
// gayi. Wajah: bge-m3 ka context 60,000 tokens hai — 100 chunks x ~600
// tokens = 60,000, yaani seedha limit par. Aur Cloudflare ka
// `truncate_inputs` default FALSE hai, matlab lamba context aane par model
// truncate nahi karta, ERROR deta hai. Ab batch chhota + truncate on.
const BATCH = 25;               // 25 x ~600 tok = ~15k, 60k limit se bahut neeche
const MAX_RETRY = 5;

// ── env ──────────────────────────────────────────────────────────────
function loadEnv() {
  const out = { ...process.env };
  const p = join(ROOT, ".env");
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
const env = loadEnv();
const ACCOUNT_ID = (env.CF_ACCOUNT_ID || "").trim();
const API_TOKEN  = (env.CF_API_TOKEN  || "").trim();

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error(`
❌ CF_ACCOUNT_ID ya CF_API_TOKEN nahi mila.

.env mein ye do line jodein:

  CF_ACCOUNT_ID=<Workers & Pages page ke right sidebar mein "Account ID">
  CF_API_TOKEN=<dash.cloudflare.com/profile/api-tokens se banaya token>

Token banate waqt: Create Token → Custom token →
  Permissions: Account → Workers AI → Read
`);
  process.exit(1);
}

const API_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

// ── corpus padho (deterministic order — checkpoint isi par tika hai) ──
function loadChunks() {
  let files = readdirSync(BOOKS_DIR).filter(f => f.endsWith(".json")).sort();
  if (ONLY) {
    files = files.filter(f => ONLY.includes(f.replace(/\.json$/, "")));
    if (!files.length) {
      console.error(`❌ --books "${ONLY.join(",")}" — koi file nahi mili ${BOOKS_DIR} me`);
      process.exit(1);
    }
  }
  const rows = [];
  for (const f of files) {
    const b = JSON.parse(readFileSync(join(BOOKS_DIR, f), "utf8"));
    for (const c of (b.chunks || [])) {
      const text = (c.text || "").trim();
      if (text.length < 40) continue;
      rows.push({ id: c.id, book: c.book, text });
    }
  }
  return rows;
}

// ── Workers AI call, retry ke saath ───────────────────────────────────
async function embedBatch(texts, attempt = 1) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      // truncate_inputs: koi chunk model ke context se lamba nikle toh use
      // kaat do — poore batch ko fail mat karo.
      body: JSON.stringify({ text: texts, truncate_inputs: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} — ${body.slice(0, 400)}`);
    }
    const j = await res.json();
    const vecs = j?.result?.data || j?.data;
    if (!Array.isArray(vecs) || vecs.length !== texts.length) {
      throw new Error(`unexpected shape: ${JSON.stringify(j).slice(0, 300)}`);
    }
    return vecs;
  } catch (e) {
    if (attempt >= MAX_RETRY) throw e;
    const wait = Math.min(30000, 1000 * 2 ** attempt);
    console.log(`   ⟳ retry ${attempt}/${MAX_RETRY} in ${wait / 1000}s — ${e.message.slice(0, 120)}`);
    await new Promise(r => setTimeout(r, wait));
    return embedBatch(texts, attempt + 1);
  }
}

// ── L2 normalize + int8 quantize ─────────────────────────────────────
function quantize(vec) {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;

  let maxAbs = 0;
  const unit = new Float64Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    unit[i] = vec[i] / norm;
    const a = Math.abs(unit[i]);
    if (a > maxAbs) maxAbs = a;
  }
  const scale = maxAbs || 1;

  const row = Buffer.alloc(ROW_BYTES);
  row.writeFloatLE(scale, 0);
  for (let i = 0; i < vec.length; i++) {
    let q = Math.round(unit[i] / scale * 127);
    if (q > 127) q = 127; else if (q < -127) q = -127;
    row.writeInt8(q, 4 + i);
  }
  return row;
}

// ── main ─────────────────────────────────────────────────────────────
const t0 = Date.now();
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const chunks = loadChunks();
console.log(`\n📚 corpus: ${chunks.length.toLocaleString()} chunks`
  + (ONLY ? `  — sirf ${ONLY.join(", ")}` : ""));

// checkpoint
let done = 0;
if (existsSync(PROG_PATH) && existsSync(BIN_PATH)) {
  try {
    const p = JSON.parse(readFileSync(PROG_PATH, "utf8"));
    const onDisk = Math.floor(statSync(BIN_PATH).size / ROW_BYTES);
    if (p.total === chunks.length && p.model === MODEL) {
      done = Math.min(p.done || 0, onDisk);
      if (done) console.log(`⏩ checkpoint mila — ${done.toLocaleString()} pehle se ho chuke, wahin se aage`);
    } else {
      console.log("⚠️  checkpoint purana/alag corpus ka hai — shuru se bana rahe hain");
    }
  } catch { /* ignore, shuru se */ }
}

const fd = openSync(BIN_PATH, done > 0 ? "r+" : "w");
const estTokens = chunks.slice(done).reduce((n, c) => n + c.text.length / 2.5, 0);
console.log(`⚡ baaki: ${(chunks.length - done).toLocaleString()} chunks`
  + ` | ~${(estTokens / 1e6).toFixed(2)}M tokens`
  + ` | ~${Math.round(estTokens / 1e6 * 1075).toLocaleString()} neurons`
  + ` (free: 10,000/din)\n`);

try {
  for (let i = done; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vecs = await embedBatch(slice.map(c => c.text));

    for (let j = 0; j < vecs.length; j++) {
      if (vecs[j].length !== DIM) {
        throw new Error(`dim mismatch: mila ${vecs[j].length}, chahiye ${DIM}`);
      }
      writeSync(fd, quantize(vecs[j]), 0, ROW_BYTES, (i + j) * ROW_BYTES);
    }

    const finished = Math.min(i + BATCH, chunks.length);
    writeFileSync(PROG_PATH, JSON.stringify({ done: finished, total: chunks.length, model: MODEL }));

    const pct = (finished / chunks.length * 100).toFixed(1);
    const rate = finished > done ? (finished - done) / ((Date.now() - t0) / 1000) : 0;
    const eta = rate ? Math.round((chunks.length - finished) / rate) : 0;
    process.stdout.write(`\r   ${pct.padStart(5)}%  ${finished.toLocaleString()}/${chunks.length.toLocaleString()}  •  ETA ${Math.floor(eta / 60)}m ${eta % 60}s   `);
  }
} catch (e) {
  closeSync(fd);
  const p = existsSync(PROG_PATH) ? JSON.parse(readFileSync(PROG_PATH, "utf8")) : { done: 0 };
  console.error(`\n\n❌ RUK GAYI — ${p.done.toLocaleString()}/${chunks.length.toLocaleString()} tak ho chuka tha.\n`);
  console.error(`   Wajah: ${e?.message || e}\n`);
  console.error(`   Checkpoint safe hai. Wahi command dobara chalao —`);
  console.error(`   ${p.done.toLocaleString()} se aage badhega, neurons dobara kharch nahi honge:\n`);
  console.error(`       node scripts/embed-corpus.mjs\n`);
  console.error(`   Baar-baar wahi error aaye toh upar wali "Wajah:" line bhej dena.\n`);
  process.exit(1);
}
closeSync(fd);

// index likho
writeFileSync(IDX_PATH, JSON.stringify({
  dim: DIM,
  count: chunks.length,
  quant: "int8",
  rowBytes: ROW_BYTES,
  model: MODEL,
  generatedAt: new Date().toISOString(),
  chunks: chunks.map(c => ({ id: c.id, book: c.book })),
}));

const mb = (statSync(BIN_PATH).size / 1048576).toFixed(1);
console.log(`\n\n✅ ho gaya — ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
console.log(`   vectors_int8.bin  ${mb} MB  (${chunks.length.toLocaleString()} x ${DIM}d int8)`);
console.log(`   chunk_index.json  v2`);
console.log(`\n   purani vectors.bin (26.5 MB) abhi bhi padi hai — client switch hone`);
console.log(`   ke baad use hata denge.\n`);
