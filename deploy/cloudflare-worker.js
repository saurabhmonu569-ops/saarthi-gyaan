/**
 * SAARTHI AI Proxy v2 — "ROUTER-LITE" (Groq 70b → Gemini Flash backup)
 * =====================================================================
 * Do muft engines, ek chaabi:
 *   1) Groq llama-3.3-70b  — pehla engine (tez, best)
 *   2) Gemini 2.0 Flash    — 70b vyast ho toh yehi sambhalta hai
 *      (Google ki ALAG muft tanki — din ke सैकड़ों jawab!)
 * Dono fail → 429 wapas → app apna "dhyan-magn" message dikhati hai.
 * Frontend ko farak hi nahi padta — response OpenAI-shape mein hi jata hai.
 *
 * ── SETUP (purane ke upar sirf 1 naya kadam) ─────────────────────────
 * 1. https://aistudio.google.com → "Get API key" → key copy (AIza...)
 * 2. Cloudflare → Worker saarthi-ai → Settings → Variables and Secrets:
 *      Add → Type: SECRET → Name: GEMINI_API_KEY → Value: AIza... → Save
 *    (GROQ_API_KEY aur ALLOWED_ORIGINS pehle jaise hi rahenge)
 * 3. Yeh POORI file Worker ke "Edit code" mein paste karo → Deploy
 *
 * ── OPTIONAL (2026-07-25, extended 2026-07-26) — EXTRA FREE Groq KEYS ──────
 * Groq ka paid Developer-tier upgrade abhi Groq ki taraf se hi band hai
 * ("temporarily unavailable due to high demand"). Jab tak woh khule, alag
 * FREE Groq accounts (console.groq.com, ALAG email — same account ki
 * multiple keys se koi fayda nahi, rate-limit account-wide hai key-wide
 * nahi) bana kar unki keys yahan add karo — har alag account ka apna alag
 * free-tier quota milta hai:
 *   Secret Name: GROQ_API_KEY_2 → Value: gsk_... (2nd free account)
 *   Secret Name: GROQ_API_KEY_3 → Value: gsk_... (3rd free account)
 *   Secret Name: GROQ_API_KEY_4 → Value: gsk_... (4th free account)
 * Worker in sabko baari-baari try karta hai (pehli key busy/429 mile tabhi),
 * Gemini par girne se pehle. Koi bhi na do toh sab pehle jaisa hi chalega.
 *
 * ── ITEM #15 — PUSH NOTIFICATION SETUP (naya, ek hi baar karna hai) ──────
 * 1. Worker → Settings → Bindings → "+ Add" → KV Namespace:
 *      Naya namespace banao (jaise "saarthi-push-subs") → Variable name: PUSH_SUBS
 * 2. Worker → Settings → Variables and Secrets → Add:
 *      Type: SECRET → Name: VAPID_PRIVATE_JWK → Value: (Saarthi ne di hui poori JSON, ek line mein)
 *      Type: TEXT   → Name: VAPID_PUBLIC_KEY  → Value: (Saarthi ne di hui public key)
 * 3. Settings → Triggers → Cron Triggers → naya/existing trigger ko is
 *    schedule se badlo: 30 2,8,13 * * *   (yeh subah/dopahar/shaam IST hai —
 *    isi cron se health-check AUR reminders dono chalenge, alag cron nahi chahiye)
 * 4. Yeh POORI file paste karo → Deploy
 *
 * ── SECURITY AUDIT FIX (2026-07-25) — /auth/verify endpoint ke liye 2 secrets ──
 * PROBLEM: Google Sign-In ka JWT ab tak client-side hi decode hota tha, kabhi
 * verify nahi — koi bhi DevTools se localStorage badal kar khud ko "owner"
 * bana sakta tha. Naya /auth/verify endpoint asli signature-check karta hai.
 * SETUP (dono zaroori hain, warna yeh endpoint kaam nahi karega):
 *   1. Type: TEXT   → Name: GOOGLE_CLIENT_ID → Value: .env wala VITE_GOOGLE_CLIENT_ID
 *      jaisa hi (xxxx.apps.googleusercontent.com)
 *   2. Type: SECRET → Name: SESSION_SECRET → Value: koi bhi lambi random string
 *      (terminal mein `openssl rand -hex 32` chala kar bana sakte ho, ya kisi
 *      bhi password-generator se 40+ characters — ek baar set karke bhool jao,
 *      dobara dekhne ki zaroorat nahi padegi)
 * UPDATE (2026-07-26): ab client-side wire ho chuka hai — AuthContext.jsx
 * sign-in ke baad yahi endpoint call karta hai aur mila hua sessionToken
 * profile mein save karta hai. gemini.js har /chat request ke saath yeh
 * token "X-Saarthi-Session" header mein bhejta hai. Neeche fetch() handler
 * mein hum isse verify karke verified-owner session ko per-IP rate-limit se
 * exempt kar dete hain (jaise ki pehle se free tha).
 *
 * UPDATE (2026-07-27, item #2 — SERVER-SIDE QUOTA) — ab per-user DAILY
 * QUOTA bhi yahi verified session se enforce hoti hai, sirf rate-limit
 * exemption nahi. PROBLEM jo fix hui: Chat/Search/Vedic ki daily-limit
 * (5/5/6) sirf browser localStorage mein thi — DevTools se clear ya
 * incognito se koi bhi apna kota reset kar sakta tha. Ab checkAndConsumeQuota()
 * (neeche) har request par usi PUSH_SUBS KV mein "q:<feature>:<identity>:<IST-date>"
 * key se ek IST-daily counter rakhta hai — identity = verified session ka
 * email (login mandatory hai, item #11), ya email na mile toh IP (safety-net,
 * seedha curl/script-abuse ke liye). Owner/paid email ko pehle jaisa hi
 * unlimited (KV touch hi nahi hota unke liye).
 * KV WRITE-BUDGET (honest trade-off, jo pehle is comment mein "risky" bataya
 * gaya tha): free-tier ~1000 writes/day deta hai. Ek user din mein zyada se
 * zyada 5(chat)+5(search)+6(vedic)=16 writes kharch kar sakta hai (sirf
 * ALLOWED attempts par write hota hai — quota-khatam par write NAHI hota,
 * KV read hi kaafi hai) — matlab ~60 active users/din tak yeh free-tier mein
 * aaraam se chalega. Zyada users aane par (real payment ke baad ka scale)
 * D1 database par migrate karna hoga — abhi ke demo/early-stage ke liye
 * KV hi kaafi hai. KV binding hi na ho (env.PUSH_SUBS missing) toh
 * checkAndConsumeQuota() FAIL-OPEN hai (allow kar deta hai, log likhta hai)
 * — poora app todne se behtar hai ki enforcement chhoot jaaye ek rare
 * misconfiguration mein.
 */

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
// Client-side tier.js ka mirror — Worker ko bhi pata hona chahiye ki
// "owner" kaun hai taaki verified session ko rate-limit se exempt kar sake.
const OWNER_EMAIL = "saurabhmonu569@gmail.com";

// ── ITEM #16 — EMBEDDING MODEL (RAG ka dil) ──────────────────────────────
// AUDIT (2026-08-01): public/embed-model/ ka model_quantized.onnx asal mein
// model tha hi nahi — woh 134-byte ka Git LFS pointer tha. Isliye
// semanticSearch() har baar chup-chaap [] laut raha tha aur poori app sirf
// keyword (Devanagari substring) search par chal rahi thi. Yehi wajah thi ki
// har jawab mein wahi 4-5 granth ghoomte the aur bilkul asambandhit sawaal
// (jaise "OCR error") par bhi Ramayana cite ho jaati thi.
//
// Naya design: client ke paas ab KOI embedding model nahi hai (118 MB model +
// 16 MB tokenizer + 10 MB wasm — teeno hata diye). Sawaal ka vector yahin
// Workers AI se banta hai. Corpus ke vectors pehle jaise hi pre-computed
// hain (ab int8 mein — 26.5 MB se 17.7 MB).
//
// Lagat: free tier 10,000 neurons/din. bge-m3 = 1075 neurons per 10 lakh
// input tokens. Ek sawaal ~20 tokens → lagbhag 4,65,000 sawaal/din free.
const EMBED_MODEL = "@cf/baai/bge-m3";   // 1024-dim, multilingual (Hindi strong)
const EMBED_MAX_BATCH = 100;             // ek call mein max texts
const EMBED_MAX_CHARS = 2000;            // per text — lamba ho toh kaat do

// ── ITEM #17 — RERANKER (jhooti citations ka asli ilaaj) ─────────────────
// NAAPA HUA (2026-08-03): "kya yeh sawaal granthon se jawab de sakta hai?"
// — yeh sirf query dekh kar tay karne ki teen koshishein fail hui:
//     raw Roman query          gap −0.05
//     syllable transliteration gap −0.06   (kachra bhi upar chadh gaya)
//     lexicon transliteration  gap +0.006  (bahut patla)
//     LLM se Hindi mein badalna gap −0.009 (anuvaad mein galtiyan)
//
// Wajah: cosine BI-ENCODER hai — query aur passage alag-alag embed hote
// hain, kabhi saath nahi padhe jaate. Woh "ye dono ek jaise dikhte hain?"
// bata sakta hai, "kya yeh passage is sawaal ka jawab deta hai?" nahi.
//
// Cross-encoder reranker dono ko EK SAATH padhta hai. Naapne par:
//     cosine     sahi-min 0.4941  kachra-max 0.4882  gap +0.0059
//     reranker   sahi-min 0.9009  kachra-max 0.0131  gap +0.8878   ← 150x
// Score bimodal hai — ya 0.90+, ya lagbhag 0. Beech mein kuch nahi.
//
// Lagat: ~1.1 neurons per sawaal (8 passages) → ~9,000 sawaal/din free.
const RERANK_MODEL = "@cf/baai/bge-reranker-base";
const RERANK_MAX_CONTEXTS = 20;
const RERANK_MAX_CHARS = 1200;
// FIX (2026-07-23): gemini-2.0-flash Google ne 1 June 2026 ko HARD SHUTDOWN kar
// diya — is model ko call karne par ab seedha error aata hai. Yeh Engine 2 tha,
// isliye pichle ~7 hafton se yeh chupke se fail ho raha tha aur har baar seedha
// Engine 3 (OpenRouter) par gir raha tha — redundancy 3 se ghatkar 2 reh gayi
// thi. Naya model: gemini-3.5-flash (Google ki official recommended replacement).
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

// Sirf yeh models manegi (koi mehenga model nahi maang sakta)
const ALLOWED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
]);

const MAX_BODY_BYTES = 100_000;
// FIX (2026-07-24, tuned 2026-07-25): 2000→2200 kiya tha truncation fix
// karne ke liye, par uske baad Groq (429) + Gemini (429 "quota exceeded" +
// 503 "high demand") dono baar-baar fail hone lage — bade max_tokens =
// zyada TPM (tokens/minute) kharch per-request, jo free-tier ki asli
// seema hai (RPM nahi). 1600 par settle — truncation-safe, kam TPM-bhaari.
const MAX_TOKENS_CAP = 1600;

// ── KAVACH 2: per-IP raftaar-seema ──
// FIX (2026-07-25 audit): purana limiter sirf in-memory Map tha — Cloudflare
// Workers globally distributed hain (alag-alag edge/isolate), toh yeh
// globally consistent NAHI tha (ek user alag edge locations se isse
// bypass kar sakta tha). Ab agar PUSH_SUBS KV bound hai (push-notification
// setup ke liye already hai), usi KV mein "rl:<ip>" key se GLOBAL counter
// rakhte hain (60s TTL — apne aap expire). KV na ho ya fail ho jaaye toh
// purana in-memory tareeka fallback ke roop mein chalu rehta hai — kabhi
// bhi hard-fail nahi hota, "fail open" design hai.
const RATE_PER_MIN = 20;
const _hits = new Map();

async function checkRateLimit(ip, env) {
  if (env.PUSH_SUBS) {
    try {
      const key = `rl:${ip}`;
      const raw = await env.PUSH_SUBS.get(key);
      const n = raw ? parseInt(raw, 10) || 0 : 0;
      if (n >= RATE_PER_MIN) return false;
      // KV writes eventually-consistent hain (~kuch second lag sakta hai) —
      // ek chhoti burst race-condition ho sakti hai, par abuse-prevention
      // ke liye yeh kaafi hai; exact billing-grade counter nahi hai.
      await env.PUSH_SUBS.put(key, String(n + 1), { expirationTtl: 60 });
      return true;
    } catch (e) {
      console.log("[SAARTHI] KV rate-limit FAIL, in-memory fallback: " + (e?.message || e));
      // neeche in-memory fallback par gir jao
    }
  }
  const now = Date.now();
  const h = _hits.get(ip);
  if (!h || now - h.ts > 60_000) { _hits.set(ip, { ts: now, n: 1 }); return true; }
  if (++h.n > RATE_PER_MIN) return false;
  if (_hits.size > 5000) _hits.clear();
  return true;
}

// ── ITEM #2 — SERVER-SIDE DAILY QUOTA (Chat/Search/Vedic) ────────────────
// Client-side constants ka mirror (src/services/quota.js + useChat.js) —
// yahan badalne par udhar bhi badalna (dono jagah hardcoded hain, jaan-
// boojh kar — is Worker file ko koi build-step import client code se
// nahi karta, "paste code" deploy workflow ke saath ek shared-constants
// file ka fayda nahi tha).
const QUOTA_LIMITS = { chat: 5, search: 5, vedic: 6 };
const QUOTA_TTL_SECS = 2 * 24 * 3600; // 2 din — agle din ka counter apne aap fresh, purana apne aap saaf

// IST (UTC+5:30) date-string — reset ka din bharat ke hisaab se badle,
// UTC midnight ke hisaab se nahi (warna raat 5:30 baje hi kota reset ho
// jaata, jab India mein abhi din chal raha hota).
function istDateStr() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Ek feature-attempt ko check-aur-consume karta hai, ATOMIC roop mein (ek
 * hi KV read+write) — TOCTOU race ki chinta ke bina. `identity` = verified
 * session ka email (normal case) ya "ip:<ip>" (session na mile toh safety-net).
 * Return: { allowed, remaining, limit }. Limit khatam ho toh KV WRITE nahi
 * hota (sirf ek read) — isse abuse/retry traffic KV write-budget nahi khaata.
 */
async function checkAndConsumeQuota(env, identity, feature) {
  const limit = QUOTA_LIMITS[feature] || 5;
  if (!env.PUSH_SUBS) {
    // KV bound hi nahi — fail-open (upar comment dekhein), enforcement
    // skip par app chalta rahta hai.
    console.log("[SAARTHI-QUOTA] KV not bound — fail-open for " + feature);
    return { allowed: true, remaining: limit, limit };
  }
  try {
    const key = `q:${feature}:${identity}:${istDateStr()}`;
    const raw = await env.PUSH_SUBS.get(key);
    const used = raw ? (parseInt(raw, 10) || 0) : 0;
    if (used >= limit) return { allowed: false, remaining: 0, limit };
    await env.PUSH_SUBS.put(key, String(used + 1), { expirationTtl: QUOTA_TTL_SECS });
    return { allowed: true, remaining: Math.max(0, limit - (used + 1)), limit };
  } catch (e) {
    console.log("[SAARTHI-QUOTA] KV FAIL, fail-open: " + (e?.message || e));
    return { allowed: true, remaining: limit, limit };
  }
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // X-Saarthi-Session: verified-owner ke liye rate-limit exemption (neeche
    // fetch() handler mein dekhein) — sirf yeh ek naya header add kiya hai.
    "Access-Control-Allow-Headers": "Content-Type, X-Saarthi-Session",
    "Access-Control-Max-Age":       "86400",
  };
}

function jsonResponse(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ── AUTH: Google ID token verification (audit 2026-07-25, P0 security) ──
// PROBLEM FOUND: src/context/AuthContext.jsx ka decodeJwtPayload() Google
// ke ID token ko sirf base64-decode karta hai — signature KABHI verify
// nahi hoti. Koi bhi browser DevTools se seedha
// localStorage.setItem("SAARTHI_USER_PROFILE", '{"email":"owner@..."}')
// chala kar khud ko "owner/unlimited" bana sakta hai, bina Google ka
// password jaane. Yeh naya /auth/verify endpoint ASLI verification karta
// hai (Google ke public JWKS se RS256 signature check + audience + expiry)
// aur ek apna, HMAC-signed session-token issue karta hai jise client baad
// mein bhej sakta hai — yeh token bina SESSION_SECRET jaane forge NAHI ho
// sakta.
//
// SCOPE-NOTE (honest): abhi yeh endpoint sirf VERIFICATION + token-issue
// karta hai. Client-side (AuthContext/useChat/App.jsx) ko is token ko
// istemal karne ke liye wire karna abhi BAAKI hai (agla kadam) — is single
// pass mein poori auth-pipeline blind rewire karna risky tha (auth tootne
// ka blast-radius poora app hai, aur main is Worker ko live test nahi kar
// sakta yahan se). Isliye: yeh endpoint additive hai, kisi existing cheez
// ko todta nahi — jab tak client isse call na kare, app bilkul pehle jaisa
// chalta hai. GROQ/GEMINI_API_KEY jaisa hi, ek naya secret chahiye:
//   Secret Name: SESSION_SECRET → Value: (koi bhi lambi random string, jaise
//   `openssl rand -hex 32` se banayi hui — password manager mein bhi save
//   rakhna, aap khud yeh nahi dekh paayenge dobara)

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
let _jwksCache = null, _jwksCacheAt = 0;

async function getGoogleJwks() {
  if (_jwksCache && Date.now() - _jwksCacheAt < 3600_000) return _jwksCache;
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error("Google JWKS fetch failed: HTTP " + res.status);
  const data = await res.json();
  _jwksCache = data.keys || [];
  _jwksCacheAt = Date.now();
  return _jwksCache;
}

function b64urlToBytes(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Google ID token (JWT) ki ASLI signature verify karta hai — RS256, JWKS se.
 * Return: verified payload ({ email, name, picture, sub, ... }).
 * Throw: koi bhi cheez match na ho toh (galat audience, expired, bad sig...).
 */
async function verifyGoogleIdToken(idToken, env) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [headerB64, payloadB64, sigB64] = parts;

  const header  = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));

  if (!env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID secret set nahi hai worker mein");
  if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error("audience mismatch");
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("bad issuer");
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error("token expired");

  const jwks = await getGoogleJwks();
  const jwk = jwks.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("no matching Google signing key (kid mismatch)");

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sigB64), signedData);
  if (!ok) throw new Error("signature verification failed");

  return payload;
}

/** Apna HMAC-signed session token — Google token expire (~1hr) ho jaane ke
 * baad bhi client 24h tak "verified" reh sakta hai, bina Google ko dobara
 * call kiye. SESSION_SECRET ke bina koi bhi isse forge nahi kar sakta. */
async function issueSessionToken(claims, env) {
  const payload = { ...claims, exp: Date.now() + 24 * 3600_000 };
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

/** Session token verify — HMAC signature check + expiry. Returns claims ya null. */
async function verifySessionToken(token, env) {
  try {
    const [payloadB64, sigB64] = String(token || "").split(".");
    if (!payloadB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(env.SESSION_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sigB64), new TextEncoder().encode(payloadB64));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch { return null; }
}

// ── ENGINE 2: OpenAI-style messages → Gemini format → OpenAI-style jawab ──
// DIAGNOSTIC LOGS (2026-07-23): "kaunsi key kahan chal rahi hai" verify karne
// ke liye — Cloudflare dashboard → Worker → Logs (ya "wrangler tail") mein
// live dikhega ki har request ENGINE 1/2/3 mein se kis se hokar gayi.
async function tryGemini(safeBody, env) {
  if (!env.GEMINI_API_KEY) { console.log("[SAARTHI] ENGINE 2 (Gemini) SKIP — GEMINI_API_KEY set nahi hai"); return null; }

  const sys      = safeBody.messages.find(m => m.role === "system");
  const contents = safeBody.messages
    .filter(m => m.role !== "system" && (m.content || "").trim())
    .map(m => ({ role: m.role === "assistant" ? "model" : "user",
                 parts: [{ text: m.content }] }));
  if (!contents.length) return null;

  // BUG FOUND (2026-07-23, confirmed via live Observability logs): gemini-3.5-flash
  // "thinking" (reasoning) DEFAULT ON rakhta hai — chhote max_tokens (jaise app ke
  // 1000-2000) mein poora budget internal "sochne" mein hi khatam ho jaata tha,
  // asli jawab ke liye ek token bhi nahi bachta tha (finishReason: MAX_TOKENS,
  // content khaali). Fix: thinkingLevel "low" (yeh model ke liye "off" ke sabse
  // kareeb hai) + thoda zyada maxOutputTokens taaki jawab ke liye jagah bache.
  const payload = {
    contents,
    ...(sys ? { systemInstruction: { parts: [{ text: sys.content }] } } : {}),
    generationConfig: {
      temperature:      safeBody.temperature,
      maxOutputTokens:  Math.max(safeBody.max_tokens, 1300),
      thinkingConfig:   { thinkingLevel: "low" },
    },
  };

  try {
    const res = await fetch(GEMINI_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.log(`[SAARTHI] ENGINE 2 (Gemini) FAIL — HTTP ${res.status} — ${errBody.slice(0, 300)}`);
      return null;                       // Gemini bhi vyast/fail → null
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || "").join("").trim();
    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || "unknown";
      console.log(`[SAARTHI] ENGINE 2 (Gemini) FAIL — khaali jawab, reason=${reason}, raw=${JSON.stringify(data).slice(0, 300)}`);
      return null;
    }
    console.log("[SAARTHI] ENGINE 2 (Gemini) OK ✅ — is jawab ko yehi de raha hai");
    // OpenAI-shape mein lapet ke wapas — frontend ko kuch nahi badalna padta
    return {
      model: "gemini-3.5-flash",
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    };
  } catch (e) {
    console.log("[SAARTHI] ENGINE 2 (Gemini) FAIL — network/exception: " + (e?.message || e));
    return null;
  }
}

// ── ENGINE 3: OpenRouter (wahi 70b model, FREE tier, seedha OpenAI-format) ──
const OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions";
// FIX (2026-07-23, live-confirmed via Observability logs): purana free-tier
// "llama-3.3-70b-instruct:free" OpenRouter ne paid-only bana diya — HTTP 404
// "This model is unavailable for free" milta tha. Naya: Tencent Hy3 — 295B
// MoE, anti-hallucination-focused (jo bilkul SAARTHI ke PRAMAAN-niyam se
// milta hai), default "no-think" mode (Gemini jaisi thinking-budget dikkat
// nahi), 262K context, abhi (July 2026) genuinely free-tier par live hai.
const OPENROUTER_MODEL = "tencent/hy3:free";

async function tryOpenRouter(safeBody, env, origin) {
  if (!env.OPENROUTER_API_KEY) { console.log("[SAARTHI] ENGINE 3 (OpenRouter) SKIP — OPENROUTER_API_KEY set nahi hai"); return null; }
  try {
    const res = await fetch(OPENROUTER_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer":  origin || "https://saarthi-gyaan.netlify.app",
        "X-Title":       "SAARTHI GYAAN",
      },
      body: JSON.stringify({ ...safeBody, model: OPENROUTER_MODEL }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      // Purani 300-char limit OpenRouter ke suggested-model-slug ko beech mein kaat
      // rahi thi ("...use this slug instead: me...") — 600 kar diya taaki poora dikhe.
      console.log(`[SAARTHI] ENGINE 3 (OpenRouter) FAIL — HTTP ${res.status} — ${errBody.slice(0, 600)}`);
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) { console.log("[SAARTHI] ENGINE 3 (OpenRouter) FAIL — khaali jawab"); return null; }
    console.log("[SAARTHI] ENGINE 3 (OpenRouter) OK ✅ — is jawab ko yehi de raha hai");
    data.model = "openrouter-70b";
    return data;
  } catch {
    return null;
  }
}

// ── PUSH NOTIFICATIONS (item #15) — Web Push (RFC8291/8292), Web Crypto se
// hi likha gaya hai (koi npm package nahi — dashboard "Edit code" paste-only
// workflow ke saath compatible rehna zaroori tha). Har function ek chhota,
// well-known standard step hai; poora flow "web-push" library jaisa hi hai,
// bas Cloudflare Workers ke native SubtleCrypto se seedha implement kiya.
// ──────────────────────────────────────────────────────────────────────────

function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function concatBytes(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// VAPID JWT (ES256) — server ki pehchaan, push-service (FCM/Mozilla) ko
// batati hai ki yeh SAARTHI hi hai jo bhej raha hai.
async function buildVapidHeader(endpoint, env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const aud = new URL(endpoint).origin;
  const header  = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:saurabhmonu569@gmail.com" };
  const enc = new TextEncoder();
  const signingInput = b64urlEncode(enc.encode(JSON.stringify(header))) + "." + b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sigBits = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)
  );
  const jwt = signingInput + "." + b64urlEncode(new Uint8Array(sigBits));
  return `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;
}

// HKDF (RFC5869) — extract aur expand ALAG hain (extract sirf EK baar chalta
// hai per-derivation, expand baar-baar alag "info" ke saath bulaya jaata
// hai). Pehle in dono ko galti se ek hi function mein jod diya tha — cek/
// nonce ke liye phir se "extract" ho raha tha jab ki sirf "expand" chahiye
// tha. Ab sahi tarike se do function.
async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = await crypto.subtle.sign("HMAC", key, ikm);
  return new Uint8Array(prk);
}
async function hkdfExpand(prk, info, length) {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const t = await crypto.subtle.sign("HMAC", key, concatBytes(info, new Uint8Array([1])));
  return new Uint8Array(t).slice(0, length);
}

/**
 * RFC8291 payload encryption (aes128gcm) — subscription ke p256dh/auth ke
 * saath, ek naye ephemeral keypair se, message ko encrypt karta hai taaki
 * sirf browser hi (jisne subscribe kiya) usse padh sake — push-service
 * (Google/Mozilla) khud content nahi dekh sakta.
 */
async function encryptPayload(subscription, payloadObj) {
  const uaPublicBytes = b64urlDecode(subscription.keys.p256dh);
  const authSecret    = b64urlDecode(subscription.keys.auth);

  const uaKey = await crypto.subtle.importKey(
    "raw", uaPublicBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaKey }, asKeyPair.privateKey, 256
  );
  const ecdhSecret = new Uint8Array(sharedSecretBits);

  const enc = new TextEncoder();
  // Step 1: auth_secret ko salt bana kar ECDH shared-secret se ek IKM nikalo
  // (RFC8291 §3.4) — dono public keys "info" mein shamil hain taaki dono
  // taraf (bhejne wala + browser) isi IKM par pahunchein.
  const keyInfo   = concatBytes(enc.encode("WebPush: info\0"), uaPublicBytes, asPublicRaw);
  const prkKeyStep = await hkdfExtract(authSecret, ecdhSecret);
  const ikm = await hkdfExpand(prkKeyStep, keyInfo, 32);

  // Step 2: RFC8188 aes128gcm content-encoding — is IKM se, ek RANDOM salt
  // (har message alag) ke saath, asli encryption key (CEK) aur nonce banao.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk  = await hkdfExtract(salt, ikm);
  const cek   = await hkdfExpand(prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const plaintext = concatBytes(enc.encode(JSON.stringify(payloadObj)), new Uint8Array([2])); // 0x02 = last record
  const gcmKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipherBits = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, gcmKey, plaintext);
  const ciphertext = new Uint8Array(cipherBits);

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const idLen = new Uint8Array([asPublicRaw.length]);

  return concatBytes(salt, recordSize, idLen, asPublicRaw, ciphertext);
}

/**
 * sendWebPush — ek subscriber ko ek notification bhejta hai.
 * Returns { ok: true } ya { ok: false, expired: boolean } (410/404 = user
 * ne browser mein notification band kar di / bahut purana ho gaya — is
 * subscription ko KV se hata dena chahiye).
 */
async function sendWebPush(subscription, payloadObj, env) {
  try {
    const body = await encryptPayload(subscription, payloadObj);
    const auth = await buildVapidHeader(subscription.endpoint, env);
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type":     "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL":              "86400",
        "Authorization":    auth,
      },
      body,
    });
    if (res.ok) return { ok: true };
    const expired = res.status === 404 || res.status === 410;
    console.log(`[SAARTHI-PUSH] send FAIL — HTTP ${res.status}${expired ? " (expired, removing)" : ""}`);
    return { ok: false, expired };
  } catch (e) {
    console.log("[SAARTHI-PUSH] send exception: " + (e?.message || e));
    return { ok: false, expired: false };
  }
}

// Din ke 3 samay ke hisaab se alag-alag, saral, request-karne wale sur mein
// message — spec ki maang thi "very simple and requesting tone".
function reminderMessage(hourUTC, lang) {
  const istHour = (hourUTC + 5.5) % 24; // rough IST slot label ke liye
  const slot = istHour < 11 ? "morning" : istHour < 16 ? "afternoon" : "evening";
  const MSGS = {
    hi: {
      morning:   { title: "सुप्रभात 🌅",        body: "आज का अमृत पढ़ें और अपने मन का एक सवाल पूछें 🙏" },
      afternoon: { title: "SAARTHI GYAAN 🕉️",   body: "थोड़ी देर रुककर आज का ज्ञान पढ़ लेंगे? बस 2 मिनट का समय चाहिए 🙏" },
      evening:   { title: "शुभ संध्या 🪔",       body: "दिन खत्म होने से पहले एक बार SAARTHI से मिल लें — आज का अमृत आपका इंतज़ार कर रहा है 🙏" },
    },
    en: {
      morning:   { title: "Good morning 🌅",     body: "Read today's Amrit and ask a question that's on your mind 🙏" },
      afternoon: { title: "SAARTHI GYAAN 🕉️",    body: "Got 2 minutes? Today's wisdom is waiting for you 🙏" },
      evening:   { title: "Good evening 🪔",     body: "Before the day ends, take a moment with SAARTHI — today's Amrit is ready 🙏" },
    },
  };
  const m = (MSGS[lang] || MSGS.hi)[slot];
  return { title: m.title, body: m.body, url: "/", tag: "saarthi-daily" };
}

export default {
  async fetch(request, env) {
    const origin  = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",").map(s => s.trim()).filter(Boolean);

    if (!allowed.some(a => origin === a)) {
      return new Response(JSON.stringify({ error: { message: "Origin not allowed" } }),
        { status: 403, headers: { "Content-Type": "application/json" } });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // SECURITY FIX (2026-07-26): agar client ne asli-verified session bheja
    // hai (Google se signature-verified, Worker ke apne HMAC se signed) aur
    // voh owner email hai, toh rate-limit se exempt karo — bilkul waisa hi
    // jaisa pehle client apne daave se hota tha, bas ab yeh daava crypto se
    // verify hota hai, sirf localStorage ke bharose nahi.
    const sessionTok = request.headers.get("X-Saarthi-Session") || "";
    let verifiedOwner = false;
    let sessionEmail  = ""; // item #2: quota-identity ke liye — owner na ho tab bhi email chahiye
    if (sessionTok) {
      const claims = await verifySessionToken(sessionTok, env);
      if (claims) {
        sessionEmail  = (claims.email || "").trim().toLowerCase();
        verifiedOwner = sessionEmail === OWNER_EMAIL;
      }
    }

    // KAVACH 2: per-IP raftaar-seema (ab KV-backed — global, edge-consistent)
    const ip = request.headers.get("CF-Connecting-IP") || "?";
    if (!verifiedOwner && !(await checkRateLimit(ip, env))) {
      return jsonResponse({ error: { message: "Bahut tez! Thoda dheere 🙏 (rate limit)" } }, 429, origin);
    }
    // item #2: quota-identity — verified email mile toh wahi (asli, spoof-proof
    // pehchan), warna IP (safety-net, seedha-script/curl abuse ke liye).
    const quotaIdentity = sessionEmail ? `email:${sessionEmail}` : `ip:${ip}`;

    const url = new URL(request.url);

    // ── QUOTA CONSUME (item #2) — Search + Vedic client se yahan call karte
    // hain (Chat ki apni gate neeche /chat handler ke andar hai, kyunki woh
    // request khud hi Worker tak aati hai — alag round-trip ki zaroorat nahi).
    if (request.method === "POST" && url.pathname === "/quota/consume") {
      let b;
      try { b = JSON.parse(await request.text()); } catch { return jsonResponse({ error: { message: "Bad JSON" } }, 400, origin); }
      const feature = b?.feature;
      if (!QUOTA_LIMITS[feature]) return jsonResponse({ error: { message: "Unknown feature" } }, 400, origin);
      if (verifiedOwner) return jsonResponse({ allowed: true, remaining: "unlimited", limit: "unlimited" }, 200, origin);
      const q = await checkAndConsumeQuota(env, quotaIdentity, feature);
      return jsonResponse(q, q.allowed ? 200 : 429, origin);
    }

    // ── EMBED (item #16) — sawaal ka vector banao ────────────────────────
    // Body: { text: "sawaal" }  ya  { text: ["a","b",...] }  (max 100)
    // Reply: { vectors: [[...1024 floats...]], dim: 1024, model: "..." }
    //
    // Client (semanticSearch.js) har sawaal se pehle isse ek baar bulata hai,
    // phir us vector ko pehle se download kiye gaye corpus vectors ke saath
    // cosine-compare karta hai. Corpus vectors client par hi rehte hain —
    // sirf query ka embedding server par banta hai.
    //
    // Upar ka origin-allowlist + rate-limit isi handler mein already lag
    // chuka hai, isliye yahan alag se auth ki zaroorat nahi.
    if (request.method === "POST" && url.pathname === "/embed") {
      if (!env.AI) {
        console.log("[SAARTHI-EMBED] AI binding missing — Settings → Bindings → Workers AI (name: AI)");
        return jsonResponse({ error: { message: "AI binding not configured" } }, 500, origin);
      }
      let b;
      try { b = JSON.parse(await request.text()); } catch { return jsonResponse({ error: { message: "Bad JSON" } }, 400, origin); }
      const raw = b?.text;
      const texts = (Array.isArray(raw) ? raw : [raw])
        .filter(t => typeof t === "string" && t.trim())
        .map(t => t.trim().slice(0, EMBED_MAX_CHARS));
      if (!texts.length) {
        return jsonResponse({ error: { message: "text required" } }, 400, origin);
      }
      if (texts.length > EMBED_MAX_BATCH) {
        return jsonResponse({ error: { message: `max ${EMBED_MAX_BATCH} texts per call` } }, 400, origin);
      }
      try {
        const out = await env.AI.run(EMBED_MODEL, { text: texts });
        // Workers AI ka reply shape model/version ke saath thoda badalta rehta
        // hai — teeno aam roop handle kar lo, taaki upgrade par chup-chaap na
        // toote (yehi galti pichli baar semantic search ke saath hui thi).
        const vecs = out?.data || out?.result?.data || (Array.isArray(out) ? out : null);
        if (!Array.isArray(vecs) || !vecs.length || !Array.isArray(vecs[0])) {
          console.log("[SAARTHI-EMBED] unexpected shape: " + JSON.stringify(out).slice(0, 200));
          return jsonResponse({ error: { message: "embedding failed" } }, 502, origin);
        }
        return jsonResponse({ vectors: vecs, dim: vecs[0].length, model: EMBED_MODEL }, 200, origin);
      } catch (e) {
        console.log("[SAARTHI-EMBED] FAIL — " + (e?.message || e));
        return jsonResponse({ error: { message: "embedding failed" } }, 502, origin);
      }
    }

    // ── RERANK (item #17) — "kya yeh passage sach mein jawab deta hai?" ──
    // Body:  { query: "...", contexts: ["passage1", "passage2", ...] }
    // Reply: { scores: [0.94, 0.01, ...] }  — input ke HI kram mein
    //
    // Kram bahut zaroori hai: Workers AI apna jawab index ke saath deta hai
    // (kabhi score ke hisaab se sorted). Hum use wapas input-order mein
    // rakh kar lautate hain, taaki client seedha apne chunks se joda kar
    // sake — index ghalat hua toh galat passage cite ho jayega.
    if (request.method === "POST" && url.pathname === "/rerank") {
      if (!env.AI) return jsonResponse({ error: { message: "AI binding not configured" } }, 500, origin);
      let b;
      try { b = JSON.parse(await request.text()); } catch { return jsonResponse({ error: { message: "Bad JSON" } }, 400, origin); }

      const query = typeof b?.query === "string" ? b.query.trim().slice(0, EMBED_MAX_CHARS) : "";
      const ctxIn = Array.isArray(b?.contexts) ? b.contexts : [];
      const contexts = ctxIn
        .map(c => (typeof c === "string" ? c : c?.text) || "")
        .map(t => t.trim().slice(0, RERANK_MAX_CHARS));

      if (!query) return jsonResponse({ error: { message: "query required" } }, 400, origin);
      if (!contexts.length) return jsonResponse({ scores: [] }, 200, origin);
      if (contexts.length > RERANK_MAX_CONTEXTS) {
        return jsonResponse({ error: { message: `max ${RERANK_MAX_CONTEXTS} contexts` } }, 400, origin);
      }

      try {
        const out = await env.AI.run(RERANK_MODEL, {
          query,
          contexts: contexts.map(text => ({ text })),
          top_k: contexts.length,
        });
        const list = out?.response || out?.result?.response || (Array.isArray(out) ? out : null);
        if (!Array.isArray(list)) {
          console.log("[SAARTHI-RERANK] unexpected shape: " + JSON.stringify(out).slice(0, 200));
          return jsonResponse({ error: { message: "rerank failed" } }, 502, origin);
        }
        // input-order mein wapas rakho
        const scores = new Array(contexts.length).fill(0);
        for (const item of list) {
          const i = item?.id ?? item?.index;
          const s = item?.score ?? item?.relevance_score;
          if (Number.isInteger(i) && i >= 0 && i < scores.length && typeof s === "number") scores[i] = s;
        }
        return jsonResponse({ scores, model: RERANK_MODEL }, 200, origin);
      } catch (e) {
        console.log("[SAARTHI-RERANK] FAIL — " + (e?.message || e));
        return jsonResponse({ error: { message: "rerank failed" } }, 502, origin);
      }
    }

    // ── PUSH SUBSCRIBE/UNSUBSCRIBE (item #15) ────────────────────────────
    if (request.method === "POST" && url.pathname === "/push/subscribe") {
      if (!env.PUSH_SUBS) return jsonResponse({ error: { message: "Push storage not configured" } }, 500, origin);
      let b;
      try { b = JSON.parse(await request.text()); } catch { return jsonResponse({ error: { message: "Bad JSON" } }, 400, origin); }
      const sub = b?.subscription;
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return jsonResponse({ error: { message: "Invalid subscription" } }, 400, origin);
      }
      // Key = endpoint ka hash bana sakte the, par endpoint khud hi kaafi
      // unique hai (har browser-install ka apna URL hota hai) — seedha use.
      const key = "sub:" + sub.endpoint.slice(-180);
      // AUDIT FIX D2 (2026-08-03): pehle email/name seedha client ke bheje
      // hue body se store hote the — jabki isi handler mein upar
      // verifySessionToken() se nikla, crypto-verified `sessionEmail`
      // pehle se maujood hai. Allowed origin se koi bhi request kisi bhi
      // email ke naam par subscription bana sakti thi.
      //
      // Ab: verified session ho toh WAHI email maano. Na ho (bina sign-in
      // ke bhi reminders chalne chahiye) tabhi client ka bheja hua lo, aur
      // use "unverified" nishan ke saath rakho — taaki baad mein pata rahe
      // ki kaunsi pehchan bharosemand hai.
      const subEmail = sessionEmail || (b.email || "").trim().slice(0, 200);
      await env.PUSH_SUBS.put(key, JSON.stringify({
        subscription: sub,
        email: subEmail,
        emailVerified: Boolean(sessionEmail),
        name:  (b.name  || "").slice(0, 100),
        lang:  b.lang === "en" ? "en" : "hi",
        addedAt: Date.now(),
      }));
      console.log(`[SAARTHI-PUSH] naya subscriber joda gaya (${subEmail || "no-email"}`
        + `${sessionEmail ? ", verified" : ", unverified"})`);
      return jsonResponse({ ok: true }, 200, origin);
    }
    if (request.method === "POST" && url.pathname === "/push/unsubscribe") {
      if (!env.PUSH_SUBS) return jsonResponse({ error: { message: "Push storage not configured" } }, 500, origin);
      let b;
      try { b = JSON.parse(await request.text()); } catch { return jsonResponse({ error: { message: "Bad JSON" } }, 400, origin); }
      if (b?.endpoint) await env.PUSH_SUBS.delete("sub:" + b.endpoint.slice(-180));
      return jsonResponse({ ok: true }, 200, origin);
    }

    // ── AUTH VERIFY (audit 2026-07-25, P0 security — see comment block
    // above verifyGoogleIdToken) ───────────────────────────────────────
    // Client bhejta hai: { idToken } (Google se mila raw credential).
    // Worker asli signature verify karta hai, phir apna signed
    // sessionToken deta hai. Google ko trust karna abhi bhi zaroori hai
    // (voh hi issue karta hai) — bas ab hum khud check karte hain ki
    // token genuinely unhi ne banaya, na ki koi client-side chaalbaazi.
    if (request.method === "POST" && url.pathname === "/auth/verify") {
      let b;
      try { b = JSON.parse(await request.text()); } catch { return jsonResponse({ ok: false, error: "Bad JSON" }, 400, origin); }
      if (!b?.idToken) return jsonResponse({ ok: false, error: "idToken required" }, 400, origin);
      try {
        const payload = await verifyGoogleIdToken(b.idToken, env);
        const claims  = { email: payload.email || "", name: payload.name || "", sub: payload.sub || "" };
        const sessionToken = await issueSessionToken(claims, env);
        return jsonResponse({ ok: true, sessionToken, ...claims }, 200, origin);
      } catch (e) {
        console.log("[SAARTHI-AUTH] verify FAIL — " + (e?.message || e));
        return jsonResponse({ ok: false, error: "Verification failed" }, 401, origin);
      }
    }

    if (request.method !== "POST" || url.pathname !== "/chat") {
      return jsonResponse({ error: { message: "Use POST /chat" } }, 404, origin);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: { message: "Request too large" } }, 413, origin);
    }

    let body;
    try { body = JSON.parse(raw); } catch {
      return jsonResponse({ error: { message: "Bad JSON" } }, 400, origin);
    }

    const model = ALLOWED_MODELS.has(body.model) ? body.model : "llama-3.3-70b-versatile";
    const safeBody = {
      model,
      messages:    Array.isArray(body.messages) ? body.messages : [],
      temperature: typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1) : 0.55,
      max_tokens:  Math.min(Number(body.max_tokens) || 1400, MAX_TOKENS_CAP),
    };

    // ── KAVACH 1 (item #2, server-side): daily Chat-kota — client apna
    // localStorage-based pre-check pehle karta hai (fast UX), par ASLI
    // gate yeh hai — is ke bina koi bhi localStorage clear/incognito se
    // kota bypass kar sakta tha. Owner/paid email ko chhod kar sabke liye.
    // Note: attempt yahin consume ho jaata hai (Groq/Gemini dono fail ho
    // jaayein tab bhi) — jaan-boojh kar simple rakha, do-engine fallback
    // hone se poora-outage rare hai (jaise ki upar comment mein bataya).
    if (!verifiedOwner) {
      const cq = await checkAndConsumeQuota(env, quotaIdentity, "chat");
      if (!cq.allowed) {
        return jsonResponse({ error: { message: "Aaj ka mufta AI-kota poora ho gaya — kal fir try karein 🙏", code: "QUOTA_EXCEEDED" } }, 429, origin);
      }
    }

    // ── DEBUG/TEST HOOK (2026-07-23): "kaunsi key kaam kar rahi hai" seedha
    // verify karne ke liye — normal app traffic isse kabhi nahi bhejta, sirf
    // manual curl test ke liye. body mein { "_forceEngine": "gemini" } ya
    // "openrouter" bhejo toh Groq ko bypass karke seedha uss engine ko test
    // karta hai. Production users par koi asar nahi (yeh field kabhi nahi
    // bhejte).
    if (body._forceEngine === "gemini") {
      const g = await tryGemini(safeBody, env);
      return g ? jsonResponse(g, 200, origin) : jsonResponse({ error: { message: "ENGINE 2 (Gemini) test FAILED — Logs tab mein wajah dekhein" } }, 502, origin);
    }
    if (body._forceEngine === "openrouter") {
      const o = await tryOpenRouter(safeBody, env, origin);
      return o ? jsonResponse(o, 200, origin) : jsonResponse({ error: { message: "ENGINE 3 (OpenRouter) test FAILED — Logs tab mein wajah dekhein" } }, 502, origin);
    }

    // ── ENGINE 1: Groq 70b — AB EK SE ZYADA FREE KEYS TAK TRY KARTA HAI ──
    // FIX (2026-07-25, extended 2026-07-26): Groq ka paid Developer-tier
    // upgrade abhi khud Groq ki taraf se "temporarily unavailable due to
    // high demand" hai — user ke control mein nahi. Jab tak woh khule,
    // sabse simple free lever: alag FREE Groq accounts (alag email) bana
    // kar unki keys yahan GROQ_API_KEY_2 / _3 / _4 secret ke roop mein add
    // karo — har ALAG account ka apna ALAG free-tier quota hota hai, toh
    // worker ab ek key rate-limit (429) hote hi khud-b-khud agli try karta
    // hai, Gemini par girne se PEHLE. Agar sirf GROQ_API_KEY hi set hai
    // (jaisa pehle tha), yeh bilkul pehle jaisa hi behave karta hai — kuch
    // tootega nahi.
    const groqKeys = [env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3, env.GROQ_API_KEY_4].filter(Boolean);
    let groqRes, groqText;
    for (let i = 0; i < groqKeys.length; i++) {
      groqRes = await fetch(GROQ_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKeys[i]}` },
        body:    JSON.stringify(safeBody),
      });
      if (groqRes.ok) {
        groqText = await groqRes.text();
        console.log(`[SAARTHI] ENGINE 1 (Groq, key #${i + 1}) OK ✅ — is jawab ko yehi de raha hai`);
        return new Response(groqText, {
          status:  groqRes.status,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      groqText = await groqRes.text();
      console.log(`[SAARTHI] ENGINE 1 (Groq, key #${i + 1}) FAIL — HTTP ${groqRes.status}`);
      // 429/5xx par hi agli key try karo (auth/400 jaisi galti sabhi keys mein
      // ek jaisi hogi — waqt zaya na karo, seedha Gemini par chale jao)
      if (!(groqRes.status === 429 || groqRes.status >= 500)) break;
    }

    // ── ROUTER: Groq vyast (429) ya gira (5xx) → Engine 2 (Gemini) ──
    // FAISLA (2026-07-23): Engine 3 (OpenRouter) production traffic se HATA
    // diya — (1) uske free models baar-baar bina chetavni ke paid-only ho
    // jaate hain (aaj hi 2 baar dekha), (2) free-tier access ke liye "Model
    // Training" privacy setting chahiye — user ki niji baatein (gussa, dar,
    // rishtey) kisi aur company ke training data mein jaane ka risk, sirf
    // ek rare fallback ke liye theek nahi. Groq + Gemini dono alag, badi,
    // sthir companies hain aur milkar kaafi capacity dete hain. tryOpenRouter
    // function aur upar wala _forceEngine debug-hook jaan-boojhkar rakha hai
    // — future mein zaroorat pade toh sirf ek line uncomment karke wapas
    // chalu ho sakta hai, function delete nahi karna pada.
    if (groqRes.status === 429 || groqRes.status >= 500) {
      const g = await tryGemini(safeBody, env);
      if (g) return jsonResponse(g, 200, origin);
    }

    // Dono engines fail → Groq ka asli jawab (429 etc.) — app dhyan-magn dikhayegi
    return new Response(groqText, {
      status:  groqRes.status,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },

  // ── ROZANA KHUD-B-KHUD HEALTH-CHECK (Option C) ──────────────────────────
  // Cloudflare dashboard → Worker → Settings → Triggers → Cron Triggers mein
  // ek schedule add karo (jaise roz subah "0 4 * * *" = 9:30 AM IST). Yeh
  // function roz Groq + Gemini dono ko ek chhota test-sawaal bhejta hai aur
  // Observability logs mein SAAF OK/FAIL likh deta hai — taaki koi chaabi
  // chupke se hafton tak toothi na rahe (jaisa Gemini ke saath hua tha).
  async scheduled(event, env, ctx) {
    const testBody = {
      model:       "llama-3.3-70b-versatile",
      messages:    [{ role: "user", content: "Reply with exactly one word: OK" }],
      temperature: 0.1,
      max_tokens:  10,
    };

    // Engine 1: Groq
    try {
      const res = await fetch(GROQ_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.GROQ_API_KEY}` },
        body:    JSON.stringify(testBody),
      });
      console.log(res.ok
        ? "[SAARTHI-HEALTHCHECK] ENGINE 1 (Groq) OK ✅"
        : `[SAARTHI-HEALTHCHECK] ENGINE 1 (Groq) FAIL — HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
    } catch (e) {
      console.log("[SAARTHI-HEALTHCHECK] ENGINE 1 (Groq) FAIL — exception: " + (e?.message || e));
    }

    // Engine 2: Gemini
    const g = await tryGemini(testBody, env);
    console.log(g
      ? "[SAARTHI-HEALTHCHECK] ENGINE 2 (Gemini) OK ✅"
      : "[SAARTHI-HEALTHCHECK] ENGINE 2 (Gemini) FAIL — upar tryGemini() ka apna log dekho wajah ke liye");

    // ── DAILY REMINDER PUSH (item #15) — isi cron ke 3 firing-samay (subah/
    // dopahar/shaam) khud reminder-bhejne ka samay bhi hain, isliye alag cron
    // banane ki zaroorat nahi — jab bhi yeh function chale, health-check ke
    // saath reminders bhi chale jaate hain. VAPID_PRIVATE_JWK set na ho toh
    // chup-chaap skip (push abhi setup nahi hua).
    if (!env.PUSH_SUBS || !env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY) {
      console.log("[SAARTHI-PUSH] SKIP — PUSH_SUBS/VAPID env abhi set nahi hai");
      return;
    }
    const hourUTC = new Date().getUTCHours();
    let sent = 0, failed = 0, removed = 0, cursor;
    // Safety cap — free Workers plan ek invocation mein limited subrequests
    // deta hai. Subscriber-count badhne par isse aur "waitUntil"-based batching
    // mein todna hoga (scaling-note, jaisa PDF-size wala).
    const MAX_PER_RUN = 300;
    do {
      // AUDIT FIX (2026-08-01): pehle yahan prefix nahi tha — list() SAARI
      // keys laut deta tha, aur PUSH_SUBS mein "rl:<ip>" rate-limit counters
      // bhi rehte hain (60s TTL). Unki value "2" jaisi hoti hai, jise
      // JSON.parse khushi se maan leta hai (rec = 2), phir
      // sendWebPush(rec.subscription === undefined) andar se fail hota tha
      // aur "failed" count mein jud jaata tha — jhoothe failure numbers aur
      // bekaar subrequests. Ab sirf asli subscriptions.
      const page = await env.PUSH_SUBS.list({ cursor, limit: 100, prefix: "sub:" });
      for (const k of page.keys) {
        if (sent + failed >= MAX_PER_RUN) break;
        const raw = await env.PUSH_SUBS.get(k.name);
        if (!raw) continue;
        let rec;
        try { rec = JSON.parse(raw); } catch { continue; }
        const payload = reminderMessage(hourUTC, rec.lang);
        if (rec.name) payload.body = `${rec.name} ${rec.lang === "en" ? "" : "जी, "}${payload.body}`;
        const result = await sendWebPush(rec.subscription, payload, env);
        if (result.ok) sent++;
        else {
          failed++;
          if (result.expired) { await env.PUSH_SUBS.delete(k.name); removed++; }
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && sent + failed < MAX_PER_RUN);

    console.log(`[SAARTHI-PUSH] reminder round poora — bheje: ${sent}, fail: ${failed}, hataye: ${removed}`);
  },
};
