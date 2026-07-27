/**
 * SAARTHI — Real semantic (meaning-based) search
 * =================================================
 * FIX (2026-07-26, audit follow-up): engine.js's keywordSearch only ever
 * did exact/substring text matching — `meta.json` claimed "768-dim
 * embeddings" but every chunk's embedding was actually `null` (see the old
 * comment in engine.js: "semanticSearch + cosine similarity code HATA DIYA
 * ... sabhi chunks mein embedding = null tha"). Isliye paraphrased/
 * conceptual sawaal (jaise "family mein ego kaise kam karein" jab corpus
 * mein "ahankar" shabd ho, "ego" nahi) weak/wrong results dete the.
 *
 * Yeh file ASLI fix hai — poori tarah client-side (no backend, matches the
 * rest of SAARTHI's architecture):
 *   - Model: Xenova/paraphrase-multilingual-MiniLM-L12-v2 (ONNX, quantized,
 *     384-dim, Hindi+English dono samajhta hai) — self-hosted under
 *     /public/embed-model/ (NOT fetched from Hugging Face/jsdelivr at
 *     runtime, taaki koi bhi corporate/school network jahan woh CDNs block
 *     hon, wahan bhi kaam kare).
 *   - Corpus embeddings: sabhi 23,425 chunks ke liye pehle se generate
 *     (offline, ek-baar ka Python job) — /public/knowledge/embeddings/
 *     vectors.bin (raw Float32, 23425 x 384) + chunk_index.json (row → id/book)
 *   - Runtime: user ka sawaal isi model se embed hota hai (browser mein,
 *     lazy — pehli baar zaroorat padne par load hota hai, phir cache
 *     ho jaata hai), phir cosine-similarity se corpus ke saath compare.
 *
 * FAIL-SOFT BY DESIGN: model/vectors load na ho paayein (slow network,
 * browser incompatibility, etc.) toh semanticSearch() khaali array deta
 * hai — caller (ChatView.retrieveContext) hamesha iske saath keywordSearch
 * bhi chalata hai, jo isके bina bhi pehle jaisa hi kaam karta hai. Yeh
 * feature ek ENHANCEMENT hai, single-point-of-failure nahi.
 */

const MODEL_ID = "paraphrase-multilingual-MiniLM-L12-v2";
const EMBED_MODEL_BASE = "/embed-model/";
const WASM_BASE = "/ort-wasm/";
const VECTORS_URL = "/knowledge/embeddings/vectors.bin";
const INDEX_URL = "/knowledge/embeddings/chunk_index.json";

let _pipelinePromise = null;
let _vectorsPromise = null;
let _ready = false;

async function loadPipeline() {
  if (_pipelinePromise) return _pipelinePromise;
  _pipelinePromise = (async () => {
    const { env, AutoTokenizer, AutoModel } = await import("@xenova/transformers");
    // Self-hosted only — never hit huggingface.co/jsdelivr at runtime.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = EMBED_MODEL_BASE;
    env.useBrowserCache = true;
    env.backends.onnx.wasm.wasmPaths = WASM_BASE;
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    const model = await AutoModel.from_pretrained(MODEL_ID, { quantized: true });
    return { tokenizer, model };
  })();
  return _pipelinePromise;
}

async function loadVectors() {
  if (_vectorsPromise) return _vectorsPromise;
  _vectorsPromise = (async () => {
    const [vecRes, idxRes] = await Promise.all([fetch(VECTORS_URL), fetch(INDEX_URL)]);
    if (!vecRes.ok) throw new Error(`vectors.bin HTTP ${vecRes.status}`);
    if (!idxRes.ok) throw new Error(`chunk_index.json HTTP ${idxRes.status}`);
    const [buf, index] = await Promise.all([vecRes.arrayBuffer(), idxRes.json()]);
    const vectors = new Float32Array(buf);
    if (vectors.length !== index.count * index.dim) {
      throw new Error("vectors.bin size mismatch with chunk_index.json");
    }
    return { vectors, dim: index.dim, count: index.count, chunks: index.chunks };
  })();
  return _vectorsPromise;
}

/**
 * Background warmup — call once (e.g. when ChatView mounts) so the first
 * real search doesn't pay the full load-time cost. Safe to call multiple
 * times; safe to ignore its result (errors are swallowed, logged only).
 */
export async function preloadSemanticSearch() {
  try {
    await Promise.all([loadPipeline(), loadVectors()]);
    _ready = true;
  } catch (e) {
    console.warn("[SemanticSearch] preload failed — keyword search will still work:", e);
  }
}

export function isSemanticSearchReady() {
  return _ready;
}

// Mean-pooling over token embeddings (masked), then L2-normalize — EXACT
// same scheme used to generate the offline corpus vectors (verified to
// produce identical scores in a Python↔JS cross-check before shipping).
async function embedQuery(text) {
  const { tokenizer, model } = await loadPipeline();
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

/**
 * Real meaning-based search over the full corpus.
 * @param {string} query
 * @param {number} k
 * @param {string|null} filterBook  restrict to one book's chunks only
 * @returns {Promise<{id: string, book: string, score: number}[]>}
 *          Empty array on any failure — always fail-soft, never throws.
 */
export async function semanticSearch(query, k = 10, filterBook = null) {
  if (!query || !query.trim()) return [];
  try {
    const [qv, { vectors, dim, chunks }] = await Promise.all([
      embedQuery(query),
      loadVectors(),
    ]);
    const n = chunks.length;
    const scored = [];
    for (let i = 0; i < n; i++) {
      const meta = chunks[i];
      if (filterBook && meta.book !== filterBook) continue;
      const off = i * dim;
      let dot = 0;
      for (let d = 0; d < dim; d++) dot += qv[d] * vectors[off + d];
      scored.push({ id: meta.id, book: meta.book, score: dot });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  } catch (e) {
    console.warn("[SemanticSearch] search failed, keyword-only fallback used:", e);
    return [];
  }
}
