/**
 * SAARTHI — Jawab ki jaanch (2026-08-04)
 * =====================================================================
 * KYUN — ek asli ghatna:
 *
 * User ne poochha "jap vidhi bataye". Model ko SIRF ek passage diya gaya
 * tha (mantra_shakti p.133). Model ne jawab mein likha:
 *
 *     📜 "जपमान् यस्य मनस्सहितम्" — मन्त्र महासागर (पृष्ठ १४)
 *     📜 "जप स्यात् सिद्धिदायक:"  — मन्त्र महासागर (पृष्ठ २०)
 *
 * Jaanch karne par:
 *   - "जपमान् यस्य मनस्सहितम्" poore 23,425 chunks mein EK BAAR bhi nahi
 *   - मन्त्र महासागर ka panna 14 aur 20 — dono VISHAYANUKRAMANIKA (index) hain
 *   - Model ko woh granth diya hi nahi gaya tha
 *
 * Yaani shlok, granth aur panna — teeno gadhe gaye. Aur neeche footer
 * sach bol raha tha (Mantra Shakti p.133), toh user ko do alag baatein
 * dikhi.
 *
 * SYSTEM_PROMPT mein yeh pehle se saaf mana hai (ATTRIBUTION-SEEMA,
 * SHLOKA KA SAKHT NIYAM). Model ne phir bhi kiya. Poore audit ka sabak
 * yahi raha hai:
 *
 *              PROMPT KEHTA HAI, CODE NIBHATA HAI.
 *
 * Yeh file wahi teesri parat hai — pehli do (reranker gate aur
 * grounded-only footer) pehle se chal rahi hain.
 *
 * DESIGN — jaanbujh kar CONSERVATIVE:
 *   - Sirf woh hatao jo PAKKA galat hai
 *   - Shak ho toh rehne do (jhootha hatana bhi utna hi bura hai)
 *   - Kabhi kuch JODNA nahi, sirf hataana
 */

/** Milaan ke liye normalize — sirf akshar/ank, baaki sab hatao. */
function norm(s) {
  return (s || "").replace(/[^ऀ-ॿA-Za-z0-9]/g, "").toLowerCase();
}

/**
 * Kya yeh uddharan diye gaye passages mein sach mein hai?
 *
 * Seedha substring match kaafi nahi — corpus OCR-scanned hai, aur model
 * quote karte waqt kachra saaf kar deta hai (spacing, danda, matra).
 * Isliye: quote ke 20-akshar ke tukde banao aur dekho koi bhi tukda
 * passages mein milta hai ya nahi. Asli quote ka koi na koi tukda zaroor
 * milega; gadhe hue ka ek bhi nahi.
 */
function quoteIsGrounded(quote, evidenceNorm) {
  const q = norm(quote);
  if (q.length < 12) return true;          // itna chhota ki faisla na ho — rehne do
  if (evidenceNorm.includes(q)) return true;

  const W = 20;
  if (q.length <= W) return evidenceNorm.includes(q);
  for (let i = 0; i + W <= q.length; i += 4) {
    if (evidenceNorm.includes(q.slice(i, i + W))) return true;
  }
  return false;
}

/**
 * Jawab ko jaancho aur galat hisse hatao.
 *
 * @param {string} text            model ka jawab
 * @param {Array}  groundedChunks  jo passages sach mein aadhaar bane
 * @param {Object} bookNames       { [bookId]: [naam ke roop...] } — sab granth
 * @returns {{ text: string, removed: { quotes: number, citations: number } }}
 */
export function verifyAnswer(text, groundedChunks = [], bookNames = {}) {
  if (!text) return { text, removed: { quotes: 0, citations: 0 } };

  const evidenceNorm = norm(groundedChunks.map(c => c?.chunk?.text || "").join(" "));
  const groundedIds  = new Set(groundedChunks.map(c => c?.chunk?.book).filter(Boolean));

  // Har granth ke naam → uski id (lambe naam pehle, taaki "शिव पुराण खण्ड २"
  // "शिव पुराण" se pehle match ho)
  const nameToId = [];
  for (const [id, names] of Object.entries(bookNames)) {
    for (const n of names) if (n && n.length >= 4) nameToId.push([n, id]);
  }
  nameToId.sort((a, b) => b[0].length - a[0].length);

  let quotes = 0, citations = 0;

  const lines = text.split("\n").map(line => {
    if (!line.trim()) return line;
    let out = line;

    // ── 1. Gadha hua UDDHARAN ────────────────────────────────────────
    // Model 📜 "..." format use karta hai (prompt usse maangta hai).
    // Aisi line ka poora matlab hi uddharan hai — na mile toh poori line
    // hatao, aadha vaakya chhodne se behtar.
    const qm = out.match(/[""«»"]([^""«»"\n]{10,400})[""«»"]/);
    if (qm && !quoteIsGrounded(qm[1], evidenceNorm)) {
      quotes++;
      return null;                          // poori line hatao
    }

    // ── 1b. Vaakya ke ANDAR wali jhoothi attribution ─────────────────
    // Asli ghatna (2026-08-04): grounded sirf mantra_shakti tha, par jawab
    // mein likha tha "गरुड़ पुराण के अनुसार, पितृ यज्ञ के दौरान...".
    // Pehla version ise nahi pakadta tha kyunki woh sirf ANT wali
    // "— <granth>" citation dekhta tha.
    //
    // Yahan poora vaakya nahi hatate — sirf attribution ka hissa hatate
    // hain. "गरुड़ पुराण के अनुसार, X" → "X". Baat model ki apni reh
    // jaati hai, kisi granth ke naam par nahi thopi jaati.
    for (const [name, id] of nameToId) {
      if (groundedIds.has(id)) continue;              // sahi granth — chhodo
      if (!out.includes(name)) continue;
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const attr = new RegExp(
        `${esc}\\s*(?:के\\s+अनुसार|के\\s+मुताबिक|में\\s+(?:कहा|लिखा|बताया)\\s+गया\\s+है\\s+कि|में\\s+वर्णित\\s+है\\s+कि|according\\s+to|says\\s+that|states\\s+that)\\s*[,:—-]?\\s*`,
        "gi"
      );
      const before = out;
      out = out.replace(attr, "");
      if (out !== before) citations++;
    }

    // ── 2. Gadhi hui CITATION ────────────────────────────────────────
    // "— मन्त्र महासागर (पृष्ठ १४)" jaisa ant ka hissa. Agar us granth ka
    // koi passage diya hi nahi gaya tha, toh yeh attribution jhoothi hai.
    // Sirf citation hatao, vaakya rehne do.
    out = out.replace(/\s*[—–]\s*([^\n—–]{3,60})\s*$/, (full, cited) => {
      const c = norm(cited);
      for (const [name, id] of nameToId) {
        if (c.includes(norm(name))) {
          if (!groundedIds.has(id)) { citations++; return ""; }
          return full;                      // sahi granth — rehne do
        }
      }
      return full;                          // koi jaana-pehchana granth nahi — chhedo mat
    });

    return out;
  }).filter(l => l !== null);

  return {
    text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    removed: { quotes, citations },
  };
}
