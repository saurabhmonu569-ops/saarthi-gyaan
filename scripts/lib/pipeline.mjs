/**
 * SAARTHI — poora raasta, EK jagah                          2026-08-19
 * =====================================================================
 * `/search` → `/chat` → Aadhaar. Jo bhi script asli jawab naapna chahti
 * hai, wo yahan se chalti hai.
 *
 * ⚠️ YE FILE ISLIYE HAI KI YEHI KAAM TEEN BAAR LIKHA JA CHUKA HAI, AUR
 * HAR NAKAL NE KABHI NA KABHI JHOOTH BOLA:
 *
 *   debug-query.mjs        — `MIN_RERANK_SCORE = 0.5` likha tha jabki
 *                            server 0.30/0.18 par chal raha tha. Aur wo
 *                            `toDevanagari(q)` seedha bhejti thi jabki app
 *                            teen kadam se guzarti hai. Uske saare nidaan
 *                            APP KE THE HI NAHI.
 *   24_aadhaar_check.mjs   — Aadhaar ka tark haath se dobara likha tha;
 *                            18 Agast ko "khatra 7" chhaap rahi thi jabki
 *                            app bilkul theek chal rahi thi.
 *   19_eval_perbook.mjs    — query banane ka tark apne paas rakhta hai.
 *
 * Ab ek jagah. Aur query BHEJI hi nahi jaati — worker khud banata hai
 * (`{ q }`), isliye us hisse me drift ho hi nahi sakti.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── .env ──────────────────────────────────────────────────────────────
const env = {};
if (existsSync(join(ROOT, ".env"))) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const API     = (env.VITE_AI_PROXY_URL || process.env.AI_PROXY_URL || "").trim().replace(/\/+$/, "");
export const ORIGIN  = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
export const SESSION = (env.EVAL_SESSION || "").trim();

if (!API) { console.error("❌ .env me VITE_AI_PROXY_URL chahiye"); process.exit(1); }

/**
 * ⚠️ SESSION HEADER DONO CALL PAR.
 * 18 Agast ko `/chat` wali jaanch me yahi chhoot gaya tha — call anonymous
 * gayi, din-bhar ke kote par 429 khaayi, aur script "Ask section BAND hai"
 * chhaap gayi. Wo JHOOTH tha. Asli outage aur script ki apni galti bilkul
 * ek jaise dikhte hain, isliye ye header yahan sabse upar hai.
 */
export const H = () => {
  const h = { "Content-Type": "application/json", Origin: ORIGIN };
  if (SESSION) h["X-Saarthi-Session"] = SESSION;
  return h;
};

export const so = (ms) => new Promise(s => setTimeout(s, ms));

// ── SYSTEM_PROMPT — gemini.js se, haath se likha hua NAHI ─────────────
//
// ⚠️ gemini.js `import.meta.env` (Vite ka) istemaal karta hai, jo Node me
// nahi hota — poora module import karne par crash ho jaata hai. Isliye
// file se seedha nikaala jaata hai.
//
// ⚠️ AUR YAHAN EK BUG HO CHUKA HAI: pehle iska ant `` `; `` dhoondh kar
// tay hota tha, par prompt SIRF ek backtick par khatam hota hai. Nateeja:
// 2,278 akshar JS code system-prompt me ghus gaya, aur 13 Agast ki poori
// jaanch bekaar ho gayi. Isliye neeche ek pehra bhi hai.
export const SYSTEM_PROMPT = (() => {
  const src = readFileSync(join(ROOT, "src", "services", "gemini.js"), "utf8");
  const SHURU = "export const SYSTEM_PROMPT = `";
  const a = src.indexOf(SHURU);
  if (a < 0) throw new Error("gemini.js me SYSTEM_PROMPT nahi mila");
  const shuru = a + SHURU.length;

  // bina-escape wala pehla backtick hi ant hai
  let b = -1;
  for (let i = shuru; i < src.length; i++) {
    if (src[i] === "`" && src[i - 1] !== "\\") { b = i; break; }
  }
  if (b < 0) throw new Error("SYSTEM_PROMPT ka band karne wala backtick nahi mila");

  // Kaccha prompt — `${GRANTH_COUNT}` / `${GRANTH_LIST}` abhi bhare nahi
  // gaye. Wo promptBanao() karta hai (BOOK_META async import se aata hai).
  return src.slice(shuru, b);
})();

/**
 * BOOK_META ke saath prompt ke sthaan bharo.
 * Alag isliye ki BOOK_META async import se aata hai.
 */
export async function promptBanao() {
  const { BOOK_META } = await import("../../src/data/bookMeta.js");
  let p = SYSTEM_PROMPT
    .replace(/\$\{GRANTH_COUNT\}/g, String(Object.keys(BOOK_META).length))
    .replace(/\$\{GRANTH_LIST\}/g, Object.values(BOOK_META).map(m => m.en || m.title).join(", "));

  // ⚠️ PEHRA — agar nikalne ka tareeka phir toota, to JS code prompt me
  // ghus jayega aur poori jaanch chup-chaap jhoothi ho jayegi.
  if (/\bexport (?:const|function)\b|=>\s*\{/.test(p))
    throw new Error("SYSTEM_PROMPT me JS code ghus gaya — nikalne ka tareeka dobara dekhiye");
  return p;
}

// ── /search ───────────────────────────────────────────────────────────
/**
 * ⚠️ SIRF KACCHA SAWAAL. findQ/rerankQ/hintedBook worker banata hai.
 * 18 Agast se pehle har script apni nakal se query banati thi aur wo
 * nakal drift kar chuki thi.
 */
export async function khojo(q, { debug = false, koshish = 1 } = {}) {
  const r = await fetch(API + "/search", {
    method: "POST", headers: H(),
    body: JSON.stringify(debug ? { q, debug: true } : { q }),
  });
  if (r.status === 429 && koshish <= 4) { await so(8000 * koshish); return khojo(q, { debug, koshish: koshish + 1 }); }
  if (!r.ok) throw new Error(`/search HTTP ${r.status}`);
  const j = await r.json();
  return { chunks: j.chunks || [], stats: j.stats || null };
}

/** ChatView jaisa hi dhaancha — gemini.js isi roop me padhta hai. */
export async function dhaalo(chunks) {
  const { BOOK_META } = await import("../../src/data/bookMeta.js");
  const naam = id => (BOOK_META[id]?.en || BOOK_META[id]?.title || id);
  return chunks.map(ch => ({
    chunk: { book: ch.book, book_title: naam(ch.book), text: ch.text },
    rerank: ch.rerank ?? 0,
    grounded: ch.grounded === true,
  }));
}

// ── /chat ─────────────────────────────────────────────────────────────
export async function jawabLo(sawaal, dhale, prompt, koshish = 1) {
  const blocks = dhale.map((r, i) =>
    `[${i + 1}] ${r.chunk.book_title}\n${(r.chunk.text || "").slice(0, 800)}`).join("\n\n");
  const userText = dhale.length
    ? `${sawaal}\n\nRELEVANT PASSAGES RETRIEVED FROM SACRED BOOKS (${dhale.length} passages):\n\n${blocks}`
    : sawaal;

  const r = await fetch(API + "/chat", {
    method: "POST", headers: H(),
    body: JSON.stringify({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userText },
      ],
      temperature: 0.6, max_tokens: 900,
    }),
  });
  if ((r.status === 429 || r.status >= 500) && koshish <= 3) {
    await so(5000 * koshish);
    return jawabLo(sawaal, dhale, prompt, koshish + 1);
  }
  if (!r.ok) throw new Error(`/chat HTTP ${r.status} — ${(await r.text()).slice(0, 120)}`);
  const j = await r.json();

  // ⚠️ SIRF `content` MAT LAUTAO — `finish_reason` aur `usage` BHI.
  //
  // 19 Agast: 12 me se 3 jawab BILKUL KHAALI aaye. Wajah dhoondhne ke liye
  // worker me kuch jodne ki taiyari ho rahi thi — tabhi dikha ki worker
  // Groq ka jawab JAISA HAI WAISA aage bhej deta hai. Yaani `finish_reason`
  // aur reasoning-token ki ginti PEHLE SE yahan aa rahi thi, aur script
  // unhe pheink rahi thi.
  //
  // KYUN YE ZAROORI HAI: `openai/gpt-oss-120b` ek REASONING model hai. Wo
  // "sochne" me bhi token kharch karta hai, aur wo kharch usi max_tokens
  // budget se nikalta hai. Budget khatam → content khaali, `finish_reason:
  // "length"`. Bilkul yahi bug Gemini par pakda aur `thinkingLevel: "low"`
  // se theek kiya gaya tha (worker line ~482) — par Groq par kabhi dekha
  // hi nahi gaya, aur Groq hi MUKHYA engine hai.
  const ch = j?.choices?.[0] || {};
  const u  = j?.usage || {};
  return {
    text: ch?.message?.content || j?.text || "",
    ant: ch?.finish_reason || null,          // "stop" = poora, "length" = kat gaya
    token: {
      jawab: u.completion_tokens ?? null,
      sochne: u.completion_tokens_details?.reasoning_tokens ?? null,
      sawaal: u.prompt_tokens ?? null,
    },
    model: j?.model || null,
  };
}
