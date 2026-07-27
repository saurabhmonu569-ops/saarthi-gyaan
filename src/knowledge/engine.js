/**
 * SAARTHI v2 — Knowledge Engine
 * Browser Retrieval Layer
 *
 * Loads knowledge.json at startup.
 * Supports:
 *   - Keyword search (instant, no API)
 *   - Semantic search (cosine similarity over stored embeddings)
 *   - Filtered search (by book, tradition, chapter)
 *   - Cross-book search
 *   - Structured navigation (book → chapter → verse)
 *
 * Future: swap retrieveChunks() for an API call to Supabase pgvector
 * WITHOUT changing any caller code.
 */

// ── Types (JSDoc for non-TypeScript projects) ─────────────────────────────────
/**
 * @typedef {Object} Chunk
 * @property {string}   id
 * @property {string}   book
 * @property {string}   book_title
 * @property {string}   tradition
 * @property {number}   page
 * @property {number|null} chapter
 * @property {string|null} chapter_title
 * @property {number|null} section
 * @property {number|null} verse
 * @property {string}   language
 * @property {string}   text
 * @property {number}   word_count
 * @property {number}   confidence
 * @property {number[]|null} embedding
 */

/**
 * @typedef {Object} SearchResult
 * @property {Chunk}    chunk
 * @property {number}   score       0-1 relevance score
 * @property {string}   match_type  "semantic"|"keyword"|"structural"
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _knowledge = null;          // full knowledge store
let _bookIndex = new Map();     // book_id → Chunk[]
let _chapterIndex = new Map();  // "book_id::ch3" → Chunk[]
let _wordIndex = null;          // keyword search index (lazy loaded)
let _indexKeys = null;          // Object.keys(_wordIndex) cache — substring search ke liye
let _loaded = false;
let _loading = null;            // in-flight promise (dedup concurrent loads)

const KNOWLEDGE_BASE = "/knowledge";
const KNOWLEDGE_URL  = `${KNOWLEDGE_BASE}/knowledge.json`;
const SEARCH_URL     = `${KNOWLEDGE_BASE}/search_manifest.json`;

// ── Loader ────────────────────────────────────────────────────────────────────

async function _fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.json();
}

/**
 * Load the knowledge store. LIVE FORMAT pehle (split-v1: meta.json +
 * 13 book files + 8 index shards — sab PARALLEL, koi file 25MB+ nahi,
 * hosting gzip ke saath ~4-5x chhota wire size). Na mile toh purana
 * single-file format (local dev). Idempotent — safe to call multiple times.
 * @returns {Promise<boolean>} true if loaded successfully
 */
export async function loadKnowledge() {
  if (_loaded) return true;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      let usedFormat = "legacy";
      try {
        // ── NAYA split-v1 format (scripts/05_split_knowledge.py se bana) ──
        const meta = await _fetchJson(`${KNOWLEDGE_BASE}/meta.json`);
        if (meta.format !== "split-v1") throw new Error("unknown meta format");
        const [bookFiles, shards] = await Promise.all([
          Promise.all(meta.books.map(b => _fetchJson(`${KNOWLEDGE_BASE}/books/${b}.json`))),
          Promise.all(Array.from({ length: meta.index_shards },
            (_, i) => _fetchJson(`${KNOWLEDGE_BASE}/index/shard_${i}.json`))),
        ]);
        _knowledge = {
          version:      meta.version,
          schema:       meta.schema,
          embed_model:  meta.embed_model,
          embed_dim:    meta.embed_dim,
          total_chunks: meta.total_chunks,
          chunks:       bookFiles.flatMap(f => f.chunks),
        };
        _wordIndex = Object.assign({}, ...shards.map(s => s.keyword_index || {}));
        usedFormat = "split-v1";
      } catch {
        // ── PURANA single-file format (local dev fallback) ──
        const [kResp, sResp] = await Promise.all([
          fetch(KNOWLEDGE_URL),
          fetch(SEARCH_URL),
        ]);
        if (!kResp.ok) throw new Error(`Knowledge store HTTP ${kResp.status}`);
        _knowledge = await kResp.json();
        if (sResp.ok) {
          const sm = await sResp.json();
          _wordIndex = sm.keyword_index || {};
        }
      }

      // Build in-memory indices (dono formats ke liye same)
      for (const chunk of _knowledge.chunks) {
        // Book index
        if (!_bookIndex.has(chunk.book)) {
          _bookIndex.set(chunk.book, []);
        }
        _bookIndex.get(chunk.book).push(chunk);

        // Chapter index
        if (chunk.chapter != null) {
          const key = `${chunk.book}::ch${chunk.chapter}`;
          if (!_chapterIndex.has(key)) _chapterIndex.set(key, []);
          _chapterIndex.get(key).push(chunk);
        }
      }

      _loaded = true;
      console.log(
        `[KnowledgeEngine] Loaded ${_knowledge.total_chunks} chunks ` +
        `from ${_bookIndex.size} books (${usedFormat})`
      );
      return true;
    } catch (err) {
      console.error("[KnowledgeEngine] Load failed:", err);
      _loaded = false;
      _loading = null;
      return false;
    }
  })();

  return _loading;
}

// ── Utilities ──────────────────────────────────────────────────────────────────
// (dot/norm/cosine hataye — corpus mein embeddings hain hi nahi, dead code tha)

// English/Hinglish → Devanagari transliteration for common spiritual terms.
// Value ek string YA array ho sakti hai — array = kai Hindi roop match honge.
// (Duplicates saaf kiye — pehle sita/shiva/fear waghera do-do baar the.)
const TRANSLIT = {
  // ── Core concepts ──
  "dharma": "धर्म",   "duty": "धर्म",
  "karma": "कर्म",    "action": "कर्म",
  "yoga": "योग",
  "moksha": "मोक्ष",  "liberation": "मोक्ष", "salvation": "मोक्ष",
  "atman": "आत्मा",   "atma": "आत्मा", "aatma": "आत्मा", "soul": "आत्मा",
  "brahman": "ब्रह्म", "brahma": "ब्रह्म",
  "bhakti": "भक्ति",  "devotion": "भक्ति",
  "maya": "माया",     "samsara": "संसार", "nirvana": "निर्वाण",
  "ahimsa": "अहिंसा", "sankhya": "सांख्य", "shastra": "शास्त्र",
  "meditation": "ध्यान", "dhyan": "ध्यान",
  "gyan": "ज्ञान",    "knowledge": "ज्ञान", "wisdom": "ज्ञान",
  "truth": "सत्य",    "satya": "सत्य",
  // ── Granth / log ──
  "gita": "गीता",     "geeta": "गीता",
  "ramayana": "रामायण", "vedas": "वेद", "veda": "वेद", "upanishad": "उपनिषद",
  // FIX (2026-07-24 autopsy): Veda/Purana ke Roman naam corpus ke Devanagari
  // text se kabhi match nahi karte the ("Atharvaveda"/"Yajurveda" jaisa Latin
  // shabd kisi bhi Devanagari chunk mein literally nahi hota) — isliye in
  // granthon ke baare mein poochha gaya sawaal keyword-search mein 0 result
  // deta tha, aur AI "seedha ullekh nahi mila" bol kar anjaan books cite kar
  // deta tha. Ab har Veda/Purana ka Roman naam apne Devanagari roop se juda hai.
  "yajurveda": "यजुर्वेद", "yajurved": "यजुर्वेद",
  "atharvaveda": "अथर्ववेद", "atharv": "अथर्ववेद", "atharva": "अथर्ववेद",
  "rigveda": "ऋग्वेद", "rigved": "ऋग्वेद",
  "samaveda": "सामवेद", "samved": "सामवेद",
  "purana": "पुराण", "puran": "पुराण", "puranas": "पुराण",
  "narsimha": "नरसिंह", "narasimha": "नरसिंह",
  "bhavishya": "भविष्य", "ekadashi": "एकादशी", "mahatmya": "महात्म्य",
  "kathopanishad": "कठोपनिषद", "ishadi": "ईशादि",
  "rama": "राम",      "ram": "राम",
  "krishna": "कृष्ण", "arjuna": "अर्जुन", "arjun": "अर्जुन",
  "shiva": "शिव",     "shiv": "शिव", "vishnu": "विष्णु",
  "lakshmi": "लक्ष्मी", "hanuman": "हनुमान", "ganesh": "गणेश",
  "sita": "सीता",     "ravan": "रावण", "yamraj": "यमराज",
  "garud": "गरुड",    "garuda": "गरुड", "indra": "इंद्र", "som": "सोम",
  "guru": "गुरु",     "teacher": "गुरु", "god": "भगवान", "bhagwan": "भगवान",
  "ishwar": "ईश्वर",
  // ── Bhaavnaayein (multi-roop) ──
  "fear": ["भय", "डर"],       "bhay": "भय", "dar": "डर",
  "anger": "क्रोध",           "krodh": "क्रोध", "gussa": "क्रोध",
  "peace": "शांति",           "shanti": "शांति",
  "love": "प्रेम",            "prem": "प्रेम",
  "death": ["मृत्यु", "मौत"], "mrityu": "मृत्यु", "maut": "मौत",
  "happiness": ["आनंद", "सुख"], "anand": "आनंद", "sukh": "सुख",
  "sadness": ["शोक", "दुख"],  "udaas": "शोक", "dukh": "दुख",
  "stress": "चिंता",          "chinta": "चिंता", "tanav": "तनाव",
  "hope": "आशा",              "asha": "आशा",
  "doubt": "संदेह",           "sandeh": "संदेह",
  "courage": "साहस",          "sahas": "साहस",
  "patience": "धैर्य",        "dhairya": "धैर्य",
  "jealousy": "ईर्ष्या",      "greed": "लोभ", "lobh": "लोभ",
  "attachment": "मोह",        "moh": "मोह",
  "ego": ["अहंकार", "गर्व"],  "ahankar": "अहंकार", "pride": "गर्व",
  "desire": ["इच्छा", "कामना"], "iccha": "इच्छा",
  "mind": "मन",               "man": "मन",
  // ── Jeevan ──
  "life": "जीवन",    "jeevan": "जीवन", "world": ["संसार", "जगत"],
  "marriage": "विवाह", "vivah": "विवाह", "family": "परिवार", "parivar": "परिवार",
  "mother": "माता",  "father": "पिता", "son": "पुत्र", "wife": "पत्नी",
  "friend": "मित्र", "dost": "मित्र", "enemy": "शत्रु", "dushman": "शत्रु",
  "king": "राजा",    "raja": "राजा", "war": "युद्ध", "yuddh": "युद्ध",
  "victory": ["विजय", "जीत"], "vijay": "विजय", "defeat": "पराजय",
  "money": "धन",     "dhan": "धन", "wealth": "धन", "santan": "संतान",
  "body": "शरीर",    "heart": "हृदय", "sleep": "निद्रा",
  "dream": "स्वप्न", "swapna": "स्वप्न", "food": "अन्न", "water": "जल",
  "time": ["समय", "काल"], "samay": "समय",
  // ── Prakriti ──
  "fire": ["अग्नि", "आग"], "agni": "अग्नि", "sun": "सूर्य", "surya": "सूर्य",
  "moon": "चंद्र",   "chandra": "चंद्र", "earth": "पृथ्वी", "prithvi": "पृथ्वी",
  "sky": "आकाश",     "akash": "आकाश",
  // ── Aadhyatmik karm ──
  "worship": "पूजा", "puja": "पूजा", "pooja": "पूजा",
  "prayer": "प्रार्थना", "mantra": "मंत्र", "tapasya": "तपस्या",
  "vrat": "व्रत",    "yagya": "यज्ञ", "yagna": "यज्ञ", "sacrifice": ["यज्ञ", "त्याग"],
  "tyag": "त्याग",   "charity": "दान", "daan": "दान",
  "seva": "सेवा",    "daya": "दया", "compassion": "करुणा",
  "forgiveness": "क्षमा", "kshama": "क्षमा", "kripa": "कृपा",
  "faith": ["श्रद्धा", "विश्वास"], "vishwas": "विश्वास",
  "sin": "पाप",      "paap": "पाप", "punya": "पुण्य",
  "heaven": "स्वर्ग", "swarg": "स्वर्ग", "hell": "नरक", "narak": "नरक",
  "sankat": "संकट",  "santosh": "संतोष", "shakti": "शक्ति", "strength": ["बल", "शक्ति"],
  "bojh": "भार",     "bhaari": "भार", "akela": "एकांत",
  // ── EMOTION/INTENT search (audit: "I am afraid" bhi chalna chahiye, sirf "Fear" nahi) ──
  "afraid": ["भय", "डर"],   "scared": ["भय", "डर"], "darr": "डर",
  "worried": "चिंता",       "anxiety": "चिंता", "tension": "चिंता", "pareshan": "चिंता",
  "depression": ["शोक", "दुख"], "depressed": ["शोक", "दुख"], "dukhi": "दुख",
  "lonely": "एकांत",        "alone": "एकांत", "akelapan": "एकांत",
  "guilt": ["पाप", "क्षमा"], "jealous": "ईर्ष्या",
  "failure": "पराजय",       "asafalta": "पराजय", "fail": "पराजय",
  "success": ["विजय", "सिद्धि"], "safalta": ["विजय", "सिद्धि"],
  "motivation": ["साहस", "उत्साह"], "himmat": "साहस", "lazy": "आलस्य", "aalas": "आलस्य",
  "confused": ["संदेह", "बुद्धि"], "decision": "बुद्धि",
  "purpose": ["धर्म", "जीवन"], "meaning": ["धर्म", "जीवन"],
  "sleep": "निद्रा",        "neend": "निद्रा", "insomnia": "निद्रा",
  "husband": "पति",         "pati": "पति", "wifey": "पत्नी", "patni": "पत्नी",
  "shaadi": "विवाह",        "children": ["पुत्र", "संतान"], "bachche": "संतान",
  "parents": ["माता", "पिता"], "job": "कर्म", "career": "कर्म", "naukri": "कर्म",
  "exam": "परीक्षा",        "pariksha": "परीक्षा", "padhai": ["विद्या", "ज्ञान"],
  "confidence": ["साहस", "विश्वास"], "atmavishwas": "विश्वास",
  "addiction": ["मोह", "आसक्ति"], "lat": "आसक्ति", "aadat": ["मोह", "आसक्ति"],
  "worthless": ["आत्मा", "शोक"], "useless": ["आत्मा", "शोक"], "hopeless": ["आशा", "शोक"],
  "health": ["रोग", "औषधि"], "illness": "रोग", "disease": "रोग", "bimari": "रोग",
  "paisa": "धन",            "bharosa": "विश्वास",
  // ── JYOTISH pack (Lal Kitab + Rashi-Muhurt books ke liye) ──
  "rashi": "राशि",          "horoscope": "राशि", "kundali": ["कुंडली", "कुण्डली"],
  "astrology": "ज्योतिष",   "muhurt": "मुहूर्त", "muhurat": "मुहूर्त",
  "mesh": "मेष",            "aries": "मेष",
  "vrishabh": "वृषभ",       "taurus": "वृषभ",
  "mithun": "मिथुन",        "gemini": "मिथुन",
  "kark": "कर्क",           "cancer": "कर्क",
  "singh": "सिंह",          "leo": "सिंह",
  "kanya": "कन्या",         "virgo": "कन्या",
  "tula": "तुला",           "libra": "तुला",
  "vrishchik": "वृश्चिक",   "scorpio": "वृश्चिक",
  "dhanu": "धनु",           "sagittarius": "धनु",
  "makar": "मकर",           "capricorn": "मकर",
  "kumbh": ["कुंभ", "कुम्भ"], "aquarius": ["कुंभ", "कुम्भ"],
  "meen": "मीन",            "pisces": "मीन",
  "grah": "ग्रह",           "planet": "ग्रह",
  "shani": "शनि",           "saturn": "शनि",
  "mangal": "मंगल",         "mars": "मंगल",
  "rahu": "राहु",           "ketu": "केतु",
  "budh": "बुध",            "shukra": "शुक्र", "venus": "शुक्र",
  "brihaspati": "बृहस्पति", "jupiter": ["गुरु", "बृहस्पति"],
  // ── Upanishad/katha ke paatra + prasiddh naam ──
  "nachiketa": ["नचिकेता", "नचिकेत"], "nachiketas": ["नचिकेता", "नचिकेत"],
  "yamraj": "यमराज", "prahlad": "प्रह्लाद", "prahlada": "प्रह्लाद",
  "dhruv": "ध्रुव", "bharat": "भरत", "lakshman": "लक्ष्मण", "laxman": "लक्ष्मण",
  "kaikeyi": "कैकेयी", "dashrath": "दशरथ", "dasharath": "दशरथ",
  "vibhishan": "विभीषण", "sugriv": "सुग्रीव", "bali": "बालि",
  "draupadi": "द्रौपदी", "yudhishthir": "युधिष्ठिर",
  "ishavasya": "ईशावास्य", "isha": "ईशावास्य",
  "nanak": "नानक", "chanakya": "चाणक्य", "kabir": "कबीर",
  "valmiki": "वाल्मीकि", "vyas": "व्यास", "leadership": ["नेतृत्व", "राजा"],
};

/** Extract keywords from a query string, with English→Hindi transliteration */
function queryKeywords(query) {
  const STOP = new Set(
    "का के की को कि में से और पर यह जो है ने भी एक था the a an is in of to and or for with on at by".split(" ")
  );
  // BUG FIX: pehle {3,} tha \u2014 user ka seedha type kiya "\u092D\u092F"/"\u092E\u0928"/"\u0921\u0930" (2 akshar)
  // regex mein hi kat jaata tha. Devanagari ke liye 2+, Latin ke liye 3+.
  const raw = [...query.toLowerCase().matchAll(/[\u0900-\u097F]{2,}|[a-zA-Z]{3,}/g)]
    .map(m => m[0])
    .filter(w => !STOP.has(w));

  // Expand: add Devanagari equivalents for English/Hinglish spiritual terms
  // (value string ya array — dono handle karo)
  const expanded = [];
  for (const w of raw) {
    expanded.push(w);
    const hindi = TRANSLIT[w];
    if (hindi) {
      if (Array.isArray(hindi)) expanded.push(...hindi);
      else expanded.push(hindi);
    }
  }
  return expanded;
}

// ── Search API ─────────────────────────────────────────────────────────────────

/**
 * Keyword search over pre-built index.
 * Fast, no embedding needed. Fallback when semantic search unavailable.
 *
 * @param {string} query
 * @param {Object} filters  { book?: string, tradition?: string, chapter?: number }
 * @param {number} limit
 * @returns {SearchResult[]}
 */
export function keywordSearch(query, filters = {}, limit = 10) {
  if (!_loaded || !_wordIndex) return [];

  const keywords = queryKeywords(query);
  if (!keywords.length) return [];

  // Score: count of matching keywords that reference the chunk.
  // ZAROORI: index mein shabd jude hue roop mein hain ("भयसे", "भयके",
  // "भयभीत") — akela "भय" index mein NAHI hai. Isliye exact match na mile
  // toh substring match karo, warna "Fear"/"भय" jaise queries 0 result dete.
  // PRAMAAN-FIX (beta feedback): pehle har keyword ka weight barabar tha aur
  // substring matches "jo pehle 600 mile" utha lete the — aam shabd (राम, धर्म)
  // durlabh shabdon (कुंभ, नचिकेता) ko daba dete the aur ansh kismat se chunte
  // the. Ab: (1) DURLABH shabd ka weight zyada (IDF), (2) substring mein
  // CHHOTI keys pehle (mool-shabd ke sabse kareeb), cap 900.
  const scores = new Map();
  for (const kw of keywords) {
    const exact = _wordIndex[kw];
    if (exact && exact.length) {
      const w = 1 / Math.log2(4 + exact.length);   // durlabh = bhaari, aam = halka
      for (const cid of exact) scores.set(cid, (scores.get(cid) || 0) + w);
      continue;
    }
    // Devanagari ke core shabd chhote hote hain (भय, मन, डर) — 2 akshar chalega
    const minLen = /[ऀ-ॿ]/.test(kw) ? 2 : 3;
    if (kw.length < minLen) continue;
    if (!_indexKeys) _indexKeys = Object.keys(_wordIndex);
    // Milti keys ikatthi karo, CHHOTI pehle (रामः > रामायणकालीन)
    const matched = [];
    for (const k of _indexKeys) {
      if (k.includes(kw)) matched.push(k);
      if (matched.length >= 400) break;
    }
    matched.sort((a, b) => a.length - b.length);
    let added = 0; let total = 0;
    for (const k of matched) total += _wordIndex[k].length;
    const w = 0.85 / Math.log2(4 + Math.min(total, 2000));
    outer:
    for (const k of matched) {
      for (const cid of _wordIndex[k]) {
        scores.set(cid, (scores.get(cid) || 0) + w);
        if (++added >= 900) break outer;
      }
    }
  }

  // Resolve chunk IDs → chunks, apply filters
  // QUALITY GATE (audit fix): OCR-debris chunks (jo sirf ank/matra ka kachra
  // hain) results mein sabse upar aa jaate the. Ab: 8 se kam asli Devanagari
  // shabd = bahar; aur asli shabdon ki density se score weight hota hai,
  // taaki saaf paath hamesha kachre se upar aaye.
  const results = [];
  for (const chunk of _knowledge.chunks) {
    const s = scores.get(chunk.id) || 0;
    if (!s) continue;
    if (filters.book && chunk.book !== filters.book) continue;
    if (filters.tradition && chunk.tradition !== filters.tradition) continue;
    if (filters.chapter != null && chunk.chapter !== filters.chapter) continue;
    const realWords = ((chunk.text || "").match(/[ऀ-ॿ]{3,}/g) || []).length;
    if (realWords < 8) continue;                       // OCR debris — kabhi mat dikhao
    const density = Math.min(realWords / 40, 1);       // 40+ asli shabd = poora bharosa
    results.push({
      chunk,
      score:      (s / keywords.length) * (0.5 + 0.5 * density),
      match_type: "keyword",
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// NOTE: semanticSearch + cosine similarity code HATA DIYA (2026-07-14 audit).
// Wajah: corpus ke sabhi 17,613 chunks mein embedding = null tha, toh semantic
// path hamesha khaali lautata tha — sirf confusion aur dead weight. Agar kabhi
// 03_embed_build.py se asli embeddings banao, git history se wapas le aana.

/**
 * PRIMARY search method — keyword search (substring + transliteration).
 * queryEmbedding param purani compatibility ke liye hai; ignore hota hai.
 *
 * @param {string}   query
 * @param {number[]|null} queryEmbedding   (ignored — embeddings nahi hain)
 * @param {Object}   filters
 * @param {number}   limit
 * @returns {SearchResult[]}
 */
export function hybridSearch(query, queryEmbedding = null, filters = {}, limit = 10) {
  return keywordSearch(query, filters, limit);
}

// ── Structural Navigation ──────────────────────────────────────────────────────

/**
 * Get all books in the knowledge store.
 * @returns {{ id: string, title: string, tradition: string, chunkCount: number }[]}
 */
export function getBooks() {
  if (!_loaded) return [];
  const books = [];
  for (const [id, chunks] of _bookIndex) {
    books.push({
      id,
      title:      chunks[0]?.book_title || id,
      tradition:  chunks[0]?.tradition || "",
      chunkCount: chunks.length,
    });
  }
  return books.sort((a, b) => a.tradition.localeCompare(b.tradition));
}

/**
 * Get all chapters for a book.
 * @param {string} bookId
 * @returns {{ chapter: number, title: string|null, chunkCount: number }[]}
 */
export function getChapters(bookId) {
  if (!_loaded) return [];
  const chapters = [];
  const seen     = new Set();
  for (const chunk of (_bookIndex.get(bookId) || [])) {
    if (chunk.chapter == null) continue;
    if (seen.has(chunk.chapter)) continue;
    seen.add(chunk.chapter);
    const key    = `${bookId}::ch${chunk.chapter}`;
    const chunks = _chapterIndex.get(key) || [];
    chapters.push({
      chapter:    chunk.chapter,
      title:      chunk.chapter_title,
      chunkCount: chunks.length,
      firstPage:  chunk.page,
    });
  }
  return chapters.sort((a, b) => a.chapter - b.chapter);
}

/**
 * Get chunks for a specific chapter.
 * @param {string} bookId
 * @param {number} chapter
 * @returns {Chunk[]}
 */
export function getChapterChunks(bookId, chapter) {
  if (!_loaded) return [];
  const key = `${bookId}::ch${chapter}`;
  return (_chapterIndex.get(key) || [])
    .sort((a, b) => a.page - b.page);
}

/**
 * Get chunks for a specific book, sorted by page.
 * @param {string} bookId
 * @returns {Chunk[]}
 */
export function getBookChunks(bookId) {
  if (!_loaded) return [];
  return (_bookIndex.get(bookId) || []).sort((a, b) => a.page - b.page);
}

/**
 * Get a single chunk by ID.
 * @param {string} chunkId
 * @returns {Chunk|null}
 */
export function getChunk(chunkId) {
  if (!_loaded) return null;
  return _knowledge.chunks.find(c => c.id === chunkId) || null;
}

/**
 * Cross-book search: find the same concept across all traditions.
 * @param {string} query
 * @param {number[]|null} queryEmbedding
 * @param {number} perBook   results per book
 * @returns {{ book: string, results: SearchResult[] }[]}
 */
export function crossBookSearch(query, queryEmbedding = null, perBook = 3) {
  if (!_loaded) return [];
  const books = getBooks();
  return books.map(b => ({
    book:    b.id,
    title:   b.title,
    results: hybridSearch(query, queryEmbedding, { book: b.id }, perBook),
  })).filter(b => b.results.length > 0);
}

/**
 * Status / diagnostics
 */
export function getKnowledgeStats() {
  if (!_loaded) return { loaded: false };
  return {
    loaded:      true,
    version:     _knowledge.version,
    total_chunks: _knowledge.total_chunks,
    books:       _bookIndex.size,
    embed_model: _knowledge.embed_model,
    embed_dim:   _knowledge.embed_dim,
  };
}
