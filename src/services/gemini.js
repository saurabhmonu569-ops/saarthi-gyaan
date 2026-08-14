/**
 * SAARTHI — Gemini API Client v2
 *
 * Improvements in this version:
 * - Request queue: only one call in-flight at a time
 * - Exponential backoff: 429 retries at 2s → 8s → 30s → 60s
 * - Rate-limit budget tracker: self-throttles before hitting the API limit
 * - Automatic fallback: on persistent rate limit, returns null so caller
 *   can use the offline fallback engine instead of showing an error
 * - Abort on new request: previous in-flight call is cancelled cleanly
 * - All errors are typed GeminiError for clean UI handling
 *
 * Setup:
 *   1. Get a free key → https://aistudio.google.com/app/apikey
 *   2. Add VITE_GEMINI_API_KEY=AIza... to your .env file
 *   3. Restart dev server: npm run dev
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Key sources: .env file first, then localStorage (runtime entry).
// localStorage (not sessionStorage) so the key survives browser restarts.
// Old sessionStorage values are migrated automatically.
const _ENV_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
function readRuntimeKey() {
  try {
    let k = localStorage.getItem("SAARTHI_RUNTIME_KEY") || "";
    if (!k) {
      // one-time migration from the old sessionStorage location
      const legacy = sessionStorage.getItem("SAARTHI_RUNTIME_KEY") || "";
      if (legacy) { localStorage.setItem("SAARTHI_RUNTIME_KEY", legacy); k = legacy; }
    }
    return k;
  } catch { return ""; }
}
const _SESSION_KEY = readRuntimeKey();
const INVALID_KEYS = ["DEMO_MODE", "your_gemini_api_key_here", "PASTE_YOUR_KEY_HERE", ""];

const GEMINI_API_KEY = (!INVALID_KEYS.includes(_ENV_KEY) && _ENV_KEY)
  ? _ENV_KEY
  : _SESSION_KEY;

// ── Provider Detection ────────────────────────────────────────────────────────
// gsk_ = Groq API key (OpenAI-compatible, fast, free)
// AIza = Google Gemini API key
// AQ.  = Google OAuth token (does not work with Gemini API)
function getProvider(key) {
  if (!key) return "none";
  if (key.startsWith("gsk_"))  return "groq";
  if (key.startsWith("AIza"))  return "gemini";
  if (key.startsWith("AQ."))   return "invalid_oauth";
  return "unknown";
}

// Groq config (OpenAI-compatible)
const GROQ_BASE    = "https://api.groq.com/openai/v1";
const GROQ_MODEL   = "llama-3.3-70b-versatile"; // best free Groq model

// Sawaal ki bhasha pehchanne ke liye (2026-08-03) — jawab ki bhasha ab
// script se tay hoti hai jab script saaf ho, warna app ke toggle se.
import { detectQueryLanguage } from "@/knowledge/translit";
// SYSTEM_PROMPT ki granth-soochi yahin se banti hai — neeche GRANTH_NAMES dekhein
import { BOOK_META } from "@/data/bookMeta";

/**
 * Kya yeh shaaririk swasthya ka sawaal hai?
 *
 * Do jagah istemal hota hai:
 *   1. yahin — prompt mein sakht dhancha jodne ke liye
 *   2. useChat.js — jawab ke ant mein CODE se chetavani lagane ke liye
 *      (model ke bharose nahi; woh niyam tod sakta hai, code nahi)
 *
 * Yeh list kabhi poori nahi hogi — suraksha ki doosri parat hai, guarantee
 * nahi. Naya shabd dikhe toh yahan jodna.
 */
export function isHealthQuery(text) {
  if (!text) return false;
  return /बवासीर|अर्श|बुखार|ज्वर|दर्द|पीड़ा|बीमार|रोग|व्याधि|इलाज|उपचार|दवा|दवाई|औषधि|टोटका|नुस्खा|खांसी|खाँसी|सर्दी|जुकाम|पेट|कब्ज|एसिडिटी|शुगर|मधुमेह|डायबिटीज|बीपी|रक्तचाप|ब्लड|थायरॉइड|कैंसर|माइग्रेन|सिरदर्द|घुटन|चक्कर|उल्टी|दस्त|एलर्जी|अस्थमा|दमा|टीबी|पथरी|सूजन|घाव|चोट|piles|hemorrhoid|fever|pain|ache|disease|illness|medicine|remedy|cure|treatment|diabetes|cancer|migraine|acidity|constipation|asthma|bimar|bimari|dawa|dawai|ilaj|ilaaj|dard|bukhar|khansi|sugar\b|thyroid|bp\b/i.test(text);
}

// ── AI PROXY (LIVE deploy ke liye) ───────────────────────────────────────────
// VITE_AI_PROXY_URL set karo (jaise https://saarthi-ai.tumhara.workers.dev)
// toh saare AI calls Cloudflare Worker se hokar jayenge — API key SERVER par
// rahegi, browser bundle mein koi key nahi jayegi. Local dev mein khaali
// chhodo toh seedha Groq/Gemini (purana tarika) chalta hai.
const AI_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");

// SECURITY FIX (2026-07-26): AuthContext.jsx sign-in ke baad Worker-verified
// sessionToken profile mein save karta hai (localStorage). Wahi yahan seedha
// padh lete hain — useChat.js ke isOwnerLocal() jaisa hi pattern, context ke
// bina bhi kaam karta hai. Worker isse verify karke exempt-from-rate-limit
// jaisa bounded benefit deta hai — asli quota-enforcement client ka daava
// nahi, crypto-verified token karta hai.
function getSessionToken() {
  try {
    const raw = localStorage.getItem("SAARTHI_USER_PROFILE");
    if (!raw) return "";
    const p = JSON.parse(raw);
    return p?.sessionToken || "";
  } catch { return ""; }
}

// Gemini config
// FIX (2026-07-23): gemini-2.0-flash aur gemini-1.5-flash dono Google ne
// shutdown kar diye hain — purane defaults yahan bhi update kiye (yeh path
// sirf local dev/direct-key mode mein chalta hai, proxy mode Worker use
// karta hai jahan yeh fix already kiya gaya hai).
const GEMINI_BASE  = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";
const API_BASE       = "https://generativelanguage.googleapis.com/v1beta";

// Free tier limits: 15 RPM, 1500 RPD — we self-throttle to stay safe
const MIN_MS_BETWEEN_CALLS = 800;     // 0.8s minimum gap — prevents 429 without stalling UX
const MAX_RETRIES           = 3;       // attempts before giving up
const TIMEOUT_MS            = 28_000; // 28s abort timeout per attempt

// ─── KEY CHECK ───────────────────────────────────────────────────────────────

export const hasApiKey = () => {
  if (AI_PROXY_URL) return true;   // proxy hai = key server par hai, ready
  const k = getApiKey();
  if (!k || k.length < 10) return false;
  if (INVALID_KEYS.includes(k)) return false;
  const p = getProvider(k);
  return p === "gemini" || p === "groq";
};

export const getApiKey = () => {
  const runtimeKey = readRuntimeKey();
  const k = (!INVALID_KEYS.includes(GEMINI_API_KEY) && GEMINI_API_KEY) ? GEMINI_API_KEY : runtimeKey;
  return k || "";
};

// Home page ke global Hindi/English switch ka nirnay (src/i18n.jsx wahi
// localStorage key "SAARTHI_UI_LANG" use karta hai) — AI jawab-bhasha
// isi se tay hoti hai, taaki UI toggle aur AI jawab hamesha match karein.
function getUiLang() {
  try {
    const v = localStorage.getItem("SAARTHI_UI_LANG");
    return v === "en" ? "en" : "hi";
  } catch {
    return "hi";
  }
}

// ─── ERROR TYPE ───────────────────────────────────────────────────────────────

export class GeminiError extends Error {
  /**
   * @param {string} message  — Human-readable description
   * @param {number} status   — HTTP status (0 = network/timeout)
   * @param {string} code     — Machine code for UI switch
   * @param {boolean} retryable — Whether the caller should try fallback
   */
  constructor(message, status = 0, code = "", retryable = false) {
    super(message);
    this.name      = "GeminiError";
    this.status    = status;
    this.code      = code;
    this.retryable = retryable;
  }
}

// ─── REQUEST QUEUE ────────────────────────────────────────────────────────────
// Ensures only one Gemini call runs at a time.
// New calls wait in line; duplicate rapid taps are collapsed.

let _queueRunning  = false;
const _queue       = [];

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    _queue.push({ fn, resolve, reject });
    drainQueue();
  });
}

async function drainQueue() {
  if (_queueRunning || _queue.length === 0) return;
  _queueRunning = true;
  const { fn, resolve, reject } = _queue.shift();
  try {
    resolve(await fn());
  } catch (e) {
    reject(e);
  } finally {
    _queueRunning = false;
    // Yield one tick so React state can update before next call
    setTimeout(drainQueue, 50);
  }
}

// ─── RATE-LIMIT SELF-THROTTLE ─────────────────────────────────────────────────
// Tracks the timestamp of the last successful or rate-limited call and
// enforces a minimum gap without needing to count RPM explicitly.

let _lastCallMs = 0;

async function enforceMinGap() {
  const now    = Date.now();
  const waited = now - _lastCallMs;
  if (_lastCallMs > 0 && waited < MIN_MS_BETWEEN_CALLS) {
    await sleep(MIN_MS_BETWEEN_CALLS - waited);
  }
  _lastCallMs = Date.now();
}

// ─── EXPONENTIAL BACKOFF TABLE ────────────────────────────────────────────────
// Retry delays (ms) for 429 responses. Aggressive — free tier is strict.

const BACKOFF = [2_000, 8_000, 30_000, 60_000];

// ─── LOW-LEVEL FETCH ──────────────────────────────────────────────────────────

/**
 * Build the request URL + headers for a Gemini generateContent call.
 * (This helper was referenced but missing — every Gemini call threw a
 * ReferenceError, got caught as "NETWORK", and silently fell back to
 * demo mode. Defining it fixes real AI responses.)
 */
function makeGeminiRequest(endpointUrl /*, body */) {
  return {
    url: endpointUrl,
    headers: {
      "Content-Type":   "application/json",
      "x-goog-api-key": getApiKey(),
    },
  };
}

// ─── GROQ API CALL ───────────────────────────────────────────────────────────
// Groq uses OpenAI-compatible format — much simpler than Gemini.
// Hardened: min-gap throttle, per-attempt timeout, 429/5xx backoff retries,
// and automatic fallback model if the primary is decommissioned (Groq
// retires models periodically — a 404/400 "model not found" should not
// kill the whole app).
// ⚠️ 2026-08-13: "llama-3.1-8b-instant" se badla gaya. Groq ne use
// 16 August 2026 ko band kar diya (unka apna email) aur "GPT OSS 20B"
// sujhaya — model-id `openai/gpt-oss-20b`.
//
// KYUN YE ZAROORI THA, jabki 8b chalta hi nahi tha:
// Neeche do jagah `GROQ_FALLBACK_MODEL` aata hai —
//   1. 429 (rate limit) par  → ye QUALITY_LOCK se BAND hai, chalta hi nahi
//   2. 404/400 "model gone" par → YE CHALTA HAI, aur yahi asli baat hai
// Doosra wala wo suraksha-jaal hai jo tab bachata hai jab MUKHYA model
// (llama-3.3-70b) hi band ho jaye. 16 Aug ke baad wo jaal khud mara hua
// hota — yaani jis din 70b retire hota, us din Groq poori tarah fail
// hota aur seedha Gemini par bojh aa jaata.
const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";

// Aakhri jawab kis model se aaya — UI isse imaandaar tag dikhati hai
// (8b = sankshipt/vyast-samay uttar; 70b = poora Saarthi)
export let lastAnswerModel = "";

async function callGroq(history, systemPrompt) {
  const key = getApiKey();

  // Convert Gemini history format to OpenAI format.
  // Drop the fake "Confirm you are ready" priming turns — Groq takes a
  // real system message, so the priming is redundant noise.
  const isPrimingTurn = t => {
    const txt = t.parts.map(p => p.text || "").join("");
    return txt.includes("Confirm you are ready as SAARTHI") ||
           txt.startsWith("Understood. I am Saarthi");
  };
  const messages = [
    { role: "system", content: systemPrompt || "" },
    ...history
      .filter(t => !isPrimingTurn(t)) // system prompt already sent above — no duplicates
      .map(turn => ({
        role:    turn.role === "model" ? "assistant" : "user",
        // TOKEN DIET (audit): purane lambe AI-jawab har sawaal ke saath dobara
        // jaate the — chupke se TPM kha jaate the. Har purani baat 1400 chars cap.
        content: turn.parts.map(p => p.text || "").join("").slice(0, 1400),
      })).filter(m => m.content.trim()),
  ];

  let model = GROQ_MODEL;
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await enforceMinGap();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Proxy set hai toh Worker ko bhejo (key server par), warna seedha Groq
      const res = await fetch(
        AI_PROXY_URL ? `${AI_PROXY_URL}/chat` : `${GROQ_BASE}/chat/completions`, {
        method:  "POST",
        headers: AI_PROXY_URL
          ? (() => {
              const h = { "Content-Type": "application/json" };
              const tok = getSessionToken();
              if (tok) h["X-Saarthi-Session"] = tok; // Worker verify karke rate-limit exempt karega (verified-owner ho toh)
              return h;
            })()
          : { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.55,
          // FIX (2026-07-24): 1000 tokens par Hindi/Devanagari jawab beech
          // vaakya mein hi kat jaate the. 1800 tak badhaya tha — par uske
          // baad 429 (rate/quota) errors dono engines (Groq + Gemini) par
          // aur zyada baar aane lage, kyunki bade max_tokens = zyada TPM
          // (tokens-per-minute) kharch per-request, aur free-tier ki asli
          // seema RPM nahi TPM hoti hai. 1400 par settle kiya — truncation
          // se bahut behtar (1000 se), par 1800 jitna TPM-bhaari nahi.
          max_tokens:  1400,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `Groq error ${res.status}`;

        // ITEM #2 (server-side quota): Worker ne daily-kota khatam hone par
        // bhi HTTP 429 deta hai (jaisa Groq/Gemini busy hone par), par ek
        // saaf "code: QUOTA_EXCEEDED" ke saath — isse alag pehchano taaki
        // useChat.js retry/backoff mein waqt zaya na kare, seedha wahi
        // friendly "aaj ka kota poora" message dikhaye jo pehle localStorage
        // check dikhata tha. NOT retryable (retry karne se kuch nahi badlega,
        // agle IST-din tak).
        if (err?.error?.code === "QUOTA_EXCEEDED") {
          throw new GeminiError(msg, 429, "QUOTA_EXCEEDED", false);
        }

        // QUALITY-LOCK (D-mode): 8b backup BAND. Jo jawab milega, 70b hi hoga —
        // galat/halka jawab kabhi nahi. 70b vyast ho toh ek chhota retry (2s),
        // phir saaf "dhyan-magn" message — user intezaar karega, dhokha nahi khayega.
        // (QUALITY_LOCK=false karne par purana 8b-backup wapas aa jayega.)
        if (res.status === 429) {
          const QUALITY_LOCK = true;
          if (!QUALITY_LOCK && model !== GROQ_FALLBACK_MODEL) {
            console.warn("[Saarthi] 70b limit hit — 8b-instant par switch (alag quota)");
            model = GROQ_FALLBACK_MODEL;
            continue;
          }
          if (attempt < (QUALITY_LOCK ? 1 : MAX_RETRIES)) {
            const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
            _lastCallMs = Date.now() + delay;
            await sleep(delay);
            continue;
          }
          throw new GeminiError("Groq rate limit hit after retries", 429, "RATE_LIMITED", true);
        }

        // "Request too large" — sawaal + document model ki minute-limit se bada.
        // User ko Groq ka raw error (org id samet) mat dikhao — friendly limit
        // message dikhao (retryable=true → UI apna narm message dikhata hai).
        if (/request too large|reduce your message size/i.test(msg)) {
          throw new GeminiError("Request bahut bada tha — chhota sawaal poochhein", 413, "RATE_LIMITED", true);
        }

        // Auth problems — not retryable, tell the user clearly
        if (res.status === 401 || res.status === 403) {
          throw new GeminiError(msg, res.status, "AUTH_ERROR", false);
        }

        // Model decommissioned / not found — swap to fallback model once
        const modelGone = res.status === 404 ||
          (res.status === 400 && /model|decommissioned|not found/i.test(msg));
        if (modelGone && model !== GROQ_FALLBACK_MODEL) {
          model = GROQ_FALLBACK_MODEL;
          continue;
        }

        // Server error — retry
        if (res.status >= 500) {
          if (attempt < MAX_RETRIES) { await sleep(BACKOFF[0]); continue; }
          throw new GeminiError(msg, res.status, "SERVER_ERROR", true);
        }

        throw new GeminiError(msg, res.status, "GROQ_ERROR", false);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new GeminiError("Empty response.", 200, "EMPTY", true);
      lastAnswerModel = data.model || model;   // Worker-router Gemini bhi bhej sakta hai — sach wahi likho
      return text;

    } catch (e) {
      clearTimeout(timer);
      if (e instanceof GeminiError) throw e;

      lastErr = (e.name === "AbortError")
        ? new GeminiError("Request timed out. Please try again.", 0, "TIMEOUT", true)
        : new GeminiError("Network error. Please check your connection.", 0, "NETWORK", true);

      if (attempt < MAX_RETRIES) { await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]); continue; }
    }
  }

  throw lastErr || new GeminiError("Groq request failed after retries.", 0, "EXHAUSTED", true);
}

async function callGeminiDirect(history) {
  await enforceMinGap();

  const _baseUrl  = `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent`;

  const body = {
    contents: history,
    generationConfig: {
      temperature:     0.55,
      topK:            40,
      topP:            0.95,
      maxOutputTokens: 1600,  // FIX (2026-07-24, tuned 2026-07-25): 1024 truncate karta tha, 2048 TPM-bhaari — 1600 par settle
      // FIX (2026-07-23): gemini-3.5-flash "thinking" default-on rakhta hai —
      // isse poora token budget internal reasoning mein hi kat sakta hai aur
      // asli jawab khaali aa sakta hai. "low" isse bachata hai (Worker mein
      // bhi yehi fix kiya gaya hai).
      thinkingConfig:  { thinkingLevel: "low" },
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const { url: _url, headers: _hdrs } = makeGeminiRequest(_baseUrl, body);
      const res = await fetch(_url, {
        method:  "POST",
        headers: _hdrs,
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg     = errBody?.error?.message || `HTTP ${res.status}`;
        const apiCode = errBody?.error?.code || "";

        if (res.status === 429) {
          // Rate limited — back off and retry
          const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
          _lastCallMs = Date.now() + delay; // push next allowed call further out
          if (attempt < MAX_RETRIES) {
            await sleep(delay);
            continue;
          }
          // Exhausted retries — throw retryable error so caller can use fallback
          throw new GeminiError(
            "Rate limit hit after retries",
            429,
            "RATE_LIMITED",
            true   // retryable = caller should use fallback
          );
        }

        if (res.status === 404) {
          // Model not found. Try the stable fallback before giving up.
          if (attempt === 0) {
            const fbEndpoint = `${GEMINI_BASE}/models/${FALLBACK_MODEL}:generateContent`;
            try {
              const { url: _fbUrl, headers: _fbHdrs } = makeGeminiRequest(fbEndpoint, body);
              const fb = await fetch(_fbUrl, {
                method:  "POST",
                headers: _fbHdrs,
                body:    JSON.stringify(body),
              });
              if (fb.ok) {
                const fbData = await fb.json();
                const fbText = fbData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (fbText) return fbText.trim();
              }
            } catch { /* ignore cascade error, fall through to throw */ }
          }
          throw new GeminiError(
            `Model "${GEMINI_MODEL}" not found. Add VITE_GEMINI_MODEL=gemini-1.5-flash to your .env file.`,
            404, "MODEL_NOT_FOUND", false
          );
        }

        if (res.status === 400 || res.status === 403) {
          throw new GeminiError(msg, res.status, apiCode || "AUTH_ERROR", false);
        }

        if (res.status >= 500) {
          // Server error — retry once
          if (attempt < MAX_RETRIES) { await sleep(BACKOFF[0]); continue; }
          throw new GeminiError(msg, res.status, "SERVER_ERROR", true);
        }

        throw new GeminiError(msg, res.status, apiCode || "API_ERROR", false);
      }

      const data   = await res.json();
      const text   = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const reason = data?.candidates?.[0]?.finishReason;

      if (!text) {
        if (reason === "SAFETY") throw new GeminiError("Safety filter blocked.", 200, "SAFETY", false);
        if (reason === "RECITATION") throw new GeminiError("Content policy.", 200, "RECITATION", true);
        throw new GeminiError("Empty response.", 200, "EMPTY", true);
      }

      return text.trim();

    } catch (e) {
      clearTimeout(timer);
      if (e instanceof GeminiError) throw e;  // already typed — don't wrap

      if (e.name === "AbortError") {
        lastErr = new GeminiError("Request timed out. Please try again.", 0, "TIMEOUT", true);
      } else {
        lastErr = new GeminiError("Network error. Please check your connection.", 0, "NETWORK", true);
      }

      if (attempt < MAX_RETRIES) { await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]); continue; }
    }
  }

  throw lastErr || new GeminiError("Request failed after retries.", 0, "EXHAUSTED", true);
}

// ─── QUEUED WRAPPER ───────────────────────────────────────────────────────────

function callGemini(history, systemPrompt) {
  // Proxy mode: hamesha Groq-format path (Worker Groq ko forward karta hai)
  if (AI_PROXY_URL) {
    return enqueue(() => callGroq(history, systemPrompt));
  }
  const provider = getProvider(getApiKey());
  if (provider === "groq") {
    return enqueue(() => callGroq(history, systemPrompt));
  }
  return enqueue(() => callGeminiDirect(history));
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

/**
 * Granth ki soochi — BOOK_META se BANTI hai, haath se likhi NAHI hai.
 *
 * ⚠️ KYUN (2026-08-10, user ne live app par pakda):
 * Yeh soochi pehle prompt mein haath se likhi ek lambi line thi. Corpus
 * badalta raha, line wahin ki wahin rahi. Aaj naapne par woh CHAAR jagah
 * jhoothi nikli:
 *
 *   likha tha par hai nahi : Valmiki Ramayana, Mantra Shakti,
 *                            Nitya Devta Archana
 *   hai par likha nahi     : Mahabharata, Shri Ramcharitmanas,
 *                            Shri Yoga Vasishtha
 *
 * Nateeja seedha user tak pahuncha. Ramayan ke do sawaalon par model ne
 * likha "yeh katha VALMIKI RAMAYANA mein varnit hai" — woh granth 7 August
 * ko hataya ja chuka tha. Model ne wahi kiya jo humne use bataya tha.
 * Aur Ramcharitmanas — jo is app ki pehli kitab hai aur jismein hanuman
 * ke 153 aur sita ke 385 ansh hain — uska naam prompt mein tha hi nahi,
 * isliye model ko pata hi nahi tha ki woh uske paas hai.
 *
 * Ab yeh apne aap banta hai. Kal koi granth jude ya hate, prompt sach
 * bolta rahega — bina kisi ko yaad rakhe.
 */
/**
 * KHAND EK GRANTH GINE JAATE HAIN (2026-08-11).
 *
 * BOOK_META me 25 chaabiyan hain, par granth 24 hain — Shiv Puran do
 * khand me hai, aur dono ki alag entry hai (unki PDF hi alag hain).
 *
 * Bina ise sambhale prompt me likha jaata: "Tumhare paas KEVAL yeh 25
 * granth hain: …, Shiva Purana Khand 1, Shiva Purana Khand 2, …".
 * Do dikkatein: ginti galat, aur ek hi granth do naam se dikhta —
 * jisse jawab me kabhi "Khand 1" to kabhi "Khand 2" ka hawala aata,
 * jabki user ke liye wo ek hi kitab hai.
 *
 * Aage koi granth khand me bata to yahi niyam apne aap laagu ho jaayega.
 */
const GRANTH_NAMES = [...new Set(
  Object.values(BOOK_META)
    .map(m => (m.en || m.title || "").replace(/\s*(Khand|खण्ड|खंड)\s*[0-9०-९]+\s*$/i, "").trim())
    .filter(Boolean)
)];
const GRANTH_COUNT = GRANTH_NAMES.length;
const GRANTH_LIST  = GRANTH_NAMES.join(", ");

// export — taaki jaanch wali script (24_aadhaar_check.mjs) WAHI prompt
// istemaal kare jo asli app karti hai. Alag prompt se jawab ka andaz
// badal jaata, aur jaanch asli haalat nahi dikhati.
export const SYSTEM_PROMPT = `Tum Saarthi ho — ek shaant, samajhdar aatmik guide. Tumhara andaz ek acche guru jaisa hai: seedha, saaf, izzat ke saath.

BHASHA — SAKHT MIRROR RULE:
- User ne jis bhasha mein poochha, jawab 100% USI bhasha mein:
  * Poora English sawaal → poora English jawab (Hinglish mila ke NAHI)
  * Hindi (Devanagari) sawaal → shuddh saral Hindi jawab
  * Hinglish (Roman Hindi) sawaal → Hinglish jawab
- SABSE ZAROORI EXCEPTION (yeh mirror-rule se BHI upar hai): har user-message ke bilkul ant mein ek
  "[REPLY LANGUAGE: ...]" tag milega — yeh SYSTEM ne khud calculate kiya hai aur ISKO HI FINAL maano,
  chahe user ne sawaal kisi bhi script/bhasha mein likha ho. Jaise "Karma ka arth samjhaye hindi mai" —
  sawaal Hinglish (Roman) mein likha hai lekin user ne SAAF Hindi maangi hai, toh [REPLY LANGUAGE] tag
  "HINDI (Devanagari)" kahega — us case mein pura jawab SHUDDH DEVANAGARI mein likho, Hinglish/Roman
  script bilkul mat chhuo. Yeh [REPLY LANGUAGE] tag hamesha upar wale "mirror rule" ko override karta hai.
- User ko hamesha "aap" kaho (English mein respectful tone). "Yaar", "bro", "dost", "arre bhai" — KABHI nahi.
- Agar user CAPS mein likhe toh bhi tum normal likhawat mein jawab do
- Bhasha SIMPLE rakho — aisi ki 15 saal ka bachcha bhi samajh le. Kathin shabd aaye toh bracket mein matlab do.

SABSE ZAROORI NIYAM — JAWAB KAISE SHURU KARO:
- User ka sawaal KABHI repeat mat karo — na quotes mein, na apne shabdon mein
- "Yeh sawaal toh sabke dil ki baat hai", "bahut accha sawaal", "main samajh sakta hoon" — is tarah ki KOI filler line nahi. PEHLI line se hi asli jawab shuru karo.
- Galat shuruaat: "Aapne poocha ki shaadi ke baad anban ho toh kya karein — yeh sawaal…"
- Sahi shuruaat: "Shaadi ke baad bhai se anban hona bahut aam hai. Sabse pehla kadam…"

JAWAB KA SIZE AUR SHAPE:
- LAMBAI ANSHON SE TAY HOTI HAI, GHADI SE NAHI. Jitna maal upar diye gaye passages mein SACH MEIN hai, utna hi likho:
  * 1-2 patle ansh mile hain → 4-6 line. Ise khinch kar bada mat karo.
  * 4 ya zyada bharpoor ansh mile hain, ya kai granth ke ansh mile hain → 12-18 line, aur use alag-alag hisson mein baanto (chhote sheershak ya 1) 2) 3) ke saath) taaki padhna aasan ho.
- ⚠️ PASSAGE MEIN JO NAHI HAI, USSE LAMBAI MAT BHARO. Jagah bharne ke liye aam gyaan, dohraav ya apni memory se jodi hui baat likhna — wahi gadhna hai, aur wo is poore prompt ka sabse bada apradh hai. Ansh kam hon toh CHHOTA jawab hi SAHI jawab hai.
- Ek baat sirf EK baar bolo — same advice ko ghuma-phira ke repeat karna sakht mana hai
- Structure: 1) seedha jawab, 2) ek shloka/teaching (sahi source ke saath — agar yaad na ho toh source ka naam mat gadho), 3) ek practical kadam jo aaj se ho sake
- Jawab 10 line se lamba ho toh ant mein ek "Saar:" line do — do vaakya mein poori baat.

KAI GRANTH MILEIN TOH — ALAG-ALAG LIKHO, MILA KAR EK MAT BANAO:
- Do granth ek hi vishay par ALAG baat kehte hain, toh DONO alag likho, har ek ke saath uska naam:
    "Garud Puran ismein yeh kehta hai... Agni Puran isi baat ko alag tarah dekhta hai — wahan yeh likha hai..."
- Unhe mila kar ek milee-julee baat BANANA MANA HAI. Aisa karne par jo vaakya banta hai woh KISI BHI granth mein nahi hota — aur neeche Aadhaar mein dono granthon ke naam chale jaate hain. Yaani user do granth ka naam dekhta hai, kisi ek mein bhi dhoondhne jaye toh use woh baat nahi milti.
- Dono ek hi baat kehte hain toh ek hi baar kaho, aur dono ka naam le lo.
- Kaun sa granth "sahi" hai — yeh tay karna tumhara kaam NAHI hai. Granth alag-alag kehte hain, yeh apne aap mein sach hai aur user ko wahi dikhna chahiye.

SACRED TEXTS:
- Kahani ki tarah batao, reference number ki tarah nahi
- SHLOKA QUOTE KARNA LAGBHAG HAMESHA MANA HAI: Sanskrit shloka sirf tab likho jab woh diye gaye sacred passages mein maujood ho. Roman aksharon mein Sanskrit quote karna ("Krodhat bhayam..." jaisa) bhi utna hi mana hai jitna Devanagari mein. Apni memory se Sanskrit banana sakht mana — aise shloka aksar galat/kalpanik hote hain aur yeh sabse badi galti mani jayegi. Shloka ke bina teaching ka bhaav apne shabdon mein batao.
- YEHI NIYAM MANTRA/UPAY PAR BHI: koi mantra, jaap ya upay SIRF tab batao jab woh diye gaye passages mein likha ho. Khud tukbandi karke "mantra" RACHNA SAKHT MANA hai — user use asli granth ka mantra samajh kar japega, yeh vishwasghat hoga. Passages mein mantra na ho toh kaho: "granthon mein is vishay par yeh bhaav milta hai" — bina rachit mantra ke.

CORPUS KI SEEMA — SACH BOLO (hallucination ke khilaf sabse bada niyam):
- Tumhare paas KEVAL yeh ${GRANTH_COUNT} granth hain: ${GRANTH_LIST}.
- PEHLE diye gaye passages GAUR SE PADHO: agar us granth ka KOI BHI ansh neeche diya gaya hai (chahe woh seedha, poora jawab na de raha ho — sirf us granth ka ek panna/overview ho), toh USI se apna jawab banao aur USI granth ko naam se cite karo — apne shabdon mein us ansh ke bhaav ko explain/expand karke poora, madadgaar jawab do. "Iska seedha ullekh nahi mila" sirf tab kaho jab neeche us granth ka EK BHI ansh na diya gaya ho — agar ansh diya gaya hai toh use istemal karna zaroori hai, disclaimer mat do.
- Quran, Bible, Shrimad Bhagavatam, Tripitaka, Valmiki Ramayana — inke quote/ayat KABHI MAT GADHO. Inke baare mein poocha jaye toh saaf kaho: "Yeh granth abhi Saarthi mein nahi hain" — phir apne granthon se jawab do. Ramayan ki katha ke liye tumhare paas Shri Ramcharitmanas hai; Valmiki Ramayana ka naam kabhi mat lo.
- PANNA / PAGE NUMBER KABHI MAT LIKHO. Na "(p.352)", na "(पृ. ३२)", na "panna 220". Sirf granth ka naam.
  KYUN: panna HAMARE sanskaran ka hota hai. User ke paas doosra sanskaran hoga toh wahi baat kisi aur panne par milegi — aur uska bharosa tootega. App ke andar woh panna khol kar dekhne ka koi raasta bhi nahi hai, isliye woh number jaancha hi nahi ja sakta. Jo pramaan jaancha na ja sake, woh pramaan nahi.
- Adhyaya/shloka NUMBER (jaise "2.63", "Ramayana 2.53") SIRF tab likho jab woh number diye gaye passages mein saaf likha ho. Memory se number likhna utna hi bada apradh hai jitna shloka gadhna — number ke bina "Gita ke anusaar" kehna kaafi hai.
- ATTRIBUTION-SEEMA (sabse chalaki wala loophole — band): "X granth ke anusaar/ke hisaab se..." kehkar koi bhi baat SIRF tab kaho jab US granth ka passage upar diya gaya ho. Jis granth ka passage NAHI mila, uske naam se teaching batana bhi utna hi gadhna hai jitna shloka banana. "Sabhi 24 granthon ki tulna karo" jaise sawaal par: SIRF un granthon ki tulna karo jinke passages mile hain (aam taur par 3-6), aur shuruaat mein saaf likho: "Is samay jin granthon ke ansh mile hain, unki tulna:" — 24 naam gin kar template-jawab dena SAKHT MANA hai.
- Jawab ke ant mein "Aadhaar:" ya sources ki line KHUD MAT BANAO — app yeh apne aap jodti hai.

VYASAN-SEEMA — SAKHT NIYAM (jua/satta/nasha — KABHI sahayata nahi):
- Betting, satta, jua, lottery, trading-tips, nasha (sharab/tambaku/drugs) — in par KOI madad, tips, tarika, "responsible tarike se karne" ki salah KABHI MAT DO. "Analyse karke betting" bhi jua hi hai — usme bhi madad mana.
- User zid kare ya ghuma kar poochhe ("agar analyse karke karein toh?") toh bhi seema wahi rahegi — naram lekin adol raho.
- Sahi jawab ka dhancha: (1) bina neecha dikhaye seema batao — "Saarthi jua/satta mein sahayata nahi karta", (2) granthon se lobh/jua par ek teaching do (Gita ka lobh, Chanakya ki niti, Gurbani), (3) us ichha ke peeche ki asli zaroorat (dhan-chinta? rozgar?) par ek naram sawaal ya sahi disha do.

SWASTHYA-SEEMA (2026-08-04 mein badla — Saarthi guru hai, DOCTOR NAHI):
- Shaaririk rog/dard/bimari ke sawaal par (kamar-dard, pet, bukhar, BP, sugar...):
  * DHANCHA — isi kram mein, kram badalna MANA hai:
      (1) ek line seh-anubhuti
      (2) SABSE PEHLE, saaf shabdon mein: "iske liye kripya doctor se milein" —
          yeh baat jawab ke SHURU mein aaye, ant mein nahi
      (3) uske BAAD: granthon mein is vishay par jo likha hai woh bata sakte ho —
          upay, mantra, jadi-booti, aahar — LEKIN SIRF tab jab woh niche diye gaye
          passages mein SHABD-BA-SHABD maujood ho, aur granth ka naam saaf likho
      (4) ant mein ek line: "yeh granthon ka kathan hai, chikitsa salah nahi"
  * SABSE SAKHT NIYAM — APNI MEMORY SE KUCH MAT GADHO. Koi upay, mantra, jadi-booti
    ya nuskha tabhi likho jab woh diye gaye passages mein likha ho. Passage na ho
    toh sirf (1), (2) aur granthon se MANN ki shanti/dhairya ka bhaav — koi upay
    nahi. "Garuda Puran ke anusaar yeh mantra dard hataata hai" jaisa vaakya jab
    tak passage mein na ho, sabse badi galti hai.
  * "Yeh mantra/upay rog THEEK KAR DEGA" — aisa dava ya ishara KABHI mat karo.
    Granth kya kehta hai woh batana alag baat hai; ilaaj ki guarantee dena alag.
  * Bimariyon ke naam ginana (herniated disk, kidney stone...) ya symptoms-checklist
    banana ab bhi MANA hai — nidan (diagnosis) doctor ka kaam hai.
  * Turant khatre ke sanket (seene mein dard, saans na aana, bahut khoon, behoshi)
    par SIRF ek hi baat: turant doctor/aspataal jayein. Koi granth-charcha nahi.

HELPLINE — SAKHT NIYAM:
iCall helpline (9152987821) ka zikr KEVAL tab karo jab user KHUD in cheezon ki baat kare: jeene ka mann na hona, khud ko nuksaan pahunchana, ya poori tarah haar maan lena. Aise clear signal ke BINA helpline ka naam lena BILKUL MANA hai — stress, dukh, pariwar ki problem, confusion, in sab mein helpline ka zikr karna galti hai. Yeh niyam todna sabse badi galti hogi.

GURU-FLOW — SAWAAL KI PEHCHAN KARO, PHIR MODE CHUNO (yeh Saarthi ki aatma hai):

MODE 1 — GYAAN-PRASHNA (jaise "Yajna kya hai?", "Gita mein karma yoga kya hai?"):
- Seedha, saaf, vidwaan jawab + granth ka hawala. Bhavnatmak bhoomika MAT bandho.
- Ant mein follow-up sawaal NAHI — gyaan do aur vishram.

MODE 2 — JEEVAN-SAMASYA (jaise "gussa aata hai", "darr lagta hai", "shaadi mein anban", "kuch samajh nahi aa raha"):
Yahan tum sirf jawab dene wale nahi — GURU ho. Isi kram mein chalo:
a) BHAAV KO NAAM DO (1 line, bina sawaal repeat kiye): user jo mehsoos kar raha hai usse shabd do — "Gussa jab baar-baar aaye toh andar se thakan si ho jaati hai."
b) GRANTH KI ROSHNI: diye gaye passages mein se SABSE relevant teaching — kahani ki tarah, source ke naam ke saath. Generic self-help (deep breathing, therapist, positive thinking) se JAWAB MAT BHARO — pehle shastra bole, phir zaroorat ho toh 1 practical baat.
c) EK KADAM AAJ SE: chhota, naapne-layak, granth se juda — jaise "aaj jab gussa uthe, Gita ke is bhaav ko yaad karo aur 10 tak gino" — 5 generic tips ki list NAHI, sirf EK sachcha kadam.
d) EK NARAM SAWAAL wapas poochho jo samvad aage badhaye — "Yeh gussa sabse zyada kab uthta hai — kaam par ya ghar par?" Guru ek sawaal se shishya ko khud uttar tak le jaata hai.
- Follow-up sawaal SIRF Mode 2 mein. User agle jawab mein detail de toh usse jodkar aur gehra margdarshan do (history tumhare paas hai).

SAARTHI BHAAV (har jawab mein jhalke):
- Gehra aadar aur sneh — jaise shaant guru apne priya shishya se; kabhi jaldbaazi, rukhaapan ya ghamand nahi
- Vinamrata: "shastron ke anusaar" kaho, "main kehta hoon" nahi
- Jahan dukh dikhe wahan pehle 1 line sneh, phir margdarshan
- Ant mein jahan swabhavik lage ek chhota ashirwad-bhaav ("Shubh ho 🙏") — har baar nahi, zabardasti nahi

Kabhi "As an AI" ya "I am a language model" mat kaho — tum Saarthi ho.`



// ─── ONE-SHOT HELPERS (reader polish + search explain) ───────────────────────

/**
 * Reconstruct clean, readable Hindi from garbled OCR text.
 * Returns polished text, or throws GeminiError.
 */
export async function polishSacredText(rawText) {
  // Poora chapter saaf hota hai — lambe chapters ~5000-char tukdon mein,
  // ek-ek karke (queue serial hai), phir jod diye jaate hain.
  const full = (rawText || "").slice(0, 30000);      // hard safety cap
  const parts = [];
  let buf = "";
  for (const para of full.split(/\n\n+/)) {
    if ((buf + "\n\n" + para).length > 5000 && buf) { parts.push(buf); buf = para; }
    else buf = buf ? buf + "\n\n" + para : para;
  }
  if (buf) parts.push(buf);

  const makePrompt = (txt) =>
    "Neeche ek purani dharmik kitab ka OCR-scan kiya hua text hai jisme Sanskrit shloka aur Hindi arth aapas mein ulajh gaye hain, aur galtiyan hain. " +
    "Ise is tarah dobara likho:\n" +
    "1. SHLOKA KA NIYAM: Agar koi shloka poora aur shuddh pada ja sakta hai, toh use alag line par rakho aur neeche Hindi arth do. Lekin agar shloka toota-phoota ya ashuddh hai (OCR se bigda), toh use POORI TARAH HATA DO aur sirf uska saral Hindi arth likho.\n" +
    "2. Tooti hui lines ko jodkar poore vaakya banao. Adhoore/arthin shabd-tukde (jaise 'अपवित्र ल गिरना' ka 'ल') hata do.\n" +
    "3. Matlab bilkul mat badlo, apni taraf se kuch naya mat jodo. Jo hissa bilkul samajh na aaye use chhod do.\n" +
    "4. SIRF saaf kiya hua paath do — koi bhoomika, koi note nahi.\n\n" +
    "--- OCR TEXT ---\n" + txt;

  const out = [];
  for (const part of parts) {
    out.push(await sendMessage(makePrompt(part), [], {}));
  }
  return out.join("\n\n");
}

/**
 * Explain a searched term simply, grounded in passages. Language follows the
 * Home page's global Hindi/English toggle (single-language output, not both
 * — pehle yeh function hamesha Hindi+English dono likhta tha, ab toggle ke
 * anusaar SIRF ek bhasha).
 */
export async function explainSearchTerm(term, passages = []) {
  // PRAMAAN-FIX: passages ab {label, text} bhi ho sakte hain — granth ka naam
  // saath jata hai taaki nishkarsh mein AI asli source cite kar sake.
  const ctx = passages.slice(0, 3).map((p, i) => {
    const label = (p && p.label) ? p.label : `Ansh ${i + 1}`;
    const text  = String((p && p.text) != null ? p.text : p).slice(0, 600);
    return `[${label}]\n${text}`;
  }).join("\n\n");
  const uiLang = getUiLang();
  const langLine = uiLang === "en"
    ? "Is shabd ka saral arth 2-3 line SIRF simple ENGLISH mein batao — Hindi/Hinglish ka ek bhi shabd nahi. "
    : "Is shabd ka saral arth 2-3 line SIRF shuddh saral HINDI (Devanagari) mein batao — English ka ek bhi vakya nahi. ";
  const prompt =
    `Shabd: "${term}"\n\n` +
    langLine +
    "PHIR neeche diye anshon mein se SABSE relevant ka EK chhota seedha uddharan do, is format mein:\n" +
    '📜 "asli pankti" — Granth ka naam\n' +
    "Uddharan SIRF anshon ke asli shabdon se — apna kuch mat milao; OCR ka toota/bemaani vakya bhi mat lo — SAAF padhne-layak pankti na mile toh uddharan poora chhod do (jhootha ya kachra kabhi nahi), aur '—' ke baad SIRF granth ka naam likho — PANNA/PAGE NUMBER KABHI MAT LIKHO (neeche 'PANNA' wala niyam dekho). " +
    "Total 5-6 line se zyada nahi. Koi heading nahi.\n\n" +
    (ctx ? "Sacred passages:\n" + ctx : "");
  return sendMessage(prompt, [], {});
}

/**
 * Vedic Time section (#14) ka "Ask SAARTHI about time" — aaj ke panchang
 * (tithi/nakshatra/muhurta...) ko context ki tarah dekar sawaal ka jawab.
 * explainSearchTerm jaisa hi single-language, one-shot helper — koi chat
 * history nahi, sirf ek jawab.
 */
export async function askAboutVedicTime(question, panchangSummary = "") {
  const uiLang = getUiLang();
  const langLine = uiLang === "en"
    ? "Jawab SIRF simple ENGLISH mein do — Hindi/Hinglish ka ek bhi shabd nahi. "
    : "Jawab SIRF shuddh saral HINDI (Devanagari) mein do — English ka ek bhi vakya nahi. ";
  const prompt =
    `User ka sawaal Vedic Time / Panchang ke baare mein hai: "${question}"\n\n` +
    langLine +
    "Neeche AAJ ka LIVE-calculated panchang data diya gaya hai — isi ko sach maan kar jawab do, khud se din/tithi mat gadho:\n\n" +
    panchangSummary + "\n\n" +
    "Niyam: (1) 4-6 line se zyada nahi, (2) agar koi baat 'parampara ke anusaar' hai (jaise Brahma Muhurta shubh maana jaana) toh yeh saaf bolo ki yeh paramparik maanyata hai, vaigyanik dava nahi, (3) andhvishwas ko badhava mat do, sirf jaankari do, (4) agar koi shastra/granth ka sandarभ pata ho tabhi naam lo, warna mat lo.";
  return sendMessage(prompt, [], {});
}

// ─── HISTORY BUILDER ─────────────────────────────────────────────────────────

function buildGeminiHistory(history, contextAddition = "") {
  const systemTurns = [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT + contextAddition + "\n\nConfirm you are ready as SAARTHI." }],
    },
    {
      role: "model",
      parts: [{ text: "Understood. I am Saarthi — ready to listen and guide. What's on your mind?" }],
    },
  ];

  const normalized = history
    .filter(m => m.role === "user" || m.role === "ai" || m.role === "model")
    .map(m => ({
      role:  m.role === "ai" ? "model" : "user",
      parts: [{ text: (m.content || m.text || "").trim() }],
    }))
    .filter(m => m.parts[0].text);

  // Gemini requires strict alternation — merge consecutive same-role messages
  const alternating = [];
  let lastRole = "model";
  for (const msg of normalized) {
    if (msg.role === lastRole && alternating.length > 0) {
      alternating[alternating.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
    } else {
      alternating.push(msg);
      lastRole = msg.role;
    }
  }

  return [...systemTurns, ...alternating];
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Send a chat message. Returns response text, or throws GeminiError.
 * Callers should check err.retryable — if true, use getFallbackResponse()
 * instead of showing a hard error.
 */
const _FOOTER_RE = /\n*-{2,}\n*📚[^\n]*/g;

export async function sendMessage(userMessage, history = [], context = {}) {
  // Purane jawabon ke 📚 Aadhaar footers history se hata do — warna model
  // unhe dekh ke khud nakli footer likhta hai (duplicate footer bug).
  history = (history || []).map(m => ({
    ...m,
    parts: (m.parts || []).map(pt => ({ ...pt, text: (pt.text || "").replace(_FOOTER_RE, "") })),
  }));
  if (!hasApiKey()) throw new GeminiError("No API key.", 0, "NO_KEY", false);

  let contextAddition = "";
  if (context.pdfText) {
    // Groq free tier: 12,000 tokens/min TOTAL (system+history+doc+answer).
    // Budget the document to ~18,000 chars. Bade documents ke liye poori
    // kitab se EVENLY-SPACED windows lo — taaki summary shuru se ant tak
    // poore document ko cover kare, sirf pehle panne nahi.
    // Token-aware budget: Devanagari ~1.5 chars/token, English ~3.4.
    // Target ≈ 7,000 input tokens for the doc (Groq TPM 12k total).
    const raw = context.pdfText || "";
    const sample = raw.slice(0, 4000);
    const devaRatio = ((sample.match(/[\u0900-\u097F]/g) || []).length) / Math.max(sample.length, 1);
    const charsPerToken = devaRatio > 0.25 ? 1.5 : 3.4;
    // 3000 tokens: 8b-instant ki TPM sirf 6000 hai — doc(3000) + system + history
    // + sawaal ≈ 4700 → fallback model par bhi hamesha fit hota hai
    const PDF_BUDGET = Math.floor(3000 * charsPerToken);
    let docText;
    if (raw.length <= PDF_BUDGET) {
      docText = raw;
    } else {
      const WINDOWS = 9;
      const winSize = Math.floor(PDF_BUDGET / WINDOWS);
      const step    = Math.floor((raw.length - winSize) / (WINDOWS - 1));
      const parts   = [];
      for (let i = 0; i < WINDOWS; i++) {
        const start = i * step;
        parts.push(`[...document section ${i + 1}/${WINDOWS}...]\n` + raw.slice(start, start + winSize));
      }
      docText = parts.join("\n\n");
    }
    contextAddition = `\n\nThe user has uploaded a document${raw.length > PDF_BUDGET ? " (bahut bada — representative sections from across the WHOLE document are shown)" : ""}. Use ONLY this document content to answer their questions. Quote specific sections when helpful.\n\n---DOCUMENT START---\n${docText}\n---DOCUMENT END---\n\nIMPORTANT: Answer from the document above. If the answer is not in the document, say so clearly.`;
  }
  if (context.subject) {
    contextAddition += `\n\nStudent is studying: ${context.subject}.`;
  }
  if (context.userName) {
    // item #15: signed-in user ko "Naam ji" se sambodhit karna — har baar
    // nahi (robotic lagega), kabhi-kabhi jawab ke shuru ya beech mein.
    contextAddition += `\n\nUser ka naam "${context.userName}" hai (Google Sign-In se pata chala). Kabhi-kabhi (har jawab mein nahi, natural lage tab) unhe "${context.userName} ji" kehkar sambodhit karo — jaise ek guru apne shishya ko naam se pukarta hai. Zabardasti har line mein naam mat thoonso.`;
  }
  if (context.mode === "spiritual") {
    contextAddition += "\n\nStudent is in Spiritual Mode — prioritise spiritual wisdom and inner peace.";
  }

  // ── Knowledge Engine RAG context ─────────────────────────────────────────
  // When the caller supplies pre-retrieved sacred text chunks (from engine.js
  // hybridSearch / crossBookSearch), inject them as grounded retrieval context.
  // This is the bridge between the Knowledge Engine and Gemini.
  if (context.sacredChunks && context.sacredChunks.length > 0) {
    // Build rich citation blocks: Book · Chapter · Page · Confidence
    const chunkBlocks = context.sacredChunks.map((r, idx) => {
      const ch  = r.chunk;
      const conf = r.score != null ? ` [relevance: ${Math.round(r.score * 100)}%]` : "";
      const src  = [
        ch.book_title,
        ch.chapter       ? `Ch.${ch.chapter}`         : null,
        ch.chapter_title ? `"${ch.chapter_title}"`    : null,
        ch.verse         ? `Verse ${ch.verse}`         : null,
        `p.${ch.page}`,
      ].filter(Boolean).join(" · ");
      return `[PASSAGE ${idx + 1} — ${src}${conf}]\n${ch.text}`;
    }).join("\n\n---\n\n");

    contextAddition +=
      `\n\nRELEVANT PASSAGES RETRIEVED FROM SACRED BOOKS (${context.sacredChunks.length} passages):\n\n` +
      `${chunkBlocks}\n\n` +
      `INSTRUCTIONS FOR USING THESE PASSAGES (BOOKS-FIRST RULE):\n` +
      `1. PEHLE in passages ko dhyan se padho — jawab ka aadhaar YEHI books hain, tumhari general memory nahi.\n` +
      `2. Jawab in passages se nikalo aur source ka naam saaf batao: "Garuda Purana ke anusaar…" — SIRF granth ka naam, panna number nahi.\n` +
      `2b. PRAMAAN ANIVARYA: jawab mein kam se kam EK chhota SEEDHA UDDHARAN do — passage ke asli shabd quotes mein, is format mein:\n` +
      `    📜 "passage ki asli pankti yahan" — Book ka naam (panna NAHI)\n` +
      `    Uddharan SIRF upar diye passages se copy karo — ek shabd bhi apna mat milao, aur PASSAGE KI MOOL BHASHA mein hi (Hindi passage = Hindi uddharan). Apna banaya English vakya 📜 mein daalna ("The universe is..." jaisa) SABSE BADA APRADH hai — woh uddharan nahi, jaalsaazi hai. Agar kisi passage mein sawaal se juda saaf vakya NAHI hai, toh uddharan chhodo aur saaf likho: "In anshon mein seedha uttar nahi mila". 📜 ke saath Chapter/Verse/Page number SIRF wahi jo passage ke header mein likha hai — apni yaaddasht ka (Chapter 5, Verse 12) jaisa number likhna jaalsaazi hai. OCR se toota-phoota vakya bhi quote mat karo — saaf padhne-layak pankti na ho toh uddharan chhod do.\n` +
      `3. Passages OCR se aaye hain — chhoti-moti galtiyan ho sakti hain; bhaav pakdo, toota shabd quote mat karo.\n` +
      `4. Agar in passages mein user ke sawaal ka jawab NAHI hai, toh saaf kaho: "In granthon mein iska seedha ullekh nahi mila" — phir apne saamanya shastra-gyaan se jawab do, yeh batate hue ki yeh general gyaan hai.\n` +
      `5. Jawab ka dhancha: seedha nishkarsh (conclusion) pehli 1-2 line mein → phir aasaan bhasha mein samjhao → source ka naam. Bhaari Sanskrit shabdon ka matlab bhi saath mein do.\n` +
      `6. Kabhi jhootha source mat banao — jo passage mein hai wahi kaho.\n` +
      `7. SHLOKA KA SAKHT NIYAM: Sanskrit shloka SIRF tab quote karo jab woh IN passages mein likha ho. Apni memory se shloka banana ya yaad karke likhna BILKUL MANA hai — memory ke shloka aksar galat hote hain. Passage mein shloka na ho toh bina quote kiye sirf teaching ka bhaav batao.\n`;
  }

  const fullSystem    = SYSTEM_PROMPT + contextAddition;
  const geminiHistory = buildGeminiHistory(history, contextAddition);
  // GLOBAL-TOGGLE RULE (latest): Home page ka ek hi Hindi/English switch ab
  // pura app control karta hai. Iska faisla replyLang mein sabse upar maana
  // jayega (neeche) — purana Hinglish-word-counting tarika hata diya, woh
  // toggle se takra raha tha.
  const uiLang = getUiLang();
  let replyLang;
  // SEEDHA HUKUM SABSE UPAR: is EXACT message mein user khud seedha bhasha maange
  if (/\b(hindi)\s*(mein|me|mai|main)\b|\bin\s+hindi\b|\u0939\u093F\u0902\u0926\u0940\s*(\u092E\u0947\u0902|\u092E\u0947)/i.test(userMessage))
                                                 replyLang = "shuddh saral HINDI (Devanagari) \u2014 user ne KHUD Hindi maangi hai, English ka ek bhi vakya nahi";
  else if (/\b(english)\s*(mein|me|mai|main)\b|\bin\s+english\b/i.test(userMessage))
                                                 replyLang = "ENGLISH only \u2014 user ne KHUD English maangi hai";
  // SCRIPT-JEETEGA (2026-08-03): user ne "मृत्यु के बाद आत्मा का क्या होता
  // है?" Devanagari mein poocha, toggle English par tha, aur poora jawab
  // English mein aa gaya. Saaf galat laga.
  //
  // Naya niyam — jab script SAAF ho tab wahi maano, toggle tabhi faisla
  // kare jab sawaal dhundhla (Hinglish) ho:
  //     saaf Devanagari  → Hindi
  //     saaf English     → English
  //     Hinglish (Roman) → toggle
  // Hindi shabd pehchanne ke liye wahi corpus-lexicon lagta hai jo
  // transliteration mein banaya tha.
  else if (detectQueryLanguage(userMessage) === "hi")
                                                 replyLang = "shuddh saral HINDI (Devanagari) — user ne Devanagari mein poochha hai, isliye jawab bhi Devanagari mein; English ka ek bhi vakya nahi";
  else if (detectQueryLanguage(userMessage) === "en")
                                                 replyLang = "ENGLISH only — user ne saaf English mein poochha hai, isliye jawab bhi English mein";
  else if (uiLang === "en")
                                                 replyLang = "ENGLISH only \u2014 poora jawab English mein, ek bhi Hindi/Hinglish shabd nahi (app-wide toggle English par set hai)";
  else                                           replyLang = "shuddh saral HINDI (Devanagari) \u2014 Hinglish/Roman script bilkul mat likho (app-wide toggle Hindi par set hai)";
  // ── FIX 5 — SWASTHYA GUARD (2026-08-03) ────────────────────────────────
  // SYSTEM_PROMPT mein swasthya-seema pehle se likhi hai (line ~563), par
  // Groq us lambe prompt ko nahi sambhal paata. Asli mein dekha gaya:
  // "बवासीर नाशक टोटका" par jawab mein neem ke patton ka kaadha aur
  // हरितकी ka sevan bata diya gaya — seedha ilaaj, jo sakht mana hai.
  //
  // Prompt ke shuru mein likha niyam 900 line door reh jaata hai. Isliye
  // ab jab swasthya ka sawaal dikhe, wahi niyam DOBARA — user ke message
  // ke bilkul saath, jahan model ka dhyan sabse zyada hota hai.
  //
  // Yeh suraksha ki DOOSRI parat hai, guarantee nahi — keyword list kabhi
  // poori nahi hoti. Par jo aam sawaal aate hain, unpe asar padega.
  const healthNote = isHealthQuery(userMessage)
    ? `\n\n[SWASTHYA-CHETAVANI: Yeh shaaririk swasthya ka sawaal hai. Isi KRAM mein jawab do — `
      + `(1) ek line seh-anubhuti; `
      + `(2) SABSE PEHLE saaf likho "iske liye kripya doctor se milein" — yeh shuru mein aaye, ant mein nahi; `
      + `(3) uske baad granthon mein is vishay par jo likha hai woh batao — upay/mantra/jadi-booti bhi — `
      + `PAR SIRF tab jab woh upar diye gaye passages mein SHABD-BA-SHABD maujood ho, aur granth ka naam saaf likho; `
      + `(4) passage mein kuch na ho toh koi upay MAT gadho — sirf doctor wali baat aur granthon se mann ki shanti ka bhaav; `
      + `(5) "isse rog theek ho jayega" jaisa dava ya ishara KABHI mat karo; `
      + `(6) bimariyon ke naam ginana ya symptoms-checklist banana mana hai.]`
    : "";

  const languagePinned = userMessage + `\n\n[REPLY LANGUAGE: ${replyLang}]` + healthNote;

  geminiHistory.push({ role: "user", parts: [{ text: languagePinned }] });

  return callGemini(geminiHistory, fullSystem);
}

/**
 * Generate structured study notes.
 */
export async function generateNotes(topic, type = "quick", subject = "") {
  if (!hasApiKey()) throw new GeminiError("No API key.", 0, "NO_KEY", false);

  const subjectCtx = subject ? ` (Subject: ${subject})` : "";

  const prompts = {
    quick: `Generate concise quick-study notes for a student about: "${topic}"${subjectCtx}

**${topic} — Quick Notes**

**Core Concept:** (1-2 sentences, plain language)

**Key Points:**
- Point 1
- Point 2
- Point 3
- Point 4
- Point 5

**Real-Life Example:** (a relatable analogy)

**Formula/Rule:** (if applicable — leave blank if not)

**Exam Tip:** (the single most commonly tested aspect)

Keep it accurate, concise, and student-friendly.`,

    summary: `Write a comprehensive chapter summary for a student about: "${topic}"${subjectCtx}

**${topic} — Chapter Summary**

**Overview:** (2-3 sentences)

**Main Concepts:** (cover each major idea clearly)

**Important Details:**
- Detail 1
- Detail 2
- Detail 3

**Applications:** (real-world use)

**Key Takeaway:** (the one most important thing)

**Connect To:** (related topics to also study)`,

    mcq: `Generate 10 well-designed MCQ practice questions for a student about: "${topic}"${subjectCtx}

Format each as:

**Q[N].** [Clear, unambiguous question]
a) [Plausible wrong]
b) [Plausible wrong]
c) **[Correct answer]** ✓
d) [Plausible wrong]
**Explanation:** [Why c) is correct — one sentence]

Mix conceptual, application, and analysis questions. Do not make options obvious.`,

    revision: `Create a rapid revision sheet for exam preparation: "${topic}"${subjectCtx}

**${topic} — Revision Sheet**

**⚡ 30-Second Recap:**
(The absolute essence in 2-3 lines)

**Must-Know Definitions:**
- Term 1: definition
- Term 2: definition

**Critical Formulas/Rules:**
(List them)

**Common Exam Questions:**
1. [Type commonly asked]
2. [Another type]

**Don't Confuse:**
${topic} vs [similar concept]: [key difference]

**Last-Minute Tip:**
(The one thing that trips students up)`,
  };

  return callGemini([{
    role: "user",
    parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompts[type] || prompts.quick}` }],
  }]);
}

/**
 * Ask about an uploaded PDF.
 */
export async function askAboutPDF(question, pdfText, history = []) {
  if (!hasApiKey()) throw new GeminiError("No API key.", 0, "NO_KEY", false);
  return sendMessage(question, history, { pdfText });
}

// ─── ERROR → UI MESSAGE ───────────────────────────────────────────────────────

/**
 * Returns a user-friendly string for any error.
 * For retryable errors, pass showFallbackHint=true to suggest demo mode.
 */
export function getErrorMessage(error, showFallbackHint = false) {
  if (!(error instanceof GeminiError)) {
    return "Kuch problem aa gayi. Dobara try karo. 🙏";
  }

  switch (error.code) {
    case "NO_KEY":
      return "⚙️ API key set up nahi hai. Niche setup guide dekho.";
    case "AUTH_ERROR":
    case "API_KEY_INVALID":
      return "❌ API key invalid hai. .env file check karo aur server restart karo.";
    case "RATE_LIMITED":
      return showFallbackHint
        ? "⏳ AI free limit hit ho gayi. Smart fallback response use kar raha hoon — thodi der baad real AI wapas aa jayega."
        : "⏳ AI rate limit. Thodi der ruko (1-2 minute), phir try karo.";
    case "MODEL_NOT_FOUND":
      return "❌ AI model not found. Please set VITE_GEMINI_MODEL=gemini-1.5-flash in your .env file and restart.";
    case "SAFETY":
      return "🛡️ Yeh message safety filter ne block kiya. Thoda alag tarike se poochho.";
    case "TIMEOUT":
      return "⏱️ Response timeout — internet slow lag raha hai. Dobara try karo.";
    case "NETWORK":
      return "📡 Network error. Internet connection check karo.";
    case "SERVER_ERROR":
      return "🔧 AI server ki problem hai. 1-2 minute mein dobara try karo.";
    default:
      if (error.status === 429) return "⏳ Bahut requests ho gayi. 1-2 minute wait karo phir try karo.";
      if (error.status === 404) return "❌ Model not found. .env mein VITE_GEMINI_MODEL=gemini-2.0-flash set karo.";
      if (error.status === 403) return "🔑 API access denied. Gemini API key check karo.";
      if (error.status === 400) return "❌ Invalid API key. .env file check karo.";
      return `AI error: ${error.message}`;
  }
}

/**
 * How many seconds to suggest the user wait before retrying.
 * Used by the UI to show a live countdown.
 */
export function getRetryDelaySecs(attempt = 0) {
  return Math.ceil(BACKOFF[Math.min(attempt, BACKOFF.length - 1)] / 1000);
}

// ─── UTIL ─────────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));
