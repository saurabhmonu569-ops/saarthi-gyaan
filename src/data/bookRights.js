/**
 * SAARTHI — Kaun si kitab Read section mein KHULEGI, aur kram kya hoga
 * =====================================================================
 * 2026-08-06. Ye ek hi jagah hai jahan ye do faisle likhe hain — pehle
 * ye BooksView.jsx aur theme.js mein bikhre the.
 *
 * ── FAISLA 1: PADHNE KI IJAAZAT ──────────────────────────────────────
 *
 * Mool granth (Ved, Puran, Gita) hazaaron saal purane hain aur public
 * domain mein hain. Par jo ANUVAAD, TEEKA aur SAMPADAN hum istemal kar
 * rahe hain, wo NAYI rachnaayein hain — unka copyright alag hai aur
 * zinda hai.
 *
 * Bharat ka "fair dealing" (Copyright Act 1957, Sec 52) America ke fair
 * use jaisa lachila NAHI hai — wo soochibaddh hai. Uske do maayne:
 *
 *   ✅ Ask section  — chhote ansh, source ke saath, nijee adhyayan ke
 *      liye. Ye bachaav ke daayre mein aata hai.
 *   ❌ Read section — poori kitab dikhana. Ye "reproduction" hai, chahe
 *      PDF ho ya text. Iska koi bachaav nahi.
 *
 * Isliye jin kitaabon ka prakashak zinda hai, unki POORI kitab band hai.
 * Naam, vivaran aur prakashak ka shrey DIKHTA hai (chhupana ulta nuksan
 * karta — Sec 65B ke tehet alag apradh) aur kharidne ka link diya hai.
 *
 * ⚠️ PAISE KE PEECHE MAT LAGANA. "Free mein nahi, paid mein hai" wala
 * model is kitab ko VYAVSAYIK upyog bana deta hai, jis par Sec 52 ka
 * bachaav lagta hi nahi. Risk ghatta nahi, BADHTA hai. Isliye "open"
 * ka matlab sabke liye khula, aur "restricted" ka matlab SABKE liye
 * band — owner ke liye bhi.
 *
 * ⚠️ Ye kaanooni salaah NAHI hai. Asli suraksha teen cheezon se aati
 * hai: (1) poori kitab na baantna — ye file wahi karti hai, (2) Gita
 * Press se likhit anumati (12/24 kitaabein ek saath), (3) risk waali
 * kitaabein public-domain sanskaran se badalna.
 */

/** Prakashak ke official store — sirf wahi jo verify ho sake. */
export const PUBLISHER_LINKS = {
  "गीता प्रेस": "https://gitapress.org",
};

/**
 * "open"       = poori kitab khul sakti hai
 * "restricted" = sirf naam/vivaran; poori kitab band
 *
 * `why` seedhe user ko dikhta hai, isliye saaf aur imaandar bhasha.
 */
export const BOOK_RIGHTS = {
  // ── KHULI ──────────────────────────────────────────────────────────
  // Purane sanskaran jinka copyright kaal beet chuka hai (Bharat mein
  // lekhak/anuvaadak ki mrityu + 60 saal). archive.org par sarvajanik
  // roop se uplabdh hain.
  yoga_vasishtha:   { access: "open" },


  // ── BAND ───────────────────────────────────────────────────────────
  // Gita Press (12) — prakashak zinda aur sakriya hai
  // Patanjali Yogasutra — BAND (2026-08-11).
  //
  // Pehle maine ise "open" likha tha, is tark par ki mool sutra 2,000 saal
  // purane hain. Wo tark GALAT hai: khula hona mool paath par nahi, ISS
  // SANSKARAN par tay hota hai — jo Hindi bhashya, uske aasan-chitra aur
  // sampadan sab aaj ke hain. Un par kisi ka haq ho sakta hai.
  //
  // Is PDF me "निदेशक की कलम से" hai aur 24% hissa aasan ki hidayat ka —
  // yaani kisi sanstha ka aaj ka prakashan hai, purana bhashya nahi.
  // Prakashak ka naam nahi pata, isliye `pub` nahi de raha; wo line user
  // ko tabhi dikhegi jab hume sach me pata ho.
  //
  // Unit test ne ye pakda ("sirf public-domain sanskaran khule hain") aur
  // wo theek tha. Adhikar ke maamle me shak ho to BAND — yahi is soochi
  // ka niyam hai (anjaan kitab bhi default se band hai).
  yoga_sutra:            { access: "restricted" },

  bhagavad_gita_shankar: { access: "restricted", pub: "गीता प्रेस" },
  ramcharitmanas:        { access: "restricted", pub: "गीता प्रेस" },
  mahabharata:           { access: "restricted", pub: "गीता प्रेस" },
  shiva_purana_1:        { access: "restricted", pub: "गीता प्रेस" },
  shiva_purana_2:        { access: "restricted", pub: "गीता प्रेस" },
  garuda_purana_1:       { access: "restricted", pub: "गीता प्रेस" },
  vishnu_purana_1:       { access: "restricted", pub: "गीता प्रेस" },
  narasimha_purana:      { access: "restricted", pub: "गीता प्रेस" },
  bhavishya_purana:      { access: "restricted", pub: "गीता प्रेस" },
  agni_purana:           { access: "restricted", pub: "गीता प्रेस" },
  ishadi_upanishad:      { access: "restricted", pub: "गीता प्रेस" },
  kathopanishad:         { access: "restricted", pub: "गीता प्रेस" },
  nitya_karm_pooja:      { access: "restricted", pub: "गीता प्रेस" },

  // Anya vyavsayik prakashak (6)
  rigveda_1:         { access: "restricted", pub: "संस्कृत साहित्य प्रकाशन" },
  atharvaveda_1:     { access: "restricted", pub: "संस्कृत साहित्य प्रकाशन" },
  yajurveda:         { access: "restricted", pub: "मोतीलाल बनारसीदास (अपुष्ट)" },
  mantra_maha_sagar: { access: "restricted", pub: "चौखम्बा कृष्णदास अकादमी" },
  ekadashi_mahatmya: { access: "restricted", pub: "गौड़ीय वेदांत प्रकाशन" },
  guru_granth_sahib: { access: "restricted", pub: "रोहित आर्ट प्रेस" },

  // Prakashak agyaat (4) — "pata nahi" ka matlab "surakshit" nahi hota.
  // Jab tak sanskaran ka srot pakka na ho, band hi rakhna sahi hai.
  samaveda:            { access: "restricted", pub: null },
  chanakya_neeti:      { access: "restricted", pub: null },
  lal_kitab:           { access: "restricted", pub: null },
  rashi_muhurt_vigyan: { access: "restricted", pub: null },
};

/** Kya is kitab ki poori PDF/paath khul sakta hai? Anjaan id = band. */
export function canReadFull(bookId) {
  return BOOK_RIGHTS[bookId]?.access === "open";
}

/** Band kitab par dikhane ke liye — { pub, url } (dono null ho sakte hain). */
export function restrictionInfo(bookId) {
  const r = BOOK_RIGHTS[bookId];
  const pub = r?.pub || null;
  return { pub, url: pub ? (PUBLISHER_LINKS[pub] || null) : null };
}

/**
 * ── FAISLA 2: DIKHANE KA KRAM (Saurabh, 2026-08-06) ──────────────────
 * Ramcharitmanas → Gita → Mahabharat → Yogvasishth → Ved → Puran →
 * Upanishad → baaki.
 *
 * `mahabharata` abhi ingest nahi hui — id yahan pehle se rakhi hai taaki
 * jud-te hi apni sahi jagah par aa jaaye, koi code badle bina.
 */
export const BOOK_ORDER = [
  "ramcharitmanas",
  "bhagavad_gita_shankar",
  "mahabharata",
  "yoga_vasishtha",
  // Yogasutra yahan — Gita/Mahabharat ke baad, Ved se pehle. Wajah: ye
  // "kaise karein" wale sawaalon ka granth hai, aur wahi sawaal sabse
  // zyada aate hain.
  "yoga_sutra",
  // Ved
  "rigveda_1", "samaveda", "yajurveda", "atharvaveda_1",
  // Puran
  "shiva_purana_1", "shiva_purana_2", "vishnu_purana_1", "garuda_purana_1",
  "narasimha_purana", "bhavishya_purana", "agni_purana",
  // Upanishad
  "ishadi_upanishad", "kathopanishad",
  // Baaki
  "guru_granth_sahib", "mantra_maha_sagar", "nitya_karm_pooja",
  "chanakya_neeti", "ekadashi_mahatmya", "lal_kitab", "rashi_muhurt_vigyan",
];

/** Kram ke liye rank. Soochi mein na ho to sabse aakhir mein. */
export function bookRank(bookId) {
  const i = BOOK_ORDER.indexOf(bookId);
  return i === -1 ? BOOK_ORDER.length + 1 : i;
}
