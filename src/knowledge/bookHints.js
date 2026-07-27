/**
 * SAARTHI — Book name → book_id hints (Roman + Devanagari)
 * ================================================================
 * Extracted out of App.jsx's ChatView (audit 2026-07-25, QA/testability
 * item) so this pure matching logic can be unit-tested without needing to
 * render the whole Chat component. Behaviour is UNCHANGED from before the
 * extraction — same object, same order, same substring-match algorithm.
 *
 * BUG FIX (2026-07-25 autopsy round 2) this list originally documented:
 * hints were Roman-only ("archana", "gita") — a Devanagari-typed question
 * ("नित्य देवता अर्चना...") never matched, so hintedBook stayed null and
 * the "guaranteed book grounding" retrieval fix silently never fired for
 * Hindi-script questions. Devanagari names were added for all 24 books,
 * plus "mantra_shakti" which previously had NO hint at all.
 */

// "mantra shakti" pehle — warna generic "mantra"/"मंत्र" ise hamesha
// mantra_maha_sagar samajh leta (Object.entries() insertion-order = match
// priority, pehla match jeetta hai — is order ko badalna mat).
export const BOOK_HINTS = {
  "gita": "bhagavad_gita_shankar", "geeta": "bhagavad_gita_shankar",
  "गीता": "bhagavad_gita_shankar", "भगवद गीता": "bhagavad_gita_shankar", "भगवद्गीता": "bhagavad_gita_shankar",
  "ramayan": "valmiki_ramayana", "ramayana": "valmiki_ramayana",
  "रामायण": "valmiki_ramayana", "वाल्मीकि": "valmiki_ramayana",
  "garud": "garuda_purana_1", "garuda": "garuda_purana_1",
  "गरुड़ पुराण": "garuda_purana_1", "गरुड पुराण": "garuda_purana_1",
  "shiv puran": "shiva_purana_1", "shiva puran": "shiva_purana_1", "शिव पुराण": "shiva_purana_1",
  "vishnu puran": "vishnu_purana_1", "विष्णु पुराण": "vishnu_purana_1",
  "agni": "agni_purana", "अग्नि पुराण": "agni_purana",
  "narsimha": "narasimha_purana", "narasimha": "narasimha_purana", "नरसिंह पुराण": "narasimha_purana",
  "bhavishya": "bhavishya_purana", "भविष्य पुराण": "bhavishya_purana",
  "rigved": "rigveda_1", "rigveda": "rigveda_1", "ऋग्वेद": "rigveda_1",
  "samved": "samaveda", "samaveda": "samaveda", "सामवेद": "samaveda",
  "yajurved": "yajurveda", "yajurveda": "yajurveda", "यजुर्वेद": "yajurveda",
  "atharv": "atharvaveda_1", "atharva": "atharvaveda_1", "अथर्ववेद": "atharvaveda_1",
  // Batch 2
  "kathopanishad": "kathopanishad", "katho": "kathopanishad", "nachiketa": "kathopanishad",
  "कठोपनिषद": "kathopanishad", "नचिकेता": "kathopanishad",
  "upanishad": "ishadi_upanishad", "upnishad": "ishadi_upanishad", "उपनिषद": "ishadi_upanishad", "ईशादि": "ishadi_upanishad",
  "granth sahib": "guru_granth_sahib", "gurbani": "guru_granth_sahib", "guru nanak": "guru_granth_sahib",
  "ग्रंथ साहिब": "guru_granth_sahib", "गुरबाणी": "guru_granth_sahib", "गुरु नानक": "guru_granth_sahib",
  "chanakya": "chanakya_neeti", "चाणक्य": "chanakya_neeti",
  "ekadashi": "ekadashi_mahatmya", "एकादशी": "ekadashi_mahatmya",
  "lal kitab": "lal_kitab", "upay": "lal_kitab", "jyotish": "lal_kitab",
  "लाल किताब": "lal_kitab", "ज्योतिष": "lal_kitab",
  "rashi": "rashi_muhurt_vigyan", "muhurt": "rashi_muhurt_vigyan", "muhurat": "rashi_muhurt_vigyan",
  "राशि": "rashi_muhurt_vigyan", "मुहूर्त": "rashi_muhurt_vigyan",
  "mantra shakti": "mantra_shakti", "मंत्र शक्ति": "mantra_shakti", "मन्त्र शक्ति": "mantra_shakti",
  "pooja vidhi": "nitya_karm_pooja", "नित्य कर्म पूजा": "nitya_karm_pooja", "नित्य पूजा": "nitya_karm_pooja",
  "archana": "nitya_devta_archana", "अर्चना": "nitya_devta_archana", "देवता अर्चना": "nitya_devta_archana",
  "mantra": "mantra_maha_sagar", "मंत्र": "mantra_maha_sagar", "मन्त्र": "mantra_maha_sagar",
};

/**
 * Query mein kisi book ka naam liya gaya hai kya? Roman ya Devanagari, dono
 * chalte hain. Returns book_id ya null.
 * @param {string} query
 * @returns {string|null}
 */
export function detectHintedBook(query) {
  const ql = (query || "").toLowerCase();
  for (const [hint, bid] of Object.entries(BOOK_HINTS)) {
    if (ql.includes(hint.toLowerCase())) return bid;
  }
  return null;
}
