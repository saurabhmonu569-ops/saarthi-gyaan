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
// Ek batch kitna intezaar karwa sakta hai — poora hisaab rerankAll() me
// likha hai. Chhota mat karo bina naape: 4s beech ke samay (722ms) se
// paanch guna hai, isliye sirf asli atkav par lagta hai.
const RERANK_TIMEOUT_MS = 4000;
// FIX (2026-07-23): gemini-2.0-flash Google ne 1 June 2026 ko HARD SHUTDOWN kar
// diya — is model ko call karne par ab seedha error aata hai. Yeh Engine 2 tha,
// isliye pichle ~7 hafton se yeh chupke se fail ho raha tha aur har baar seedha
// Engine 3 (OpenRouter) par gir raha tha — redundancy 3 se ghatkar 2 reh gayi
// thi. Naya model: gemini-3.5-flash (Google ki official recommended replacement).
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

// Sirf yeh models manegi (koi mehenga model nahi maang sakta)
const ALLOWED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  // 2026-08-13: "llama-3.1-8b-instant" 16 Aug ko band ho raha hai (Groq ka
  // email). Uski jagah unka sujhaya hua "openai/gpt-oss-20b".
  //
  // ⚠️ Purana naam JAAN-BOOJHKAR ABHI RAKHA HAI. Client aur worker alag-alag
  // deploy hote hain (Netlify aur Cloudflare). Agar yahan se purana naam
  // abhi hata dein aur kisi user ke browser me purani client-file cache me
  // padi ho, to uski request "model allowed nahi" hokar chupchaap 70b par
  // chali jaayegi — jo theek hai — par 70b ke band hone wale din wo suraksha
  // -jaal kaam nahi karega. 16 Aug ke baad ye pankti hata dena surakshit hai.
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
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

/**
 * SESSION_SECRET ka HMAC key.
 *
 * SURAKSHA FIX (2026-08-05 audit): pehle dono jagah `env.SESSION_SECRET || ""`
 * likha tha. Agar secret dashboard se galti se hat jaata (ya naya environment
 * bina secret ke deploy hota), toh HMAC KHAALI STRING se banta — jo har kisi
 * ko pata hai. Koi bhi apna token sign karke `emailVerified: true` ke saath
 * ghus sakta tha, aur verify bhi ho jaata. Yeh FAIL-OPEN tha.
 *
 * Ab fail-CLOSED hai: secret na ho toh key banti hi nahi. issue throw karta
 * hai (500 — login banta hi nahi), verify null deta hai (token maanya nahi).
 * Dono soorat mein galat aadmi andar nahi aata.
 */
async function sessionKey(env, usage) {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]
  );
}

/** Apna HMAC-signed session token — Google token expire (~1hr) ho jaane ke
 * baad bhi client 24h tak "verified" reh sakta hai, bina Google ko dobara
 * call kiye. SESSION_SECRET ke bina koi bhi isse forge nahi kar sakta. */
async function issueSessionToken(claims, env) {
  const key = await sessionKey(env, "sign");
  if (!key) throw new Error("SESSION_SECRET set nahi hai (ya 16 akshar se chhota) — session token nahi ban sakta");
  const payload = { ...claims, exp: Date.now() + 24 * 3600_000 };
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

/** Session token verify — HMAC signature check + expiry. Returns claims ya null. */
async function verifySessionToken(token, env) {
  try {
    const [payloadB64, sigB64] = String(token || "").split(".");
    if (!payloadB64 || !sigB64) return null;
    const key = await sessionKey(env, "verify");
    if (!key) return null;   // secret gayab = koi bhi token maanya nahi
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

// ═══════════════════════════════════════════════════════════════════════
// P2 — POORA RETRIEVAL SERVER PAR (2026-08-10)
// ═══════════════════════════════════════════════════════════════════════
//
// KYUN: abhi tak retrieval BROWSER mein chalti thi, isliye har naye
// visitor ko 316 MB utaarna padta tha (books 165 + keyword index 93 +
// vectors 56). Gzip ke baad bhi ~122 MB. Bharat mein mobile par wo aadmi
// rukta hi nahi — yaani 298 sawaalon par naapa hua 80% ka score kisi
// user tak pahunchta hi nahi tha.
//
// Ab wahi kaam yahan hota hai:
//     VECTORIZE  → 57,339 vector, semantic search poore corpus par
//     D1         → ansh ka text + FTS5 keyword index
//     yahan      → dono ko jodo, rerank karo, gate lagao
// Client par download: 316 MB → 0 MB.
//
// ⚠️ YE SAB WAHI SANKHYAYEIN HAIN JO 298 SAWAALON PAR NAAPI GAYI THI —
// MIN_RERANK 0.30, PER_BOOK_CAP 3, KEEP 12, quota 45/20/20. Inhe badalna
// matlab score badalna. P2 sirf ye badalta hai ki kaam KAHAN hota hai,
// KYA hota hai wo nahi. Agar in numbers ko chhedna ho to pehle
// scripts/eval-ask.mjs --300 --full chalao.
const SEARCH_MIN_RERANK   = 0.30;

/**
 * NAAM LIYE GAYE GRANTH KE LIYE ALAG, NEECHA FLOOR (2026-08-10)
 *
 * KYUN: Ramcharitmanas har Ramayan ke sawaal par gate se neeche reh jaata
 * tha, aur jawab Mahabharat ke Ramopakhyana se judta tha. Ek hi sawaal
 * ("भरत जी जब राम को वापस लाने वन गये…") par naapa —
 *     mahabharata (Ramopakhyana) : sabse ooncha 0.9899, 5/12 paas
 *     ramcharitmanas             : sabse ooncha 0.2447, 0/12 paas
 * Dono mein wahi katha hai. Farak DHAANCHE ka hai: Mahabharat mein shlok
 * ke baad lambi lagatar Hindi gadya hai, jabki Ramcharitmanas mein Awadhi
 * chaupai aur Hindi tika chhote-chhote tukdon mein badalte hain, beech
 * mein panne ka shirshak (* अयोध्याकाण्ड * ५५७) aur chhand-sankhya. Ek
 * 1200-akshar ki khidki mein lagatar prasangik gadya kam padti hai.
 *
 * 0.18 KAHAN SE AAYA — control se, andaaze se nahi. Ramcharitmanas par:
 *     "कल मौसम कैसा रहेगा, पेट्रोल का रेट"  → sabse ooncha 0.0000
 *     "बाइबिल में ईसा मसीह ने क्या कहा"     → sabse ooncha 0.0229
 *     asli Ramayan ka sawaal                → 0.2447
 * Beech mein 0.22 ka khaali maidan hai — global gate ke 0.12 se bhi bada.
 * 0.18 usi maidan mein hai: control se 0.157 upar, asli se 0.065 neeche.
 *
 * ⚠️ YE FLOOR SIRF US GRANTH PAR LAGTA HAI JISKA NAAM LIYA GAYA HO.
 * Baaki sab par 0.30 hi rehta hai. Jokhim ka hisaab alag hai: jab user ne
 * khud granth (ya uska paatr) bataya ho, tab uske ansh dena "andaaza"
 * nahi hai. Jhoothi citation ka asli khatra un sawaalon par hai jinka
 * jawab corpus mein hai hi nahi — aur wahan koi granth hinted hota hi
 * nahi, isliye wahan 0.30 poori tarah lagta hai.
 *
 * Ise badalne se pehle naapo: node scripts/13_probe_rerank.mjs
 */
const SEARCH_HINTED_MIN_RERANK = 0.18;
const SEARCH_PER_BOOK_CAP = 3;
const SEARCH_KEEP         = 12;
const SEARCH_QUOTA        = { semantic: 45, keyword: 20, cross: 20 };

/**
 * POOL ME PER-BOOK CAP — AAZMAYA AUR HATAYA (2026-08-13)
 * ======================================================
 * Ye likh kar rakh raha hoon taaki koi (main bhi) ise dobara na aazmaye.
 *
 * SOCH THI: bina naam wale sawaalon me pool par ek granth chha jaata hai —
 *     pool=85 → mahabharata 62 (73%)
 * aur un sawaalon ka best rerank score 0.032 tha, yaani sahi ansh
 * reranker ke saamne aate hi nahi the. To semantic 45→100 kiya aur pool
 * me prati granth 8 ka cap lagaya.
 *
 * TARK YE THA: "aakhri jawab me kisi granth ke zyada se zyada 3 ansh ja
 * sakte hain (SEARCH_PER_BOOK_CAP), isliye pool me 62 rakhna bekaar hai —
 * 59 kabhi istemal ho hi nahi sakte."
 *
 * NAAPA GAYA (1,250 sawaal, poora set) — TEENON ANK GALAT TARAF GAYE:
 *     SAHI    80.0% → 78.9%
 *     ANYA     8.2% →  9.0%
 *     KHAALI  11.8% → 12.2%
 *     Mahabharata      76% → 70%
 *     Shiv Puran Kh.1  74% → 68%
 *     Shiv Puran Kh.2  72% → 66%
 *     Mantra Maha Sagar 46% → 44%   ← jiske liye kiya tha, wahi gira
 *
 * TARK ME CHHED KAHAN THA: cap lagate waqt har granth ke pehle 8 ansh
 * VECTOR KE KRAM se rakhe jaate hain. Par vector ka kram aur reranker ka
 * kram EK NAHI HOTE — jo ansh vector me 30ve number par hai, wo reranker
 * ke liye pehla ho sakta hai. Cap ne aise ansh us ekmatra bharosemand
 * judge tak pahunchne se PEHLE hi phenk diye.
 *
 * Doosri baat (task #21 se judi): rerank ka score BATCH-SAPEKSH hai. Pool
 * badalne se sirf "kachra" nahi hatta — saare score hil jaate hain.
 *
 * SEEKH: pool ko patla karna sudhaar nahi hai. Agar bina naam wale
 * sawaalon ko theek karna hai to ilaaj RERANK ke star par hona chahiye
 * (ya ek alag "har granth ko barabar mauka" wala raasta), pool kaat kar
 * nahi. Byora: eval-perbook-poolcap-FAIL.json
 */
const SEARCH_MAX_RERANK   = 100;

/** ChatView.jsx ka hasSentences() — bilkul wahi regex */
function hasSentences(text) {
  const t = (text || "").trim();
  if (!t) return false;
  return /।|॥|(?:है|हैं|था|थी|थे|हुआ|हुई|होता|होती|करते|करना|चाहिये|चाहिए|गया|गयी|रहता|रहती)(?=[\s।॥,.]|$)/.test(t);
}

/** ChatView.jsx ka looksGarbled() — 32,032 chunks par naapa hua 0.40 */
function looksGarbled(text) {
  const w = String(text || "").match(/[ऀ-ॿ]+/g);
  if (!w || w.length < 12) return false;
  return w.filter(x => x.length <= 2).length / w.length > 0.40;
}

/**
 * Query se FTS5 ka MATCH banao.
 *
 * engine.js ki queryKeywords() jaisa hi: Devanagari 2+ akshar, Latin 3+,
 * stopwords bahar. Har shabd par PREFIX (`भय*`) isliye ki corpus mein
 * shabd jude hue roop mein hain — "भयसे", "भयके", "भयभीत". Bina prefix
 * ke "भय" akela kabhi match nahi karta.
 */
function ftsQuery(q) {
  const STOP = new Set("का के की को कि में से और पर यह जो है ने भी एक था the and for with".split(" "));
  const words = [...String(q || "").toLowerCase().matchAll(/[ऀ-ॿ]{2,}|[a-z]{3,}/g)]
    .map(m => m[0]).filter(w => !STOP.has(w));
  const uniq = [...new Set(words)].slice(0, 12);
  if (!uniq.length) return null;
  // FTS5 mein " aur * khaas hain — shabd ko quote karke * bahar rakho
  return uniq.map(w => `"${w.replace(/"/g, "")}"*`).join(" OR ");
}

/** 20-20 ke parallel batch — semanticSearch.js ke rerankPassages jaisa */
async function rerankAll(env, query, texts) {
  const batches = [];
  for (let i = 0; i < texts.length; i += RERANK_MAX_CONTEXTS) {
    batches.push({ at: i, t: texts.slice(i, i + RERANK_MAX_CONTEXTS) });
  }
  const res = await Promise.all(batches.map(async ({ at, t }) => {
    try {
      // ── EK ATKA BATCH POORE SAWAAL KO ATKA DETA HAI ──────────────────
      //
      // NAAPA GAYA (30 sawaal, 2026-08-10):
      //     rerank ka beech ka samay  :   722ms
      //     rerank ka 90% par         : 7,954ms
      // Yaani rerank aam taur par TEZ hai — kabhi-kabhi hi atakta hai.
      //
      // Par yahan 5 batch ek saath jaate hain aur Promise.all SABSE DHEEME
      // ka intezaar karta hai. Agar ek batch bhi atka, poora sawaal atka.
      // Paanch me se kisi ek ke atakne ki sambhavna akele ek se kai guna
      // zyada hai — isiliye kul samay ka 90% (10.4s) rerank ke 8s se bharta
      // hai, jabki uska apna beech ka samay sirf 0.7s hai.
      //
      // ILAAJ: har batch ko 4 second do. Us se zyada lage to us batch ko
      // chhod do — uske ansh ka score 0 rahega aur wo gate par gir jaayenge.
      // Yaani thodi si khoj kho sakti hai, par 8 second ka intezaar bach
      // jaata hai. 4s isliye ki beech ka samay 722ms hai — 4s us se paanch
      // guna hai, yaani sirf asli atkav par hi lagega, aam mamle par nahi.
      //
      // Ye "fail-soft" wahi soch hai jo neeche catch me pehle se hai: kam
      // jawab theek hai, ruka hua user nahi.
      const out = await Promise.race([
        env.AI.run(RERANK_MODEL, {
          query,
          contexts: t.map(x => ({ text: String(x).slice(0, RERANK_MAX_CHARS) })),
          top_k: t.length,
        }),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error(`batch @${at} 4s me jawab nahi diya`)), RERANK_TIMEOUT_MS)),
      ]);
      const list = out?.response || out?.result?.response || (Array.isArray(out) ? out : null);
      if (!Array.isArray(list)) return { at, s: null };
      const s = new Array(t.length).fill(0);
      for (const it of list) {
        const i = it?.id ?? it?.index, v = it?.score ?? it?.relevance_score;
        if (Number.isInteger(i) && i >= 0 && i < s.length && typeof v === "number") s[i] = v;
      }
      return { at, s };
    } catch (e) {
      console.log("[SAARTHI-SEARCH] rerank batch fail @" + at + " — " + (e?.message || e));
      return { at, s: null };
    }
  }));
  const out = new Array(texts.length).fill(0);
  let chhoote = 0;
  for (const { at, s } of res) {
    if (s) { for (let j = 0; j < s.length; j++) out[at + j] = s[j]; }
    else chhoote++;
  }
  // Kitne batch chhoot gaye — ye chup-chaap nahi hona chahiye. Agar ye
  // number baar-baar 0 se zyada aaye, to seema (4s) bahut sakht hai ya
  // Workers AI sach me dheema pad raha hai.
  if (chhoote) console.log(`[SAARTHI-SEARCH] ${chhoote}/${batches.length} rerank batch chhoot gaye (timeout ya fail)`);
  out._chhoote = chhoote;
  return out;
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
    // ── /search — POORA RETRIEVAL (P2, 2026-08-10) ────────────────────
    //
    // Client bhejta hai:
    //   findQ      — dhoondhne ki query (translit + granth-paryay lagi hui)
    //   rerankQ    — aankne ki query (meta-dhaancha hataya hua)
    //   hintedBook — agar user ne granth ka naam liya ho
    //
    // Client YE SAB PEHLE HI kar chuka hota hai kyunki wo sirf code hai,
    // data 0 MB — translit, paryay, aur daayre-se-bahar wali jaanch. Yahan
    // sirf wo kaam hai jiske liye 316 MB data chahiye tha.
    //
    // Lautata hai: 12 tak ansh, har ek ke saath `grounded` — yaani kya ye
    // citation ka aadhaar ban sakta hai. `grounded: false` waale AI ko
    // sandarbh ki tarah jaate hain par unka naam kabhi cite nahi hota.
    if (request.method === "POST" && url.pathname === "/search") {
      if (!env.AI)         return jsonResponse({ error: { message: "AI binding not configured" } }, 500, origin);
      if (!env.VECTORIZE)  return jsonResponse({ error: { message: "VECTORIZE binding not configured" } }, 500, origin);
      if (!env.DB)         return jsonResponse({ error: { message: "D1 (DB) binding not configured" } }, 500, origin);

      let b;
      try { b = JSON.parse(await request.text()); } catch { return jsonResponse({ error: { message: "Bad JSON" } }, 400, origin); }

      const findQ   = typeof b?.findQ   === "string" ? b.findQ.trim().slice(0, EMBED_MAX_CHARS)   : "";
      const rerankQ = typeof b?.rerankQ === "string" ? b.rerankQ.trim().slice(0, EMBED_MAX_CHARS) : findQ;
      const hinted  = typeof b?.hintedBook === "string" ? b.hintedBook.slice(0, 64) : null;
      if (!findQ) return jsonResponse({ error: { message: "findQ required" } }, 400, origin);

      const t0 = Date.now();
      // KADAM-DAR-KADAM SAMAY (2026-08-10)
      // Naapa gaya: 100 sawaalon par beech ka samay 2,720ms par 90% par
      // 8,787ms aur sabse dheema 15,777ms. Yaani das me se ek user 8 second
      // se zyada rukta hai — us par log app chhod dete hain.
      // Par ab tak sirf KUL samay pata tha. Kis kadam me ja raha hai, ye
      // jaane bina koi bhi sudhaar tukka hai. Ye ginti wahi batati hai.
      const T = {}; let tk = Date.now();
      const lap = k => { T[k] = Date.now() - tk; tk = Date.now(); };
      try {
        // ── 1. SEMANTIC — Vectorize, poore corpus par ─────────────────
        const emb = await env.AI.run(EMBED_MODEL, { text: [findQ], truncate_inputs: true });
        lap("embed");
        const vec = (emb?.data || emb?.result?.data)?.[0];
        if (!vec) throw new Error("embed failed");

        // returnMetadata NAHI maangte — aur ye jaan-boojhkar hai.
        //
        // Pehle `returnMetadata: "indexed"` tha, aur uska nateeja diagnostic
        // mein saaf dikha: poolByBook mein `"": 45` — yaani Vectorize se
        // aaye SAARE 45 ansh ka `book` khaali tha. Vectorize `"indexed"`
        // par sirf wo metadata lautata hai jiska alag metadata-index banaya
        // gaya ho (wrangler vectorize create-metadata-index) — humne banaya
        // hi nahi tha.
        //
        // Par ise theek karne ki zaroorat hi nahi: `book` hamein D1 se
        // waise bhi milta hai (neeche kadam 5), aur wahi asli source hai.
        // Vectorize se sirf ID chahiye. Isse payload bhi halka rehta hai.
        const vq = await env.VECTORIZE.query(vec, { topK: SEARCH_QUOTA.semantic });
        lap("vectorize");
        const byId = new Map();
        for (const m of (vq?.matches || [])) {
          byId.set(m.id, { id: m.id, book: "", src: "semantic", score: m.score });
        }

        // ── 2 + 3. KEYWORD aur CROSS-BOOK — ek hi D1 query se ─────────
        // Ek hi FTS query se 250 ansh uthate hain, phir JS mein baant
        // dete hain: pehle 20 seedhe (keyword), aur alag-alag kitaabon
        // se 3-3 karke 20 aur (cross-book). Do alag SQL se ye tez hai,
        // aur nateeja wahi — cross-book ka poora maqsad yehi hai ki har
        // granth ko mauka mile.
        const match = ftsQuery(findQ);
        if (match) {
          const { results } = await env.DB.prepare(
            `SELECT c.id, c.book FROM chunks_fts f
             JOIN chunks c ON c.rowid = f.rowid
             WHERE chunks_fts MATCH ?1 ORDER BY rank LIMIT 250`
          ).bind(match).all();
          lap("fts");

          let kw = 0;
          for (const r of (results || [])) {
            if (kw >= SEARCH_QUOTA.keyword) break;
            if (!byId.has(r.id)) { byId.set(r.id, { id: r.id, book: r.book, src: "keyword" }); kw++; }
          }
          const perBook = new Map(); let cb = 0;
          for (const r of (results || [])) {
            if (cb >= SEARCH_QUOTA.cross) break;
            const n = perBook.get(r.book) || 0;
            if (n >= 3 || byId.has(r.id)) continue;
            perBook.set(r.book, n + 1);
            byId.set(r.id, { id: r.id, book: r.book, src: "cross" }); cb++;
          }
        }

        // ── 4. HINTED BOOK — user ne granth ka naam liya to uska ansh pakka
        //
        // ⚠️ BUG (2026-08-10, user ne pakda — DO sawaal ise saabit karte hain):
        // "Gita me Daivi Sampat aur Asuri Sampat ka practical difference kya
        // hai?" ka jawab SIRF Ramcharitmanas (p.26, p.27) se aaya, jabki
        // bhagavad_gita_shankar mein दैवी 9 aur आसुरी 10 ansh mein hai — aur
        // Gita ka 16va adhyaya hi "दैवासुरसम्पद्विभागयोग" hai.
        //
        // Jad: yahan pehle likha tha
        //     SELECT id, book FROM chunks WHERE book = ?1 LIMIT 6
        // Bina ORDER BY, bina search. SQLite `LIMIT 6` ka matlab hai
        // "pehle 6 rows" — yaani kitaab ke SHURU ke 6 ansh: mukhprishth,
        // prakashak ka pata, vishay-suchi. Un par reranker ka score
        // lagbhag 0 aata hai, wo gate par mar jaate hain, aur natija
        // wahi hota hai jaise hinted-book path chala hi na ho.
        //
        // Purana client-side code ye galti nahi karta tha — wo
        // `hybridSearch(findQ, null, { book: hintedBook }, 6)` chalata tha,
        // yaani us kitaab ke ANDAR dhoondhta tha. P2 mein wo baat likhte
        // waqt chhoot gayi. Ab wahi kaam FTS se, kitaab ki seema mein.
        // `have < 3` waali shart HATA di: is jagah semantic ansh ka book
        // khaali hota hai (upar dekhein), isliye ginti kabhi bharosemand
        // thi hi nahi. Ek chhoti FTS query rozana chalane ki keemat kuch
        // bhi nahi, aur badle mein guarantee milti hai.
        // LIMIT 8 → 30 (2026-08-10, naap ke baad badla)
        //
        // 8 par naapa gaya: "भरत जी जब राम को वापस लाने वन गये…" par
        // ramcharitmanas ke 41 ansh pool mein aaye aur EK BHI 0.18 paar
        // nahi kar paya. Par alag se naapne par (13_probe_rerank.mjs) usi
        // granth ka p.508 — "भरतजीने जब शृङ्गवेरपुरको देखा…" — 0.2447
        // deta hai. Yaani sahi ansh maujood hai, score bhi theek deta hai,
        // par un 41 mein tha hi nahi.
        //
        // Wajah: 2,070 ansh mein se sirf 8 uthana bahut chhota jaal hai,
        // aur bm25 un ansho ko upar rakhta hai jinme sawaal ke shabd
        // ZYADA BAAR aayein — zaroori nahi ki jo sach me jawab dete hon.
        // 30 par bhi ye ek hi D1 query hai; badle mein reranker ko asli
        // ummeedwaar milte hain, aur wahi ekmatra bharosemand judge hai.
        const hintedIds = [];
        if (hinted && match) {
          const { results } = await env.DB.prepare(
            `SELECT c.id, c.book FROM chunks_fts f
             JOIN chunks c ON c.rowid = f.rowid
             WHERE chunks_fts MATCH ?1 AND c.book = ?2
             ORDER BY rank LIMIT 30`
          ).bind(match, hinted).all();
          for (const r of (results || [])) {
            if (!byId.has(r.id)) byId.set(r.id, { id: r.id, book: r.book, src: "hinted" });
            hintedIds.push(r.id);
          }
        }

        // ⚠️ NAAM LIYE GAYE GRANTH KE ANSH SABSE PEHLE.
        // `cand` 100 par kata jaata hai (SEARCH_MAX_RERANK). byId ka kram
        // insertion ka kram hai, aur hinted sabse AAKHIR mein jude the —
        // yaani pool bhara hone par theek wahi ansh kat jaate jinke liye
        // ye poora raasta banaya gaya tha. Ab wo sabse aage rehte hain.
        const hintedSet = new Set(hintedIds);
        const cand = [
          ...[...byId.values()].filter(c => hintedSet.has(c.id)),
          ...[...byId.values()].filter(c => !hintedSet.has(c.id)),
        ].slice(0, SEARCH_MAX_RERANK);
        if (!cand.length) return jsonResponse({ chunks: [], stats: { pool: 0, ms: Date.now() - t0 } }, 200, origin);

        // ── 5. TEXT laao — D1 se, ek hi query mein ────────────────────
        // rowid bhi le rahe hain — padosi ansh usi se milte hain (neeche 6.5)
        const ph = cand.map((_, i) => `?${i + 1}`).join(",");
        const { results: texts } = await env.DB.prepare(
          `SELECT rowid AS rid, id, book, page, text FROM chunks WHERE id IN (${ph})`
        ).bind(...cand.map(c => c.id)).all();
        lap("d1-text");
        const textById = new Map((texts || []).map(r => [r.id, r]));

        const withText = cand
          .map(c => ({ ...c, ...(textById.get(c.id) || {}) }))
          .filter(c => (c.text || "").trim());
        if (!withText.length) return jsonResponse({ chunks: [], stats: { pool: cand.length, ms: Date.now() - t0 } }, 200, origin);

        // ── 6. RERANK — asli sawaal par, paryay ke bina ───────────────
        const scores = await rerankAll(env, rerankQ, withText.map(c => c.text));
        lap("rerank");
        const scored = withText.map((c, i) => ({ ...c, rerank: scores[i] }));
        const usable = scored.filter(c => hasSentences(c.text) && !looksGarbled(c.text));
        const best   = usable.length ? Math.max(...usable.map(c => c.rerank)) : 0;

        // ── 7. GATE + per-book cap + KEEP ─────────────────────────────
        //
        // ⚠️ NAAM LIYE GAYE GRANTH KO PEHLA HAQ (2026-08-10, user ne pakda)
        //
        // ASLI GHATNA: "Gita me Daivi Sampat aur Asuri Sampat ka practical
        // difference kya hai?" par naapa gaya —
        //     agni_purana p.520          rerank 0.9313  ← sabse upar
        //     bhagavad_gita_shankar p.391 rerank 0.7646  ← ASLI JAWAB
        //
        // Agni Purana ka wo panna धन-विभाजन ka hai — pita ki सम्पत्ति ka
        // batwara, uttaradhikar ke niyam. Sawaal se koi lena-dena nahi.
        // Par usme "सम्पत्ति" aur "विभाग" shabd bhare pade hain, aur
        // sawaal mein bhi "सम्पत्ति" hai. Cross-encoder shabd milata hai,
        // niyat nahi — isliye wo 0.93 de baithta hai.
        //
        // Aisa hamesha hota rahega. Koi threshold ise nahi rok sakta,
        // kyunki 0.93 asli lagta hai. Par jab user ne KHUD granth ka naam
        // le liya ho, tab hamein andaaza lagane ki zaroorat hi nahi —
        // usne bata diya hai ki kahan se jawab chahiye.
        //
        // Purana client-side code yahi karta tha:
        //     if (hintedBook) { const ab = a.chunk.book === hintedBook …
        //                       if (ab !== bb) return ab ? -1 : 1; }
        // P2 mein likhte waqt ye chhoot gaya tha. Ab wapas.
        //
        // Gate abhi bhi lagta hai — hinted granth ka kachra ansh bhi 0.30
        // se neeche ho to bahar hi jaata hai. Ye "zabardasti cite karo"
        // nahi hai; ye sirf KRAM hai un ansho ka jo pehle hi paas ho chuke.
        // Floor: naam liye gaye granth ke liye 0.18, baaki sabke liye 0.30
        // (upar SEARCH_HINTED_MIN_RERANK ki poori tippani dekhein)
        const floorFor = c =>
          (hinted && c.book === hinted) ? SEARCH_HINTED_MIN_RERANK : SEARCH_MIN_RERANK;

        // ── NAAM LIYA HUA GRANTH: SCORE SE MAT POOCHHO ──────────────────
        //
        // ⚠️ YE AAJ KA SABSE ZAROORI BADLAV HAI. Iske pehle maine do baar
        // sirf THRESHOLD ghumaya (0.30, phir hinted ke liye 0.18) — aur
        // dono baar wahi galti dobara hui. Console ne teesri baar likha:
        //
        //     user ne granth kaha: ekadashi_mahatmya — pool mein 32, gate paar 0
        //
        // User ne Ekadashi ka vrat poochha. Hamare paas "Ekadashi Mahatmya"
        // naam ki POORI KITAB hai. Uske 32 ansh pool mein aaye. Ek bhi
        // 0.18 paar nahi kar paya. Jawab Garuda Puran se juda.
        // Yahi Ramcharitmanas ke saath hua (41 mein se 0), yahi Gita ke
        // saath (0.1885 — floor se sirf 0.0085 upar, ittefaq se bacha).
        //
        // JAD: threshold ka kaam hai "jab kuch prasangik NA MILE tab chup
        // raho". Par jab user ne KHUD granth ka naam le liya ho aur us
        // granth ke ansh saamne pade hon, tab "kuch mila ya nahi" ka
        // sawaal hi nahi banta — user ne bata diya hai ki kahan dekhna hai.
        // Aise mein uske granth ko chhod kar doosri kitab cite karna
        // ULTA hai. Koi bhi number is baat ko theek nahi kar sakta.
        //
        // AB: naam liye gaye granth ke SABSE ACHHE 2 ansh hamesha jaate
        // hain — score kuch bhi ho. Baaki sab par 0.30 waisa hi lagta hai.
        //
        // KYUN 2, aur kyun ye surakshit hai:
        //   • 2 hi — taaki wo granth poora jawab na bhar de; baaki jagah
        //     un ansho ki rehti hai jinhone sach mein gate paar kiya.
        //   • hasSentences/looksGarbled ab bhi lagte hain (`usable`), yaani
        //     table, suchi aur OCR-kachra phir bhi bahar hi rehta hai.
        //   • JHOOTHI CITATION ka khatra nahi badhta: 38 control sawaalon
        //     mein se EK par bhi koi granth hinted nahi hota (wo "kal ka
        //     mausam", "petrol ka rate", "Bible" jaise hain). Hint tabhi
        //     lagta hai jab user granth ya uske paatr ka naam le — aur tab
        //     us granth ko dikhana jhooth nahi, wahi to maanga gaya tha.
        //
        // Ise badalne se pehle: node scripts/14_eval_search.mjs --set control
        // Dekhna sirf ek cheez — JHOOTHI CITATION 0 rahi ya nahi.
        const HINTED_PAKKA = 2;
        const hintedBest = hinted
          ? usable.filter(c => c.book === hinted)
              .sort((a, b) => b.rerank - a.rerank)
              .slice(0, HINTED_PAKKA)
          : [];
        const pakkaIds = new Set(hintedBest.map(c => c.id));

        const passed = usable
          .filter(c => pakkaIds.has(c.id) || c.rerank >= floorFor(c))
          .sort((a, b) => {
            if (hinted) {
              const ab = a.book === hinted, bb = b.book === hinted;
              if (ab !== bb) return ab ? -1 : 1;
            }
            return b.rerank - a.rerank;
          });
        const perBook = new Map(); const kept = [];
        for (const r of passed) {
          const n = perBook.get(r.book) || 0;
          if (n >= SEARCH_PER_BOOK_CAP) continue;
          perBook.set(r.book, n + 1);
          kept.push(r);
          if (kept.length >= SEARCH_KEEP) break;
        }

        // ── 7.5 PADOSI ANSH — chunk ki seema par kata jawab (2026-08-10)
        //
        // Ye ChatView.jsx ka wahi ilaaj hai, ab server par. ASLI GHATNA:
        // "सूर्य के 12 नमस्कार" par nitya_karm_pooja p.125 mila jisme sirf
        // bhoomika thi — 12 naam AGLE ansh mein the. Model ne yaad se bhar
        // diya aur 12 mein se 5 naam GALAT nikle.
        //
        // DONO taraf dekhte hain, sirf agla nahi: "कृत्तिका नक्षत्र" wale
        // case mein jawab PICHLE ansh mein tha, kyunki OCR ne uske shirshak
        // "कृत्तिका" ko "Gitar" padh liya tha — wo ansh search ko dikhta hi
        // nahi. Padosi OCR ki galti ka sasta ilaaj bhi hai.
        //
        // KYUN rowid: 12_load_d1.mjs ne kitaabein sorted kram mein, aur har
        // kitaab ke chunks unke apne array-kram mein daale the. Isliye ek hi
        // book ke andar rowid ka kram = padhne ka kram — bilkul wahi jo
        // engine.js ke getBookChunks() ka array-index tha. (Naapa gaya:
        // 57,339 mein se sirf Mahabharata ke 533 page ulte hain, aur wo
        // 6 volumes ke page-number restart hain, kram nahi.)
        //
        // Padosi ko bhi grounded maante hain: wo usi ansh ka agla/pichla
        // hissa hai jise reranker ne pass kiya, aur uski kitaab pehle se
        // cite ho rahi hai.
        let out = kept;
        try {
          const want = [];               // [rowid, book] jo chahiye
          const have = new Set(kept.map(c => c.id));
          for (let i = 0; i < Math.min(3, kept.length); i++) {
            const r = kept[i];
            if (!r.rid) continue;
            want.push([r.rid - 1, r.book, r.rid], [r.rid + 1, r.book, r.rid]);
          }
          if (want.length) {
            const p2 = want.map((_, i) => `?${i + 1}`).join(",");
            const { results: nb } = await env.DB.prepare(
              `SELECT rowid AS rid, id, book, page, text FROM chunks WHERE rowid IN (${p2})`
            ).bind(...want.map(w => w[0])).all();
            const nbById = new Map((nb || []).map(r => [r.rid, r]));
            const merged = [];
            for (let i = 0; i < kept.length; i++) {
              const r = kept[i];
              // Apna DARJA saath le kar chalo, array-index nahi.
              // BUG (isi din pakda): neeche text kaatne ka faisla array ke
              // index par tha — `i < 3 ? 800 : 300`. Par padosi beech mein
              // ghus jaate hain, toh kept[1] array mein index 3 par pahunch
              // sakta hai aur 800 ki jagah 300 par kat jaata. Yaani jis
              // ansh ko reranker ne DOOSRA sabse achha kaha, uska aadha
              // text model tak pahunchta hi nahi.
              merged.push({ ...r, rank: i });
              const pair = want.filter(w => w[2] === r.rid);
              for (const [rid, book] of pair) {
                const n = nbById.get(rid);
                // ALAG KITAAB KA PADOSI NAHI — kitaab ki seema par rowid+1
                // agli kitaab ka pehla ansh hota hai, jiska is sawaal se
                // koi lena-dena nahi. Ye check hi use rokta hai.
                if (!n || n.book !== book) continue;
                if (have.has(n.id) || String(n.text || "").trim().length <= 40) continue;
                have.add(n.id);
                merged.push({ ...n, rerank: r.rerank, src: "neighbour", rank: i });
              }
            }
            out = merged;
          }
        } catch (e) {
          console.log("[SAARTHI-SEARCH] padosi skip — " + (e?.message || e));
        }

        return jsonResponse({
          chunks: out.slice(0, SEARCH_KEEP + 6).map((c, i) => ({
            id: c.id, book: c.book, page: c.page ?? null,
            // NAAPA HUA (2026-08-04): padosi ko 300 par kaatna use bekaar
            // kar deta hai — nitya_karm_pooja p.126 mein "मित्राय" 383ve aur
            // "भास्कराय" 624ve akshar par hai. Padosi maujood hi isliye hai
            // ki kata hua hissa poora ho, isliye use hamesha poora slice.
            //
            // `rank` (asli darja) istemal hota hai, `i` (array-index) nahi —
            // upar wala comment dekhein.
            text: String(c.text).slice(0, ((c.rank ?? i) < 3 || c.src === "neighbour") ? 800 : 300),
            rerank: c.rerank,
            grounded: true,   // gate paar kar chuke hain (padosi bhi — upar dekhein)
            src: c.src || "",
          })),
          stats: {
            pool: cand.length, passed: passed.length, kept: kept.length,
            padosi: out.length - kept.length,
            best: Number(best.toFixed(4)), ms: Date.now() - t0,
            // POOL KA HISAAB — bina iske hum andhere mein hain.
            //
            // Aaj do sawaal galat granth se juda jawab de rahe the aur hum
            // sirf ANDAAZA laga sakte the ki wajah kya hai: sahi ansh pool
            // mein aaya hi nahi, ya aaya par reranker ne gira diya? Ye do
            // bilkul alag bimariyan hain aur inka ilaaj bhi alag hai.
            //
            // Aur ek khaas wajah: Mahabharata akela poore corpus ka 45%
            // hai (25,856 / 57,339 ansh). Wo har sawaal ke pool mein bhar
            // sakta hai. Ye ginti batayegi ki aisa ho raha hai ya nahi.
            // `withText` se ginte hain, `cand` se NAHI — cand mein semantic
            // ansh ka book khaali hota hai (Vectorize sirf ID deta hai),
            // aur usi wajah se pehli baar ye ginti `"": 45` dikha rahi thi.
            // Asli book D1 ke join ke baad milti hai.
            poolByBook: Object.fromEntries(
              Object.entries(withText.reduce((a, c) => (a[c.book] = (a[c.book] || 0) + 1, a), {}))
                .sort((a, b) => b[1] - a[1]).slice(0, 8)
            ),
            hinted: hinted || null,
            hintedInPool: hinted ? withText.filter(c => c.book === hinted).length : null,
            hintedPassed: hinted ? passed.filter(c => c.book === hinted).length : null,
            // kitne ansh SIRF 'naam liya hua granth' ke naate aaye (score se nahi)
            hintedPakka: pakkaIds.size || 0,
            // kadam-dar-kadam samay — sabse bada kaun, ye saaf dikhta hai
            t: T,
            // kitne rerank batch chhoot gaye (timeout) — 0 hona chahiye
            skipped: scores._chhoote || 0,
          },
        }, 200, origin);
      } catch (e) {
        console.log("[SAARTHI-SEARCH] FAIL — " + (e?.message || e));
        return jsonResponse({ error: { message: "search failed" } }, 502, origin);
      }
    }

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
