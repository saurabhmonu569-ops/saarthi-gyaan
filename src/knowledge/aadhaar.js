/**
 * SAARTHI — Aadhaar me KAUN SA granth jaaye                  (2026-08-14)
 * =====================================================================
 * ⚠️⚠️  YE ABHI ISTEMAAL ME NAHI HAI — AAZMAYA AUR HATAYA GAYA  ⚠️⚠️
 *
 * useChat.js ne ise 14 Aug ko jod kar phir hata diya. Wajah:
 *
 * 12 unit-test hare the, par wo test MAINE banaye the — yaani wo sirf
 * wahi pakadte the jo maine socha. 24_aadhaar_check.mjs ne ASLI jawab
 * par chalaya (25 sawaal, kota 5 par khatam), aur 5 me se 4 ULTE nikle:
 *
 *   "Agni Puran ko encyclopedic kyun kaha jata hai?"
 *       raha: Rigveda        hata: Agni Purana    ← sahi granth hi gaya
 *   "Gita mein indriyon aur mann ka relation"
 *       raha: Mahabharata    hata: Bhagavad Gita  ← jawab me NAAM likha tha
 *   "Bhavishya Puran mein marriage duties"
 *       raha: Rashi-Muhurt   hata: Bhavishya Purana
 *
 * DO MAANYATAYEN GALAT NIKLI:
 *   1. "sabse ooncha rerank = sabse zyada istemaal" — nahi. Namoona 1 me
 *      Rigveda ka score ooncha tha, par jawab Agni Puran ka tha.
 *   2. "jawab aur ansh me vishisht shabd milenge" — nahi. Model purani
 *      Hindi ko aaj ki bhasha me likhta hai. Shabd-mel bahut kamzor
 *      sanket hai aur DONO taraf fail hota hai: sacha granth kat jaata
 *      hai, aur galat granth reh jaata hai.
 *
 * File isliye rakhi hai ki (a) `vishishtShabd` kahin aur kaam aa sakta
 * hai, aur (b) koi dobara yahi tareeka na aazmaye. Niyam #2 ka sahi
 * raasta shayad ye hai ki MODEL SE HI poochha jaye ki usne kaun se
 * granth istemaal kiye — par wo prompt ka kaam hai aur uski apni jaanch
 * chahiye.
 * =====================================================================
 * NIYAM (SAURABH ne 13 Aug ko tay kiya):
 *
 *     "Naam sirf usi granth ka jiska ansh SACH ME jawab me istemaal hua."
 *
 * PEHLE KYA HO RAHA THA: footer un SAB granthon ka naam de deta tha
 * jinke ansh model ko diye gaye the (grounded, 5 tak) — chahe model ne
 * unhe chhua bhi na ho. Jawab 3 granth se banta tha, naam 5 ka jaata tha.
 *
 * Nuksaan seedha hai: user Aadhaar me "Garud Puran" dekhta hai, us granth
 * me dhoondhne jaata hai, aur use kuch nahi milta. Ek baar aisa hone par
 * wo baaki Aadhaar par bhi bharosa karna chhod deta hai.
 *
 * ⚠️ ULTA KHATRA BHI UTNA HI ASLI HAI
 * ------------------------------------
 * Model jawab APNE SHABDON me likhta hai — granth ki purani Hindi ko
 * aaj ki bhasha me. Agar niyam bahut sakht kar dein ("jiska koi shabd
 * jawab me nahi, use hatao"), to wo granth bhi hat jaayenge jo SACH ME
 * istemaal hue. Aur tab hum apni sabse badi taakat — sacha Aadhaar —
 * khud hi kaat denge.
 *
 * Isliye yahan do savdhaniyan hain:
 *   1. Sirf VISHISHT shabd gine jaate hain (naam, paribhashik shabd),
 *      aam shabd nahi. "है", "और", "धर्म" har granth me hain.
 *   2. SABSE ACHHA granth HAMESHA rehta hai, chahe uska ek shabd bhi
 *      jawab me na mile. Aadhaar kabhi khaali nahi hona chahiye — wo
 *      galat Aadhaar se bhi bura hai.
 */

/**
 * Bahut aam Devanagari shabd — inka jawab me hona kuch saabit nahi karta.
 * Ye soochi jaan-boojhkar CHHOTI hai: sirf wo shabd jo lagbhag har granth
 * me hain. Ise badhane par asli sanket bhi kat-ne lagega.
 */
const AAM_SHABD = new Set([
  "किया", "किये", "करना", "करने", "होता", "होती", "होते", "हुआ", "हुई", "हुए",
  "जाता", "जाती", "जाते", "कहा", "कहते", "कहना", "गया", "गयी", "गये", "लिये",
  "लिए", "साथ", "बाद", "समय", "प्रकार", "अनुसार", "इसलिए", "इसलिये", "उनके",
  "उनका", "उनकी", "अपने", "अपना", "अपनी", "सभी", "सबका", "वाले", "वाला", "वाली",
  "यहाँ", "वहाँ", "जहाँ", "तथा", "एवं", "किन्तु", "परन्तु", "लेकिन", "क्योंकि",
  "फिर", "भी", "ही", "तो", "पर", "से", "में", "का", "की", "के", "को", "और",
  "है", "हैं", "था", "थे", "थी", "यह", "वह", "जो", "उस", "इस", "एक", "नहीं",
]);

/**
 * Paath se VISHISHT shabd nikaalo.
 *
 * ⚠️ \p{M} ZAROORI hai. Devanagari me matra (ृ, ा, ि) Unicode me "mark"
 * hoti hai, "letter" nahi. Bina \p{M} ke "कृष्ण" teen tukdon me toot
 * jaata hai — क, ष, ण — aur teenon 1-akshar ke hokar chhan jaate hain.
 * Yahi galti is project me do baar ho chuki hai (`\b` ke saath bhi).
 *
 * ⚠️ LAMBAI 3, 4 NAHI. JS ki `length` AKSHAR nahi, code-unit ginti hai —
 * aur Devanagari me matra apna alag code-unit leti hai:
 *     "राम"   lambai 3   (2 akshar)
 *     "कर्म"  lambai 4   (3 akshar — क, र, ्, म)
 * Pehle maine 4 rakha tha, "kam se kam chaar akshar" sochkar. Us seema
 * ne "राम" ko hata diya hota — jo Ramcharitmanas ka sabse pehchana
 * shabd hai. 3 par "राम", "शिव", "गुरु" bach jaate hain, aur "मन",
 * "तप", "जल" (lambai 2) phir bhi chhan jaate hain.
 */
export function vishishtShabd(text) {
  return new Set(
    String(text || "")
      .split(/[^\p{L}\p{N}\p{M}]+/u)
      .filter(w => w.length >= 3 && /[ऀ-ॿ]/.test(w) && !AAM_SHABD.has(w))
  );
}

/**
 * Kaun se granth Aadhaar me jaayein.
 *
 * @param {string} jawab            — model ka poora jawab
 * @param {Array}  groundedChunks   — [{ chunk: { book, book_title }, rerank }]
 * @param {object} opts
 *   @param {number} opts.kamSeKam  — kitne vishisht shabd milne par granth
 *                                    "istemaal hua" maana jaye (default 2)
 *   @param {number} opts.adhikatam — footer me zyada se zyada kitne granth
 * @returns {{ granth: string[], hataye: string[] }}
 *   granth : jo Aadhaar me jaayenge (kram: sabse achhe pehle)
 *   hataye : jo hataye gaye (log ke liye — chup-chaap kuch mat karo)
 */
export function chuneGayeGranth(jawab, groundedChunks, opts = {}) {
  const kamSeKam  = opts.kamSeKam  ?? 2;
  const adhikatam = opts.adhikatam ?? 5;

  const list = Array.isArray(groundedChunks) ? groundedChunks : [];
  if (!list.length) return { granth: [], hataye: [] };

  const jawabShabd = vishishtShabd(jawab);

  // granth-vaar jodo: uske saare ansh, uska sabse ooncha score
  const perGranth = new Map();
  for (const r of list) {
    const naam = (r?.chunk?.book_title || r?.chunk?.book || "").trim();
    if (!naam) continue;
    const g = perGranth.get(naam) || { naam, mel: new Set(), best: -Infinity };
    for (const w of vishishtShabd(r?.chunk?.text)) if (jawabShabd.has(w)) g.mel.add(w);
    g.best = Math.max(g.best, Number(r?.rerank) || 0);
    perGranth.set(naam, g);
  }

  const sab = [...perGranth.values()].sort((a, b) => b.best - a.best);
  if (!sab.length) return { granth: [], hataye: [] };

  // ⚠️ SABSE ACHHA GRANTH HAMESHA RAHEGA.
  // Model paraphrase karta hai; ho sakta hai uske ek bhi shabd ka mel na
  // ho. Par jawab usi se bana hai. Aadhaar khaali chhodna — yaani "ye
  // jawab kahin se nahi aaya" dikhana — galat Aadhaar se bhi bura hai.
  const rakhe  = [sab[0]];
  const hataye = [];
  for (const g of sab.slice(1)) {
    if (g.mel.size >= kamSeKam && rakhe.length < adhikatam) rakhe.push(g);
    else hataye.push(g.naam);
  }

  return { granth: rakhe.map(g => g.naam), hataye };
}
