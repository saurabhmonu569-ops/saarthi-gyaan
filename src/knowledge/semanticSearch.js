/**
 * SAARTHI — Real semantic (meaning-based) search
 * =================================================
 * AUDIT REWRITE (2026-08-01) — item #16
 *
 * PICHLI HAALAT (kyun poora badalna pada):
 * Yeh file pehle browser mein hi ONNX model chalati thi
 * (paraphrase-multilingual-MiniLM-L12-v2). Par audit mein pata chala ki
 * `public/embed-model/.../model_quantized.onnx` asal mein model tha hi
 * NAHI — woh 134-byte ka Git LFS pointer tha (asli file 118 MB, LFS mein
 * padi rahi, kabhi fetch nahi hui). Model load fail hota tha, catch block
 * chup-chaap [] laut deta tha, aur poori app mahino se sirf keyword
 * (Devanagari substring) search par chal rahi thi.
 *
 * Yehi ek baat user ki teeno shikayaton ki jad thi:
 *   - "har jawab mein wahi 4-5 granth aate hain"
 *   - "sabhi 24 books ko padhta nahi hai"
 *   - "OCR error" jaise sawaal par bhi Ramayana cite ho jaata tha
 *
 * NAYA DESIGN:
 *   - Query ka embedding ab CLOUDFLARE WORKERS AI par banta hai
 *     (@cf/baai/bge-m3, 1024-dim, multilingual — Hindi mein kaafi majboot).
 *     Client par koi model nahi. 118 MB model + 16 MB tokenizer + 10 MB
 *     wasm — teeno hata diye.
 *   - Corpus vectors pehle jaise hi pre-computed hain, par ab int8 mein:
 *     26.5 MB → 18.4 MB. (Quantization ka nuksaan naapa gaya:
 *     self-cosine 0.9997 — na ke barabar.)
 *   - Pehli visit ka download: ~171 MB → ~18.4 MB.
 *
 * FAIL-LOUD (audit ka sabse bada sabak):
 * Purana code fail-SOFT tha — isliye ek toota hua system mahino tak kisi
 * ko dikha nahi. Ab bhi search fail hone par app chalti rehti hai
 * (keyword search sambhal leta hai), LEKIN failure ab console.error se
 * chillati hai aur getSemanticStatus() se bahar dikhti hai. Chup-chaap
 * degrade hona dobara nahi hoga.
 *
 * BIN FORMAT (vectors_int8.bin) — har row 1028 bytes:
 *   [0..3]     float32  scale
 *   [4..1027]  int8 x1024
 *   asli value = int8 / 127 * scale
 */

const VECTORS_URL = "/knowledge/embeddings/vectors_int8.bin";
const INDEX_URL   = "/knowledge/embeddings/chunk_index.json";
const DIM         = 1024;
const ROW_BYTES   = 4 + DIM;

const AI_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");

let _corpusPromise = null;
let _ready  = false;
let _status = { ready: false, reason: "not-started", count: 0 };

// Ek hi sawaal baar-baar (retry, follow-up) — dobara embed mat karao.
const _queryCache = new Map();
const QUERY_CACHE_MAX = 50;

/**
 * Corpus vectors load karo aur speed ke liye do alag typed arrays mein
 * baant do: scales (Float32) aur quantized values (Int8, contiguous).
 * Ek baar ka O(n) kharcha, badle mein hot loop cache-friendly ho jaata hai.
 */
async function loadCorpus() {
  if (_corpusPromise) return _corpusPromise;
  _corpusPromise = (async () => {
    const [vecRes, idxRes] = await Promise.all([fetch(VECTORS_URL), fetch(INDEX_URL)]);
    if (!vecRes.ok) throw new Error(`vectors_int8.bin HTTP ${vecRes.status}`);
    if (!idxRes.ok) throw new Error(`chunk_index.json HTTP ${idxRes.status}`);

    const [buf, index] = await Promise.all([vecRes.arrayBuffer(), idxRes.json()]);

    if (index.dim !== DIM) {
      throw new Error(`dim mismatch: index kehta hai ${index.dim}, code ${DIM} maanta hai`);
    }
    if (index.quant !== "int8") {
      throw new Error(`quant mismatch: mila "${index.quant}", chahiye "int8" — chunk_index.json purana hai? scripts/embed-corpus.mjs chalao`);
    }
    const expected = index.count * ROW_BYTES;
    if (buf.byteLength !== expected) {
      throw new Error(`vectors_int8.bin ka size galat: ${buf.byteLength} bytes, ${expected} chahiye the`);
    }

    const raw    = new Int8Array(buf);
    const view   = new DataView(buf);
    const n      = index.count;
    const scales = new Float32Array(n);
    const q      = new Int8Array(n * DIM);

    for (let i = 0; i < n; i++) {
      scales[i] = view.getFloat32(i * ROW_BYTES, true);
      q.set(raw.subarray(i * ROW_BYTES + 4, i * ROW_BYTES + 4 + DIM), i * DIM);
    }

    return { scales, q, count: n, chunks: index.chunks, model: index.model };
  })();
  return _corpusPromise;
}

/** Sawaal ka vector Worker se laao (client par koi model nahi hai). */
async function embedQuery(text) {
  const key = text.trim().toLowerCase();
  if (_queryCache.has(key)) return _queryCache.get(key);

  if (!AI_PROXY_URL) throw new Error("VITE_AI_PROXY_URL set nahi hai");

  const res = await fetch(`${AI_PROXY_URL}/embed`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`/embed HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  const j = await res.json();
  const vec = j?.vectors?.[0];
  if (!Array.isArray(vec) || vec.length !== DIM) {
    throw new Error(`/embed ne galat shape diya: ${vec ? vec.length : "null"}`);
  }

  // L2-normalize — corpus vectors bhi normalized hain, isliye dot product
  // seedha cosine similarity ban jaata hai.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  const qv = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) qv[i] = vec[i] / norm;

  if (_queryCache.size >= QUERY_CACHE_MAX) {
    _queryCache.delete(_queryCache.keys().next().value);
  }
  _queryCache.set(key, qv);
  return qv;
}

/**
 * Background warmup — ChatView mount par ek baar bulao taaki pehla asli
 * search poora load-time na jhele. Baar-baar bulana safe hai.
 */
export async function preloadSemanticSearch() {
  try {
    const c = await loadCorpus();
    _ready  = true;
    _status = { ready: true, reason: "ok", count: c.count, model: c.model };
    console.log(`[SemanticSearch] ready — ${c.count.toLocaleString()} vectors (${c.model})`);
  } catch (e) {
    _ready  = false;
    _status = { ready: false, reason: String(e?.message || e), count: 0 };
    // FAIL-LOUD: purana code yahan console.warn karta tha aur system
    // mahino tak toota pada raha. Ab .error — dabana nahi hai.
    console.error("[SemanticSearch] ❌ LOAD FAILED — semantic search band hai, "
      + "sirf keyword search chalega. Wajah:", e);
  }
}

export function isSemanticSearchReady() {
  return _ready;
}

/** Diagnostics — UI ya console se poocha ja sake ki search zinda hai ya nahi. */
export function getSemanticStatus() {
  return { ..._status };
}

/**
 * Jhooti citations ka asli ilaaj (item #17).
 *
 * Cosine sirf itna bata sakta hai ki query aur passage "ek jaise dikhte
 * hain" — kyunki dono alag-alag embed hote hain. Cross-encoder reranker
 * dono ko EK SAATH padhta hai aur asli sawaal ka jawab deta hai: "kya yeh
 * passage is sawaal ka jawab deta hai?"
 *
 * NAAPA HUA FARAK (2026-08-03, 13 sawaal):
 *     cosine     sahi-min 0.4941  kachra-max 0.4882  gap +0.0059
 *     reranker   sahi-min 0.9009  kachra-max 0.0131  gap +0.8878
 * Reranker ka score bimodal hai — ya 0.90+, ya lagbhag 0.
 *
 * FAIL-SOFT PAR SOCH-SAMAJH KE: rerank fail ho jaye toh null lautate hain,
 * aur caller passages ko BINA citation ke istemal karta hai. Yaani network
 * fail hone par app chalti rehti hai, par jhoothi citation kabhi nahi
 * jaati — failure ka natija "kam bharosa" hai, "galat bharosa" nahi.
 *
 * @param {string} query        Devanagari-normalized sawaal
 * @param {string[]} passages   candidate texts (max 20)
 * @returns {Promise<number[]|null>}  har passage ka 0..1 score, usi kram mein
 */
export async function rerankPassages(query, passages) {
  if (!query?.trim() || !passages?.length) return null;
  if (!AI_PROXY_URL) return null;
  try {
    const res = await fetch(`${AI_PROXY_URL}/rerank`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ query, contexts: passages.slice(0, 20) }),
    });
    if (!res.ok) throw new Error(`/rerank HTTP ${res.status}`);
    const j = await res.json();
    if (!Array.isArray(j?.scores) || j.scores.length !== Math.min(passages.length, 20)) {
      throw new Error("scores shape mismatch");
    }
    return j.scores;
  } catch (e) {
    console.warn("[Rerank] failed — passages bina citation ke istemal honge:", e);
    return null;
  }
}

/**
 * Meaning-based search poore corpus par.
 *
 * @param {string} query
 * @param {number} k          kitne results
 * @param {string|null} filterBook  sirf ek granth tak seemit
 * @param {number|null} minScore    absolute cosine floor. null = koi filter
 *                                  nahi (default). Phase B mein naape hue
 *                                  number se set hoga — tabhi "kuch
 *                                  relevant nahi mila" honestly keh payenge.
 * @returns {Promise<{id:string, book:string, score:number}[]>}
 *          Fail hone par khaali array — kabhi throw nahi karta.
 */
export async function semanticSearch(query, k = 10, filterBook = null, minScore = null) {
  if (!query || !query.trim()) return [];
  try {
    const [qv, { scales, q, count, chunks }] = await Promise.all([
      embedQuery(query),
      loadCorpus(),
    ]);

    const scored = [];
    for (let i = 0; i < count; i++) {
      const meta = chunks[i];
      if (filterBook && meta.book !== filterBook) continue;

      const off = i * DIM;
      let dot = 0;
      for (let d = 0; d < DIM; d++) dot += q[off + d] * qv[d];
      // int8 → asli paimana: (q/127 * scale) ka dot, yaani dot * scale / 127
      const score = dot * scales[i] / 127;

      if (minScore != null && score < minScore) continue;
      scored.push({ id: meta.id, book: meta.book, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  } catch (e) {
    _ready  = false;
    _status = { ready: false, reason: String(e?.message || e), count: 0 };
    console.error("[SemanticSearch] ❌ search failed — keyword-only fallback:", e);
    return [];
  }
}
