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
  // 2026-08-07: valmiki_ramayana hatai gayi (OCR kachra tha — 381 akshar/
  // page, tootna 0.50, ek bhi kand ka naam nahi). Ramayan ke saare hint
  // ab Ramcharitmanas par — wahi granth ab saara vishay theek se cover
  // karta hai (saare 7 kand, हनुमान 356). "वाल्मीकि" bhi yahin isliye ki
  // user wo naam le to use Ramayan hi chahiye, aur wo ab yahi hai.
  "ramayan": "ramcharitmanas", "ramayana": "ramcharitmanas",
  "रामायण": "ramcharitmanas", "वाल्मीकि": "ramcharitmanas",
  // Mahabharat — "गीता" upar pehle aati hai (Object.entries ka kram =
  // match ki priority), isliye "गीता में..." aaj bhi Gita par hi jaata hai.
  // Yeh theek hai: Gita ka apna samarpit granth maujood hai.
  "mahabharat": "mahabharata", "mahabharata": "mahabharata",
  "महाभारत": "mahabharata", "विदुर": "mahabharata", "vidur": "mahabharata",
  "vidur neeti": "mahabharata", "विदुर नीति": "mahabharata",
  "युधिष्ठिर": "mahabharata", "yudhishthir": "mahabharata",
  "भीष्म": "mahabharata", "bhishma": "mahabharata",
  "द्रौपदी": "mahabharata", "draupadi": "mahabharata",
  "कौरव": "mahabharata", "पांडव": "mahabharata", "पाण्डव": "mahabharata",
  "kaurav": "mahabharata", "pandav": "mahabharata",
  "शांतिपर्व": "mahabharata", "शान्तिपर्व": "mahabharata",
  "अनुशासनपर्व": "mahabharata", "कुरुक्षेत्र": "mahabharata",
  // ── RAMAYAN KE PAATR → RAMCHARITMANAS (2026-08-10) ──────────────────
  //
  // ⚠️ YE ENTRIES "mahabharat" KE BAAD HI RAHNI CHAHIYE. Roman "bharat"
  // "mahabharat" ka substring hai, aur detectHintedBook pehla match jeetne
  // deta hai — isliye "Mahabharat me…" wala sawaal upar hi pakda jaata hai
  // aur yahan tak aata hi nahi. Kram badla to woh toot jaayega.
  // (Devanagari mein ye khatra nahi: "महाभारत" mein "भारत" hai, "भरत" nahi.)
  //
  // KYUN JODA: is list mein Mahabharat ke paatr (युधिष्ठिर, भीष्म,
  // द्रौपदी, कौरव) pehle se the, par Ramayan ka EK BHI paatr nahi tha —
  // sirf granth ke naam. Nateeja: "Hanuman ji ko Jambavan ne kya yaad
  // dilaya?" jaise sawaal par koi granth hinted hi nahi hota tha.
  //
  // Sirf ye jodna KAAFI NAHI tha — Ramcharitmanas ke ansh pool mein aane
  // ke baad bhi gate (0.30) se neeche reh jaate the (naapa: sabse ooncha
  // 0.2447). Isi naap se worker mein hinted-granth ke liye alag floor
  // (0.18) bana — dono cheezein saath chalti hain, akele koi nahi.
  //
  // "राम" aur "ram" JAAN-BOOJHKAR NAHI hain: Roman "ram" to "program",
  // "gram", "dharam" sabmein hai, aur "राम" "परशुराम"/"बलराम" mein bhi.
  // Isliye sirf wo naam jo apne aap mein saaf hain.
  "hanuman": "ramcharitmanas", "हनुमान": "ramcharitmanas", "हनूमान": "ramcharitmanas",
  "bajrangbali": "ramcharitmanas", "बजरंगबली": "ramcharitmanas",
  "sita": "ramcharitmanas", "सीता": "ramcharitmanas", "जानकी": "ramcharitmanas",
  "lakshman": "ramcharitmanas", "laxman": "ramcharitmanas",
  "लक्ष्मण": "ramcharitmanas", "लछमन": "ramcharitmanas",
  "bharat": "ramcharitmanas", "भरत": "ramcharitmanas",
  "shatrughna": "ramcharitmanas", "शत्रुघ्न": "ramcharitmanas",
  "dashrath": "ramcharitmanas", "दशरथ": "ramcharitmanas",
  "kaikeyi": "ramcharitmanas", "कैकेयी": "ramcharitmanas",
  "kausalya": "ramcharitmanas", "कौसल्या": "ramcharitmanas",
  "urmila": "ramcharitmanas", "उर्मिला": "ramcharitmanas",
  "ravan": "ramcharitmanas", "ravana": "ramcharitmanas", "रावण": "ramcharitmanas",
  "vibhishan": "ramcharitmanas", "विभीषण": "ramcharitmanas",
  "kumbhkaran": "ramcharitmanas", "कुम्भकर्ण": "ramcharitmanas", "कुंभकर्ण": "ramcharitmanas",
  "meghnad": "ramcharitmanas", "मेघनाद": "ramcharitmanas",
  "mandodari": "ramcharitmanas", "मन्दोदरी": "ramcharitmanas",
  "surpanakha": "ramcharitmanas", "शूर्पणखा": "ramcharitmanas",
  "sugriv": "ramcharitmanas", "सुग्रीव": "ramcharitmanas",
  "jambavan": "ramcharitmanas", "जाम्बवान": "ramcharitmanas", "जामवंत": "ramcharitmanas",
  "angad": "ramcharitmanas", "अंगद": "ramcharitmanas",
  "jatayu": "ramcharitmanas", "जटायु": "ramcharitmanas",
  "kevat": "ramcharitmanas", "kewat": "ramcharitmanas", "केवट": "ramcharitmanas",
  "shabari": "ramcharitmanas", "शबरी": "ramcharitmanas",
  "ahalya": "ramcharitmanas", "अहल्या": "ramcharitmanas",
  "ayodhya": "ramcharitmanas", "अयोध्या": "ramcharitmanas",
  "lanka": "ramcharitmanas", "लंका": "ramcharitmanas", "लङ्का": "ramcharitmanas",
  "chitrakoot": "ramcharitmanas", "चित्रकूट": "ramcharitmanas",
  "kishkindha": "ramcharitmanas", "किष्किन्धा": "ramcharitmanas",
  "panchvati": "ramcharitmanas", "पञ्चवटी": "ramcharitmanas", "पंचवटी": "ramcharitmanas",
  "vanvas": "ramcharitmanas", "वनवास": "ramcharitmanas",
  "ashok vatika": "ramcharitmanas", "अशोक वाटिका": "ramcharitmanas",
  "अशोकवाटिका": "ramcharitmanas", "ramsetu": "ramcharitmanas", "रामसेतु": "ramcharitmanas",
  "बालकांड": "ramcharitmanas", "बालकाण्ड": "ramcharitmanas",
  "अयोध्याकांड": "ramcharitmanas", "अयोध्याकाण्ड": "ramcharitmanas",
  "अरण्यकांड": "ramcharitmanas", "अरण्यकाण्ड": "ramcharitmanas",
  "किष्किंधाकांड": "ramcharitmanas", "लंकाकांड": "ramcharitmanas",
  "लङ्काकाण्ड": "ramcharitmanas", "उत्तरकांड": "ramcharitmanas", "उत्तरकाण्ड": "ramcharitmanas",

  "garud": "garuda_purana_1", "garuda": "garuda_purana_1",
  "गरुड़ पुराण": "garuda_purana_1", "गरुड पुराण": "garuda_purana_1",
  // ⚠️ Khand 2 wale naam PEHLE — warna generic "shiv puran" unhe khand 1
  // par bhej deta hai (naapa gaya: "Shiv Puran Khand 2" → shiva_purana_1).
  "shiv puran khand 2": "shiva_purana_2", "shiva purana khand 2": "shiva_purana_2",
  "शिव पुराण खण्ड २": "shiva_purana_2", "शिव पुराण खंड 2": "shiva_purana_2",
  "jyotirlinga": "shiva_purana_2", "ज्योतिर्लिंग": "shiva_purana_2",
  "shiv puran": "shiva_purana_1", "shiva puran": "shiva_purana_1", "शिव पुराण": "shiva_purana_1",
  "vishnu puran": "vishnu_purana_1", "विष्णु पुराण": "vishnu_purana_1",
  "agni": "agni_purana", "अग्नि पुराण": "agni_purana",
  "narsimha": "narasimha_purana", "narasimha": "narasimha_purana", "नरसिंह पुराण": "narasimha_purana",
  // "Narshim Puran" — user ki apni PDF ka naam yahi hai, aur is spelling
  // par pehle koi hint nahi lagta tha.
  "narshim": "narasimha_purana", "narsingh": "narasimha_purana", "नृसिंह": "narasimha_purana",
  "bhavishya": "bhavishya_purana", "भविष्य पुराण": "bhavishya_purana",
  "rigved": "rigveda_1", "rigveda": "rigveda_1", "ऋग्वेद": "rigveda_1",
  "samved": "samaveda", "samaveda": "samaveda", "सामवेद": "samaveda",
  "yajurved": "yajurveda", "yajurveda": "yajurveda", "यजुर्वेद": "yajurveda",
  "atharv": "atharvaveda_1", "atharva": "atharvaveda_1", "अथर्ववेद": "atharvaveda_1",
  // Batch 2
  // ⚠️ "katha upanishad" YAHAN, generic "upanishad" se PEHLE. Naapa gaya:
  // pehle "Katha Upanishad me kya hai" → ishadi_upanishad chala jaata tha,
  // kyunki neeche wala generic "upanishad" pehle match kar leta tha.
  "kathopanishad": "kathopanishad", "katho": "kathopanishad", "nachiketa": "kathopanishad",
  "katha upanishad": "kathopanishad", "kath upanishad": "kathopanishad",
  "yamraj": "kathopanishad", "shreyas": "kathopanishad", "preyas": "kathopanishad",
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
  "yoga vasishtha": "yoga_vasishtha", "yog vashisth": "yoga_vasishtha",
  "योगवासिष्ठ": "yoga_vasishtha", "योग वासिष्ठ": "yoga_vasishtha",
  "योगवाशिष्ठ": "yoga_vasishtha", "वसिष्ठ": "yoga_vasishtha", "वशिष्ठ": "yoga_vasishtha",
  "महारामायण": "yoga_vasishtha", "वैराग्य": "yoga_vasishtha",
  // ⚠️ Is granth ka ROMAN naam hint-list me tha hi nahi — sirf Devanagari
  // aur "pooja vidhi". "Nitya Karm Pooja me achaman ka purpose kya hai?"
  // jaise seedhe sawaal par koi granth hinted nahi hota tha.
  "nitya karm pooja": "nitya_karm_pooja", "nitya karm": "nitya_karm_pooja",
  "nityakarm": "nitya_karm_pooja", "sandhya vandan": "nitya_karm_pooja",
  "achaman": "nitya_karm_pooja", "arghya": "nitya_karm_pooja",
  "naivedya": "nitya_karm_pooja", "sankalp": "nitya_karm_pooja",
  "pooja vidhi": "nitya_karm_pooja", "नित्य कर्म पूजा": "nitya_karm_pooja", "नित्य पूजा": "nitya_karm_pooja",
  "ramcharitmanas": "ramcharitmanas", "ramcharit manas": "ramcharitmanas",
  "रामचरितमानस": "ramcharitmanas", "रामचरित मानस": "ramcharitmanas",
  "मानस": "ramcharitmanas", "तुलसीदास": "ramcharitmanas", "tulsidas": "ramcharitmanas",
  "चौपाई": "ramcharitmanas", "सुंदरकांड": "ramcharitmanas", "सुन्दरकाण्ड": "ramcharitmanas",
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
