/**
 * SAARTHI — AADHAAR: jawab ke neeche kaunse granth ka naam jaaye
 * =====================================================================
 * 2026-08-19.  Shuddh function — koi React, koi network. Isliye test ho
 * sakte, aur — zyada zaroori — NAAP AUR APP EK HI TARK PAR CHALTE HAIN.
 *
 * ⚠️ YE FILE ISLIYE BANI KI YAHI TARK TEEN JAGAH BIKHRA HUA THA:
 *     useChat.js               — app ka asli raasta
 *     24_aadhaar_check.mjs     — uski haath se likhi nakal
 *     knowledge/aadhaar.js     — ek PURANA tareeka jise koi bulata hi nahi
 *
 * Aur uski keemat chukayi ja chuki hai. 18 Agast ko `24_aadhaar_check`
 * "khatra 7" chhaap rahi thi jabki app bilkul theek chal rahi thi —
 * kyunki wo script us tark ko naap rahi thi jo app me tha hi nahi.
 * Nidaan asli tha, bimari nakli.
 *
 * Ab ek hi jagah. Naap badle to app badlegi, aur ulta bhi.
 *
 * ── NIYAM #2 (SAURABH, 13 Agast) ────────────────────────────────────
 *     "Naam sirf usi granth ka jiska ansh SACH ME jawab me istemaal hua."
 *
 * Ise laagu karne ke DO tareeke aazmaye ja chuke hain:
 *
 *   1. SHABD-MEL (knowledge/aadhaar.js) — jawab aur ansh ke shabd milao.
 *      14 aur 17 Agast, DONO baar fail. Model apne shabdon me likhta hai,
 *      isliye SACHA granth bhi kat jaata tha.
 *
 *   2. MODEL SE HI POOCHHO — prompt kehta hai ki ant me `[[GRANTH: A | B]]`
 *      likhe. Yahi ab chalta hai. 18 Agast: citation 52 → 32, khatra 0.
 *
 * ⚠️ PAR MODEL KI BAAT MAANI NAHI JAATI — MILAYI JAATI HAI. Model aisa
 * naam bhi likh deta hai jo hamne bheja hi nahi tha. Isliye uski soochi
 * ko HAMESHA bheje gaye granthon se chhana jaata hai. Wahi asool jo
 * `verifyAnswer` shlokon par lagata hai: maano nahi, MILAO.
 */

/** Bade-chhote akshar aur aage-peeche ki jagah chhod kar milaan. */
const saaf = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * `[[GRANTH: A | B]]` pankti pakdo aur jawab se HATA do.
 *
 * @returns {{ text: string, granthKahe: string[]|null }}
 *   granthKahe === null  → model ne pankti likhi hi nahi
 *
 * ⚠️ HATANA YAHIN HOTA HAI, Aadhaar banane ke waqt NAHI. Aadhaar wala
 * hissa sirf tab chalta hai jab grounded ansh hon; agar hatana wahan hota
 * to bina-ansh wale jawab me ye pankti USER KO DIKH JAATI. Isi kism ki
 * galti `[REPLY LANGUAGE]` tag ke saath ho chuki hai — wo ek raaste par
 * hat-ta tha aur doosre par nahi.
 */
export function granthPanktiNikaalo(jawab) {
  const text0 = String(jawab || "");
  const m = text0.match(/\[\[\s*GRANTH\s*:([^\]]*)\]\]/i);
  if (!m) return { text: text0, granthKahe: null };

  const granthKahe = m[1].split("|").map(s => s.trim()).filter(Boolean);
  const text = text0
    .replace(/\n*\s*\[\[\s*GRANTH\s*:[^\]]*\]\]\s*/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, granthKahe };
}

/** Bheje gaye ansh se granth ke naam — usi kram me, bina dohraav. */
export function bhejeGayeGranth(groundedChunks) {
  const out = [];
  for (const r of (groundedChunks || [])) {
    const bt = (r && r.chunk && (r.chunk.book_title || r.chunk.book)) || "";
    if (bt && !out.includes(bt)) out.push(bt);
  }
  return out;
}

/** Aadhaar me kitne granth se zyada nahi. */
export const AADHAAR_ADHIKTAM = 5;

/**
 * Aakhri Aadhaar-soochi.
 *
 * @param {string[]|null} granthKahe  — model ne jo naam likhe (ya null)
 * @param {Array} groundedChunks      — jo ansh model ko bheje gaye the
 *
 * ⚠️ AADHAAR KABHI KHAALI NAHI HOGA.
 * Agar model ne pankti chhod di, ya galat naam likhe, ya mel shoonya nikla
 * — to purana vyavhaar (saare bheje gaye granth) hi chalta hai. Khaali
 * Aadhaar user ko "ye jawab kahin se nahi aaya" dikhata hai, jo zyada naam
 * dikhane se bhi bura hai.
 */
export function aadhaarBanao(granthKahe, groundedChunks) {
  const bheje = bhejeGayeGranth(groundedChunks);

  let granth = [];
  let gadhe = [];
  if (granthKahe && granthKahe.length) {
    granth = bheje.filter(b => granthKahe.some(k => saaf(k) === saaf(b)));
    // ⚠️ `gadhe` = wo naam jo model ne likhe par hamne bheje hi nahi the.
    // Ye ginti chhupani nahi chahiye — model ka granth GADHNA sabse
    // gambhir galti hai, aur mel use chup-chaap rok deta hai.
    gadhe = granthKahe.filter(k => !bheje.some(b => saaf(k) === saaf(b)));
  }

  const soochiMili = Array.isArray(granthKahe) && granthKahe.length > 0;
  const girGaya = !granth.length;          // purane (zyada) vyavhaar par gire
  if (girGaya) granth = bheje;

  return {
    granth: granth.slice(0, AADHAAR_ADHIKTAM),
    hataye: bheje.filter(b => !granth.includes(b)),
    gadhe,
    soochiMili,
    girGaya,
  };
}
