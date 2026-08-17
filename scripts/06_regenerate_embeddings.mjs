/**
 * SAARTHI — Regenerate semantic-search embeddings (RUN THIS LOCALLY, NOT IN SANDBOX)
 * =====================================================================================
 * WHY THIS SCRIPT EXISTS
 * -----------------------
 * public/knowledge/embeddings/vectors.bin + chunk_index.json are the corpus
 * embeddings used by src/knowledge/semanticSearch.js. Whenever a book's JSON
 * file under public/knowledge/books/*.json changes (chunks added/removed/
 * edited), these two files go STALE and must be rebuilt from scratch —
 * otherwise semantic search either misses the new content or (worse) returns
 * wrong results due to row-index misalignment between vectors.bin and
 * chunk_index.json.
 *
 * This script can't be run inside the Claude sandbox that did the book-JSON
 * fixes: the ONNX model file under public/embed-model/.../model_quantized.onnx
 * is Git-LFS-tracked, and that sandbox's checkout only has the ~134-byte LFS
 * *pointer* file, not the real ~118MB binary (git-lfs isn't installed there).
 * On your own machine, `git lfs` resolves the pointer to the real file
 * automatically on clone/pull, so this script will work correctly there.
 *
 * HOW TO RUN
 * ----------
 *   cd saarthi
 *   node scripts/06_regenerate_embeddings.mjs
 *
 * Requires: @xenova/transformers (already in package.json — run `npm install`
 * first if you haven't). No network access needed; the model is read from
 * public/embed-model/ on disk.
 *
 * It rebuilds the embeddings for ALL books (not just the ones you changed) —
 * this is deliberate: a full rebuild guarantees vectors.bin and
 * chunk_index.json stay in lockstep, and it only takes a few minutes even
 * for ~18k chunks on a normal laptop CPU.
 *
 * After running, you'll see updated:
 *   public/knowledge/embeddings/vectors.bin
 *   public/knowledge/embeddings/chunk_index.json
 * Commit + push both alongside your book-JSON changes.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BOOKS_DIR = path.join(ROOT, "public", "knowledge", "books");
const EMBED_MODEL_BASE = path.join(ROOT, "public", "embed-model") + path.sep;
const OUT_DIR = path.join(ROOT, "data", "embeddings");
const VECTORS_OUT = path.join(OUT_DIR, "vectors.bin");
const INDEX_OUT = path.join(OUT_DIR, "chunk_index.json");

const MODEL_ID = "paraphrase-multilingual-MiniLM-L12-v2";

async function main() {
  console.log("== SAARTHI embedding regeneration ==");

  // Sanity-check: is the ONNX model a real binary or still an LFS pointer?
  const onnxPath = path.join(
    EMBED_MODEL_BASE,
    MODEL_ID,
    "onnx",
    "model_quantized.onnx"
  );
  if (!fs.existsSync(onnxPath)) {
    console.error(`ERROR: model file not found at ${onnxPath}`);
    console.error("Did you run `git lfs pull` / clone with LFS enabled?");
    process.exit(1);
  }
  const onnxSize = fs.statSync(onnxPath).size;
  if (onnxSize < 1_000_000) {
    console.error(
      `ERROR: ${onnxPath} is only ${onnxSize} bytes — this looks like an ` +
        "unresolved Git LFS pointer file, not the real model. Run:\n" +
        "  git lfs install\n  git lfs pull\nthen try again."
    );
    process.exit(1);
  }
  console.log(`Model OK (${(onnxSize / 1024 / 1024).toFixed(1)} MB): ${onnxPath}`);

  const { env, AutoTokenizer, AutoModel } = await import("@xenova/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = EMBED_MODEL_BASE;
  env.cacheDir = path.join(ROOT, ".embed-cache");

  console.log("Loading tokenizer + model (CPU, one-time load)...");
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  const model = await AutoModel.from_pretrained(MODEL_ID, { quantized: true });

  // Mean-pool + L2-normalize — MUST match src/knowledge/semanticSearch.js's
  // embedQuery() exactly, or query-time and corpus-time vectors won't be
  // comparable via dot-product.
  async function embed(text) {
    const inputs = await tokenizer(text, { padding: true, truncation: true });
    const output = await model(inputs);
    const hidden = output.last_hidden_state;
    const mask = inputs.attention_mask;
    const [, seq, dim] = hidden.dims;
    const data = hidden.data;
    const maskData = mask.data;
    const pooled = new Float32Array(dim);
    let count = 0;
    for (let t = 0; t < seq; t++) {
      if (Number(maskData[t]) === 1) {
        count++;
        const base = t * dim;
        for (let d = 0; d < dim; d++) pooled[d] += data[base + d];
      }
    }
    const denom = Math.max(count, 1);
    for (let d = 0; d < dim; d++) pooled[d] /= denom;
    let norm = 0;
    for (let d = 0; d < dim; d++) norm += pooled[d] * pooled[d];
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dim; d++) pooled[d] /= norm;
    return pooled;
  }

  const bookFiles = fs
    .readdirSync(BOOKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  console.log(`Found ${bookFiles.length} book files in ${BOOKS_DIR}`);

  const allChunks = [];
  for (const f of bookFiles) {
    const full = path.join(BOOKS_DIR, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(full, "utf-8"));
    } catch (e) {
      console.warn(`  SKIP ${f}: invalid JSON (${e.message})`);
      continue;
    }
    const chunks = data.chunks || [];
    for (const c of chunks) {
      if (!c.text || !c.text.trim()) continue;
      allChunks.push({ id: c.id, book: c.book || data.book, text: c.text });
    }
  }
  console.log(`Total chunks to embed: ${allChunks.length}`);

  let dim = null;
  const vectorParts = [];
  const indexChunks = [];
  const startTime = Date.now();

  for (let i = 0; i < allChunks.length; i++) {
    const c = allChunks[i];
    const vec = await embed(c.text);
    if (dim === null) dim = vec.length;
    vectorParts.push(vec);
    indexChunks.push({ id: c.id, book: c.book });

    if ((i + 1) % 200 === 0 || i === allChunks.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = (allChunks.length - i - 1) / rate;
      console.log(
        `  ${i + 1}/${allChunks.length} embedded ` +
          `(${rate.toFixed(1)}/s, ETA ${Math.round(eta)}s)`
      );
    }
  }

  // Flatten into one big Float32Array and write as raw binary — must match
  // the layout semanticSearch.js expects: row-major, count x dim.
  const flat = new Float32Array(allChunks.length * dim);
  for (let i = 0; i < vectorParts.length; i++) {
    flat.set(vectorParts[i], i * dim);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(VECTORS_OUT, Buffer.from(flat.buffer));
  fs.writeFileSync(
    INDEX_OUT,
    JSON.stringify({ dim, count: allChunks.length, chunks: indexChunks })
  );

  console.log("== Done ==");
  console.log(`vectors.bin: ${VECTORS_OUT} (${flat.byteLength} bytes)`);
  console.log(`chunk_index.json: ${INDEX_OUT} (${allChunks.length} chunks, dim=${dim})`);
  console.log("Now git add + commit + push both files.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
