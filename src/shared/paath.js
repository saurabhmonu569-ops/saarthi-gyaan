/**
 * SAARTHI — PAATH KE SHUDDH NIYAM (client + worker, EK hi jagah)
 * =====================================================================
 * 2026-08-18.  Yahan sirf SHUDDH function hain — koi network, koi env,
 * koi React, koi Cloudflare. Isliye inhe seedhe test kiya ja sakta hai.
 *
 * KYUN YE FILE BANI — DO WAJAH, DONO NAAPI HUI
 * ---------------------------------------------
 *
 * 1. EK HI NIYAM DO JAGAH LIKHA THA.
 *    `hasSentences` aur `looksGarbled` ChatView.jsx AUR cloudflare-worker.js
 *    dono me haath se rakhe the — bilkul ek jaisa regex, do file me.
 *    Wo jaal is project me pehle bhi toot chuka hai: 10 Agast ko client ka
 *    gate 0.30 maang raha tha aur server 0.18 de raha tha, aur AADHAAR
 *    POORA GAAYAB ho gaya (ChatView.jsx:480 par poori kahani).
 *    Aaj wo dono milte hain — par sirf isliye ki kisi ne abhi tak ek ko
 *    nahi badla.
 *
 * 2. 82% CODE BINA TEST HAI, AUR HAR BUG WAHIN MILA.
 *    18 Agast ke audit me naapa: 11,221 me se 2,412 line hi test wali
 *    files me hain. Worker akela 1,871 line ka hai aur usme us din CHAAR
 *    bug mile — uske ek bhi function ka test nahi tha.
 *    Us din maine `tokenAndaza`/`tokenBudgetMeKaato` ko worker ke SOURCE
 *    SE `eval` karke jaancha, kyunki unhe import karne ka koi raasta hi
 *    nahi tha. Wo jaanch commit me bachi bhi nahi.
 *
 * ⚠️ IS FILE ME KUCH BHI JODNE SE PEHLE: wo cheez SHUDDH honi chahiye —
 *    ek hi input par hamesha ek hi output, aur koi bahar ka sahara nahi.
 *    Warna ye file bhi wahi ban jaayegi jisse bachne ke liye banai gayi.
 */

// ─────────────────────────────────────────────────────────────────────
// PAATH KI GUNVATTA — kaun sa ansh CITATION ka aadhaar ban sakta hai
// ─────────────────────────────────────────────────────────────────────

/**
 * Kya is paath me poore vaakya hain?
 *
 * Suchi, table, vishay-suchi aur mukhprishth me poore vaakya nahi hote.
 * Wo AI ko sandarbh ki tarah ja sakte hain, par unke naam par citation
 * lagana jhooth hai.
 *
 * ⚠️ Ye chunk PHENKTA NAHI — sirf citation ka haq chheenta hai.
 */
export function hasSentences(text) {
  const t = (text || "").trim();
  if (!t) return false;
  return /।|॥|(?:है|हैं|था|थी|थे|हुआ|हुई|होता|होती|करते|करना|चाहिये|चाहिए|गया|गयी|रहता|रहती)(?=[\s।॥,.]|$)/.test(t);
}

/**
 * OCR-kachra pehchaan (2026-08-05 audit).
 *
 * KYUN ZAROORI: hasSentences() akela kaafi nahi hai. Bigda hua OCR bhi "॥"
 * aur "है" ugal deta hai, isliye wo gate paar kar jaata hai.
 * valmiki_ramayana (1927 sanskaran, kharab scan) ka asli text aisa nikla —
 *   "द | चस्ति निधाधत ॥ ३२ जी थी कहने लगे कि, से शुक्त दन बड़ी कणा धर ल्क तै"
 * — aur ye "grounded" bankar model ko jaa raha tha, yaani app apne hi
 * kachre ko Valmiki Ramayana ke naam se quote kar sakti thi.
 *
 * KAISE: bigde OCR me shabd TOOT jaate hain — "रामायण" → "रा मा यण".
 * Isliye 1-2 akshar wale Devanagari token ka anupaat naapo.
 *
 * NAAPA GAYA (poora corpus, 32,032 chunks, per-book):
 *     madhya — 23 saaf kitaabein : 0.20 – 0.33
 *     madhya — valmiki_ramayana  : 0.50
 *   threshold 0.40 par:
 *     valmiki ke      97.8% chunks pakde gaye
 *     baaki 23 ke sirf 3.7% (jhootha alarm)
 *   0.45/0.50 par jhootha alarm to girta hai, par valmiki ka 16%/50% bach
 *   nikalta hai — isliye 0.40.
 */
export const MAX_FRAGMENT_RATIO = 0.40;
export function looksGarbled(text) {
  const words = String(text || "").match(/[ऀ-ॿ]+/g);
  // 12 se kam token par anupaat shor hai — chhote saaf ansh ko sazaa na mile
  if (!words || words.length < 12) return false;
  return words.filter(w => w.length <= 2).length / words.length > MAX_FRAGMENT_RATIO;
}

// ─────────────────────────────────────────────────────────────────────
// TOKEN KA HISAAB — Devanagari ke bhaar ke saath
// ─────────────────────────────────────────────────────────────────────

/**
 * ⚠️ DEVANAGARI KA BHAAR 2 HAI, 1 NAHI — 18 Agast 2026 ko naap kar badla.
 *
 * Pehli koshish me 1 rakha tha ("ek akshar = ek token"). Us hisaab se
 * request budget me aa jaani chahiye thi — par Groq ne PHIR BHI 413 diya.
 * Yaani asli tokenizer Devanagari par ~2 token prati akshar kharch karta
 * hai (matra aur halant apne alag token bante hain).
 *
 * Isi ek baat se us din DO alag dikhne wali kharabiyan aayi thi:
 *     413        — input taraf (request budget se badi)
 *     MAX_TOKENS — output taraf (jawab beech vaakya me kata)
 */
export const DEV_BHAAR = 2;

/** Mota-mota token andaza — Devanagari mehnga, Latin sasta. */
export function tokenAndaza(s) {
  const t = String(s || "");
  const dev = (t.match(/[ऀ-ॿ]/g) || []).length;
  return Math.ceil(dev * DEV_BHAAR + (t.length - dev) / 3.5);
}

/**
 * Groq ka asli TPM 8,000 hai. 6,000 par kaam karte hain — 25% bachav,
 * kyunki upar wala token-andaza mota hai aur galti mehngi (413 = user ko
 * "dhyan-magn"). Ise badhane se pehle asli 413 ki ginti dekhni hogi.
 */
export const GROQ_TPM_SURAKSHIT = 6_000;
export const MAX_TOKENS_CAP     = 1600;

/**
 * ⚠️ YE ANK ALAG-ALAG MAT LIKHNA — GHATA KAR NIKALO.
 * Pehli koshish me TOKEN_BUDGET (5,500) aur GROQ_TPM_SURAKSHIT (6,000)
 * alag-alag likh diye the. 5,500 + 1,600 = 7,100, jo 6,000 ki apni hi
 * seema paar kar raha tha. Do ank jo ek doosre par nirbhar hain, unhe
 * haath se do jagah likhna hi galti ki jad hai.
 */
export const TOKEN_BUDGET = GROQ_TPM_SURAKSHIT - MAX_TOKENS_CAP;   // = 4,400

/**
 * Messages ko budget me laao — SYSTEM ko haath NAHI lagate.
 *
 * Kram jaan-boojhkar ye hai:
 *   1. system rehta hai (usme saare niyam hain — gadhne ke khilaf pehre
 *      bhi. Use kaatna jawab ko galat bana dega, chhota nahi.)
 *   2. purana itihaas pehle jaata hai (sabse kam kaam ka)
 *   3. aakhir me aaj ka sawaal+ansh kaata jaata hai, aur wo bhi ANT se —
 *      shuru ke ansh sabse achhe rerank wale hote hain.
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {(s:string)=>void} [log] — chetavni kahan likhein (worker me console.log)
 */
export function tokenBudgetMeKaato(messages, log) {
  const sys   = messages.filter(m => m.role === "system");
  const baaki = messages.filter(m => m.role !== "system");
  const sysT  = sys.reduce((n, m) => n + tokenAndaza(m.content), 0);
  let bacha   = TOKEN_BUDGET - sysT;

  if (bacha <= 0) return [...sys, ...baaki.slice(-1)];   // asambhav, par surakshit

  // peeche se aage — naya pehle
  const rakhe = [];
  for (let i = baaki.length - 1; i >= 0; i--) {
    const m = baaki[i];
    const t = tokenAndaza(m.content);
    if (t <= bacha) { rakhe.unshift(m); bacha -= t; continue; }
    // Sabse naya sandesh (aaj ka sawaal + ansh) — ise chhodna nahi,
    // kaat kar rakhna hai. Baaki purane sandesh poore gira dete hain.
    if (rakhe.length === 0) {
      // ⚠️ Yahan bhi DEV_BHAAR laga — warna hisaab ulta ho jaata hai.
      // Pehle yahan "1 akshar = 1 token" maan kar kaata tha jabki
      // tokenAndaza() 2 gin raha tha. Nateeja: kaat-chhaant apni hi seema
      // 4,400 ki jagah 5,598 par chhod deti thi — yaani jo pehra seema me
      // laane ke liye tha, wo khud seema paar kar raha tha.
      const s = String(m.content);
      const dev = (s.match(/[ऀ-ॿ]/g) || []).length;
      const aksharPerToken = (dev / Math.max(s.length, 1)) > 0.4 ? (1 / DEV_BHAAR) : 3.5;
      const kitne = Math.max(400, Math.floor(bacha * aksharPerToken));
      rakhe.unshift({ ...m, content: s.slice(0, kitne) });
      log?.(`[SAARTHI] token-budget: sandesh ${tokenAndaza(s)} se ~${bacha} token par kaata`);
    }
    break;
  }
  if (rakhe.length !== baaki.length) {
    log?.(`[SAARTHI] token-budget: ${baaki.length} me se ${rakhe.length} sandesh bheje (budget ${TOKEN_BUDGET})`);
  }
  return [...sys, ...rakhe];
}

// ─────────────────────────────────────────────────────────────────────
// KEYWORD KHOJ
// ─────────────────────────────────────────────────────────────────────

/**
 * Query se FTS5 ka MATCH banao.
 *
 * engine.js ki queryKeywords() jaisa hi: Devanagari 2+ akshar, Latin 3+,
 * stopwords bahar. Har shabd par PREFIX (`भय*`) isliye ki corpus me
 * shabd jude hue roop me hain — "भयसे", "भयके", "भयभीत". Bina prefix ke
 * "भय" akela kabhi match nahi karta.
 */
export function ftsQuery(q) {
  const STOP = new Set("का के की को कि में से और पर यह जो है ने भी एक था the and for with".split(" "));
  const words = [...String(q || "").toLowerCase().matchAll(/[ऀ-ॿ]{2,}|[a-z]{3,}/g)]
    .map(m => m[0]).filter(w => !STOP.has(w));
  const uniq = [...new Set(words)].slice(0, 12);
  if (!uniq.length) return null;
  // FTS5 me " aur * khaas hain — shabd ko quote karke * bahar rakho
  return uniq.map(w => `"${w.replace(/"/g, "")}"*`).join(" OR ");
}
