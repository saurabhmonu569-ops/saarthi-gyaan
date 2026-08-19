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
 * ⚠️ `chuneGayeGranth` YAHAN SE HATA DIYA GAYA — 19 Agast 2026
 *
 * Wo SHABD-MEL wala tareeka tha: jawab aur ansh ke vishisht shabd milao,
 * aur jis granth ke 2+ shabd na milein use Aadhaar se hata do.
 *
 * DO BAAR FAIL HUA (14 aur 17 Agast). Model apne shabdon me likhta hai,
 * isliye SACHA granth bhi kat jaata tha — aur wo us galti se bura hai
 * jise theek karne ke liye ye banaya gaya tha.
 *
 * KYUN HATANA ZAROORI THA, RAKHNA NAHI:
 * Use koi bulata hi nahi tha — na app, na koi script. Par uske 7 test
 * HARE the. Mara hua code jiske test pass hote hain, wo jhoothi tasalli
 * hai: "aadhaar.js ke 12 test hare hain" sunkar lagta tha ki Aadhaar
 * jaancha hua hai, jabki ASLI tark kahin aur tha aur ANJAANCHA tha.
 *
 * Aur wo bhram mehnga pada: 18 Agast ko 24_aadhaar_check.mjs isi mare
 * hue module ko naap rahi thi aur "khatra 7" chhaap rahi thi, jabki app
 * bilkul theek chal rahi thi.
 *
 * ASLI TARK AB: src/shared/aadhaar.js  (app aur naap dono wahi bulate)
 *
 * `vishishtShabd` yahin hai — use 29_vishay_jaanch.mjs sach me bulati hai.
 */
