/**
 * SAARTHI — AI ke jawab ko HTML me badalna, SURAKSHIT tarike se
 * =====================================================================
 * 2026-08-18.  Shuddh function — koi React, koi DOM. Isliye test ho sakte.
 *
 * ⚠️ YE FILE SURAKSHA KA HISSA HAI. Halke me mat badalna.
 *
 * KYUN: `Prose` (Primitives.jsx) AI ka jawab `dangerouslySetInnerHTML` se
 * dikhata hai — kyunki usme hamara apna markup (bold, italic, code) jodna
 * hota hai. Yaani agar model kabhi `<img src=x onerror=alert(1)>` likh de
 * aur hum use bina badle daal dein, to wo BROWSER ME CHAL JAYEGA.
 *
 * Aur model ka paath hamesha "hamara" nahi hota: user apne sawaal me kuch
 * bhi likh sakta hai, aur granthon ka OCR bhi kuch bhi ugal sakta hai.
 * Isliye ise bahar se aaya hua paath maankar hi chalna hai.
 *
 * ⚠️ POORI SURAKSHA SIRF EK BAAT PAR TIKI HAI — KRAM.
 *     escapeHtml PEHLE, hamara markup BAAD ME.
 * Ulta karne par hamara apna <strong> bhi escape ho jayega (dikhega nahi)
 * — aur usse bhi bura, model ka `<script>` bach jayega.
 *
 * 18 Agast ke audit me ye kram SAHI paya gaya aur paanch hamle chala kar
 * jaancha gaya. Par uska koi TEST nahi tha — yaani ek refactor door tha.
 * Ab markdown.test.js me wahi paanch hamle likhe hain.
 */

/**
 * Har wo akshar badlo jisse HTML ban sakta hai.
 *
 * ⚠️ `&` SABSE PEHLE — warna hamara apna `&lt;` phir se badal kar
 * `&amp;lt;` ban jayega aur user ko `&lt;` dikhega, `<` nahi.
 */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Ek pankti ka markdown → HTML.
 *
 * @param {string} raw     — AI ka kaccha paath
 * @param {object} rang    — theme ke rang (C). Pure rakhne ke liye bahar se
 *                           aata hai, import nahi hota.
 *
 * ⚠️ Pehla kadam escapeHtml HAI. Ise hatana ya neeche le jaana XSS khol
 *    dega. Agar kabhi naya markup jodna ho, wo ISKE BAAD hi jude.
 */
export function inlineMarkup(raw, rang) {
  const safe = escapeHtml(raw);           // ← pehle safai, phir hamara markup
  return safe
    .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${rang.ink};font-weight:700">$1</strong>`)
    .replace(/\*(.*?)\*/g,     `<em style="color:${rang.body}">$1</em>`)
    .replace(/`(.*?)`/g,       `<code style="background:${rang.goldBg};padding:1px 6px;border-radius:4px;font-size:13px;color:${rang.saffron}">$1</code>`);
}
