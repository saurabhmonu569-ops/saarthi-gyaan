/**
 * SAARTHI — JO GRANTH HAMARE PAAS HAIN HI NAHI            2026-08-19
 * =====================================================================
 * Hamare paas 24 granth hain. Uske BAHAR ke granth ka naam lene wale
 * sawaal par koi bhi citation JHOOTHI citation hai — chahe vishay hamare
 * corpus me kitna hi ho.
 *
 * ⚠️ YE "VISHAY BAHAR HAI" WALI BAAT NAHI HAI. Ye usse alag aur zyada
 * bareek rog hai:
 *
 *     sawaal : "अष्टावक्र गीता में विदेह मुक्ति क्या है"
 *     mila   : Yoga Vasishtha ka videha-mukti wala ansh, rerank 0.9965
 *
 * विदेह मुक्ति hamare granthon me SACH ME hai. Reranker galat nahi hai.
 * Galti ATTRIBUTION ki hai — user ne poochha ki FALAN GRANTH kya kehta
 * hai, aur hum doosre granth se jawab dekar uska naam laga rahe hain.
 * Koi bhi score is baat ko theek nahi kar sakta: 0.9965 asli hai.
 *
 * ── KYUN ALAG FILE ──────────────────────────────────────────────────
 * Is list ki zarurat DO jagah hai:
 *   translit.js  → isOutOfScope()      (citation lagne hi na do)
 *   bookHints.js → detectHintedBook()  (galat granth ka hint na bane)
 *
 * Do jagah do nakal rakhna is project ka sabse purana jaal hai — 10
 * Agast ko client 0.30 maang raha tha aur server 0.18 de raha tha, aur
 * Aadhaar poora gaayab ho gaya tha. Isliye ek hi jagah.
 *
 * ── NAAPA HUA (19 Agast 2026) ───────────────────────────────────────
 * `control_kathin` — 20 aise sawaal jo bilkul in-corpus jaise dikhte hain
 * (Devanagari, granth ka naam, aadhyatmik shabd) par jinke granth hamare
 * paas hain hi nahi:
 *     in niyamon se PEHLE : JHOOTHI CITATION 17/20  (best 0.84 – 0.9992)
 *     in niyamon se pakde : 20/20
 *
 * Aur 1,012 in-corpus sawaalon par jaancha — sirf DO flag hue:
 *     "Devi Bhagwat Puran kya sikhata hai?"
 *     "Bhagwat Puran me Krishna ke childhood ka importance kya hai?"
 * Ye galat nahi, SAHI pakde gaye — Bhagavata/Devi Bhagavata Purana
 * hamare paas hai hi nahi. Wo dono sawaal `hinglish_300` (in-corpus set)
 * me galti se pade the.
 *
 * ⚠️ YAHAN NAAM JODTE WAQT DO BAATEIN:
 *   1. Devanagari par `\b` MAT lagana. JS ka \b sirf [A-Za-z0-9_] ko
 *      shabd maanta hai — /\bगीता\b/ KABHI match nahi karta. Ye jaal is
 *      project me paanch jagah mil chuka hai.
 *   2. AKELA "गीता" ya "सूत्र" mat likhna. "गीता" hamari hai (Bhagavad
 *      Gita), aur "सूत्र" Yoga Sutra hai. Sirf POORA naam — "अष्टावक्र
 *      गीता", "ब्रह्मसूत्र" — warna sahi sawaal mar jayenge.
 */

/**
 * Wo granth jo hamare 24 me nahi hain, par jinka naam user le sakta hai.
 * Har jodi: Devanagari roop | Roman roop.
 */
export const ANUPASTHIT_GRANTH = [
  // ── Advaita / Vedanta ke wo granth jo hamare paas nahi ─────────────
  /अष्टावक्र|ashtavakra|ashtavakr/i,
  /विवेक\s*चूड़ामणि|विवेकचूड़ामणि|vivek\s*chudamani|vivekchudamani|vivekachudamani/i,
  /पञ्चदशी|पंचदशी|panchadashi|panchdashi/i,
  /गौडपाद|गौड़पाद|gaudapada|gaudpad/i,
  /ब्रह्मसूत्र|ब्रह्म\s*सूत्र|brahma\s*sutra|brahmasutra/i,   // "सूत्र" akela NAHI
  /दृग्दृश्य\s*विवेक|drig\s*drishya/i,

  // ── Bhakti ─────────────────────────────────────────────────────────
  /नारद\s*भक्ति|narad[a]?\s*bhakti/i,
  /शाण्डिल्य\s*भक्ति|shandilya\s*bhakti/i,
  /भागवत\s*पुराण|श्रीमद्भागवत|श्रीमद्\s*भागवत|bhagavata\s*puran|bhagwat\s*puran|srimad\s*bhagavat|shrimad\s*bhagwat/i,
  //  ⚠️ "श्रीमद्भागवत" aur "श्रीमद्भगवद्गीता" alag hain — dhyan se.

  // ── Yoga ke wo granth jo Patanjali ke alawa hain ───────────────────
  /हठयोग|हठ\s*योग|hath\s*yog|hathyog|hatha\s*yoga/i,
  /घेरण्ड|घेरंड|gheranda|gherand/i,
  /याज्ञवल्क्य|yajnavalkya|yagyavalkya/i,
  /शिव\s*संहिता|shiva\s*samhita/i,

  // ── Kashmir Shaivism / Tantra ──────────────────────────────────────
  /शिव\s*सूत्र|shiv[a]?\s*sutra/i,
  /स्पन्द\s*कारिका|spanda\s*karika/i,
  /कुलार्णव|kularnav/i,
  /सौन्दर्य\s*लहरी|saundarya\s*lahari|soundarya\s*lahari/i,

  // ── "X गीता" — hamari sirf BHAGAVAD Gita hai ───────────────────────
  // Ye sabse zaroori hissa hai. Inke bina detectHintedBook "गीता" dekh kar
  // bhagavad_gita_shankar ka hint de deta hai, aur HINTED_PAKKA=2 us granth
  // ke 2 ansh SCORE DEKHE BINA jawab me daal deta hai — yaani PAKKI
  // jhoothi citation.
  /देवी\s*गीता|devi\s*g(?:i|ee)ta/i,
  /अवधूत\s*गीता|avadh(?:o|u)ot?\s*g(?:i|ee)ta|avadhut\s*g(?:i|ee)ta/i,
  /उद्धव\s*गीता|uddhav\s*g(?:i|ee)ta/i,
  /गणेश\s*गीता|ganesh\s*g(?:i|ee)ta/i,
  /अष्टावक्र\s*गीता|ashtavakra?\s*g(?:i|ee)ta/i,
  /रिभु\s*गीता|ribhu\s*g(?:i|ee)ta/i,

  // ── Dharmashastra / Neeti jo hamare paas nahi ──────────────────────
  // ⚠️ "अर्थशास्त्र" JAAN-BOOJHKAR NAHI — Chanakya Neeti hamare paas hai
  // aur wo usi parampara ka hai; user ke liye wo farak bemaani hai.
  /मनुस्मृति|manusmriti|manu\s*smriti/i,
  /तिरुक्कुरल|tirukkural|thirukkural/i,
  /नाट्यशास्त्र|natyashastra/i,
  /पञ्चतन्त्र|पंचतंत्र|panchatantra|panchtantra/i,
  /हितोपदेश|hitopadesh/i,
];

/** Kya is sawaal me kisi aise granth ka naam hai jo hamare paas nahi? */
export function anupasthitGranthHai(text) {
  const s = String(text || "");
  return ANUPASTHIT_GRANTH.some(re => re.test(s));
}
