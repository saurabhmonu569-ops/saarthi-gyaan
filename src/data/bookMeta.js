/**
 * SAARTHI — Curated metadata for the uploaded books (icons, Hindi/English
 * titles, subtitles). Extracted from App.jsx (item #4 refactor, 2026-07-27)
 * because both BooksView.jsx and AudioView.jsx (Amrit lessons) need it —
 * moved to a shared data file instead of duplicating or cross-importing
 * between two view files. Pure move — no data changed.
 */

// ── SHREY / ATTRIBUTION (2026-08-03) ─────────────────────────────────────────
// `src` field har kitab ke saath uske SANSKARAN ka shrey deta hai.
//
// KYUN: mool granth (Rigveda, Gita, Puran) hazaaron saal purane hain aur
// public domain mein hain — par jo ANUVAAD, TEEKA aur SAMPADAN humne
// istemal kiya hai, woh nayi rachnaayein hain aur unke apne adhikar hain.
// Bharat ka fair dealing (Copyright Act, Sec 52) America ke "fair use"
// jaisa lachila nahi hai — woh soochibaddh hai, aur uski ek saaf shart
// yeh hai ki SOURCE KA ULLEKH ho.
//
// Isliye publisher ka naam CHHUPANA nahi, DIKHANA hamare paksh mein jaata
// hai. (Ulta karna — copyright page hata dena — Sec 65B ke tehet alag
// apradh hai aur "jaan-boojh kar kiya" ka saboot ban jaata hai.)
//
// Data src/../copyright_findings.md ki research se aaya hai. Jahan
// publisher confirm nahi ho paya, wahan "अज्ञात" likha hai — jhootha
// shrey dene se behtar hai sach mein na jaanna maan lena.
//
// ⚠️ Yeh KAANOONI SURAKSHA NAHI hai. Asli risk teen cheezon se ghatta hai:
//    (1) poori PDF baantna band karna, (2) Gita Press se likhit anumati
//    (11/24 kitaabein ek saath), (3) 3 high-risk kitaabein public-domain
//    source se badalna. Yeh attribution unke SAATH chalta hai, unki jagah
//    nahi.
export const BOOK_META = {
  bhagavad_gita_shankar: { icon:"🕉️", title:"श्रीमद्भगवद्गीता", en:"Shrimad Bhagavad Gita", sub:"शांकरभाष्य सहित — कर्म, भक्ति और ज्ञान का सार", src:"गीता प्रेस, गोरखपुर", srcEn:"Gita Press, Gorakhpur" },
  // valmiki_ramayana ki jagah (2026-08-07). Wo kitab isliye hatai gayi ki
  // uska OCR poori tarah kachra tha — 381 akshar/page (baaki ~2,000),
  // shabd-tootna 0.50 (saaf kitaabein 0.20-0.33), aur ek bhi kand ka naam
  // nahi milta tha (बालकांड 0, अयोध्या 0, लंका 0). Ramayan ka vishay ab
  // Ramcharitmanas theek se cover karti hai.
  //
  // Mahabharata isliye chuni gayi ki SAARTHI ka kaam logon ki asli
  // samasyaon ka hal dena hai, aur wahi eval mein sabse bada gap tha:
  // "पति पत्नी में झगड़ा" par poore corpus mein sirf 1 chunk milta tha.
  // Mahabharata akele mein पति 5,737 · पत्नी 1,029 · गृहस्थ 460 · कलह 119,
  // aur विदुर 1,408 (विदुर नीति) · क्षमा 1,135 · कर्तव्य 1,109.
  // Saare 18 parv maujood hain — शान्तिपर्व aur अनुशासनपर्व sabse zyada,
  // jo theek margdarshan waale hisse hain.
  mahabharata:           { icon:"⚔️", title:"महाभारत",           en:"Mahabharata",          sub:"धर्म, कर्तव्य और जीवन-संकट का सबसे गहरा ग्रंथ — विदुर नीति सहित", src:"गीता प्रेस, गोरखपुर · 6 खण्ड", srcEn:"Gita Press, Gorakhpur · 6 volumes" },
  rigveda_1:             { icon:"📜", title:"ऋग्वेद",             en:"Rigveda",              sub:"विश्व का प्राचीनतम ग्रंथ — ऋचाओं का संग्रह", src:"संस्कृत साहित्य प्रकाशन · 2015", srcEn:"Sanskrit Sahitya Prakashan · 2015" },
  samaveda:              { icon:"🎵", title:"सामवेद",             en:"Samaveda",             sub:"संगीत और साम-गान का वेद", src:"प्रकाशक अज्ञात", srcEn:"Publisher unknown" },
  yajurveda:             { icon:"🔥", title:"यजुर्वेद",            en:"Yajurveda",            sub:"यज्ञ-विधि और मंत्रों का वेद", src:"संभवतः मोतीलाल बनारसीदास · 1971 (अपुष्ट)", srcEn:"Possibly Motilal Banarsidass · 1971 (unconfirmed)" },
  atharvaveda_1:         { icon:"🌿", title:"अथर्ववेद",           en:"Atharvaveda",          sub:"जीवन, औषधि और रक्षा-मंत्रों का वेद", src:"संस्कृत साहित्य प्रकाशन · 2015", srcEn:"Sanskrit Sahitya Prakashan · 2015" },
  shiva_purana_1:        { icon:"🔱", title:"शिव पुराण — खण्ड १",  en:"Shiva Purana Khand 1", sub:"भगवान शिव की महिमा और लीलाएँ", src:"गीता प्रेस, गोरखपुर", srcEn:"Gita Press, Gorakhpur" },
  shiva_purana_2:        { icon:"🔱", title:"शिव पुराण — खण्ड २",  en:"Shiva Purana Khand 2", sub:"शिव-भक्ति, व्रत और कथाएँ", src:"गीता प्रेस, गोरखपुर", srcEn:"Gita Press, Gorakhpur" },
  garuda_purana_1:       { icon:"🦅", title:"गरुड़ पुराण",         en:"Garuda Purana",        sub:"मृत्यु, परलोक और कर्मफल का ज्ञान", src:"संक्षिप्त गरुड़पुराण · गीता प्रेस, गोरखपुर · 32वाँ पुनर्मुद्रण", srcEn:"Sankshipt Garuda Purana · Gita Press, Gorakhpur · 32nd reprint" },
  vishnu_purana_1:       { icon:"🪷", title:"विष्णु पुराण",        en:"Vishnu Purana",        sub:"सृष्टि, अवतार और भक्ति की कथाएँ", src:"गीता प्रेस, गोरखपुर (संभावित)", srcEn:"Gita Press, Gorakhpur (probable)" },
  narasimha_purana:      { icon:"🦁", title:"नृसिंह पुराण",        en:"Narasimha Purana",     sub:"भक्त प्रह्लाद और नृसिंह अवतार", src:"गीता प्रेस, गोरखपुर — 'कल्याण' विशेषांक", srcEn:"Gita Press, Gorakhpur — 'Kalyan' special" },
  bhavishya_purana:      { icon:"🔮", title:"भविष्य पुराण",        en:"Bhavishya Purana",     sub:"भविष्य-कथन, व्रत और धर्म-आचार", src:"गीता प्रेस 'कल्याण' · जनवरी 1992", srcEn:"Gita Press 'Kalyan' · January 1992" },
  agni_purana:           { icon:"🔥", title:"अग्नि पुराण",         en:"Agni Purana",          sub:"सर्व-विद्या का विश्वकोश पुराण", src:"गीता प्रेस, गोरखपुर · 16वाँ पुनर्मुद्रण", srcEn:"Gita Press, Gorakhpur · 16th reprint" },
  // ── Batch 2: 11 nayi books (07_add_books.py se) ──
  ishadi_upanishad:      { icon:"🪷", title:"ईशादि उपनिषद्",       en:"Ishadi Upanishad",     sub:"ईश, केन, कठ आदि — आत्मज्ञान के मूल स्रोत", src:"गीता प्रेस, गोरखपुर", srcEn:"Gita Press, Gorakhpur" },
  kathopanishad:         { icon:"🕯️", title:"कठोपनिषद्",           en:"Kathopanishad",        sub:"नचिकेता-यम संवाद — मृत्यु और अमरता का रहस्य", src:"गीता प्रेस, गोरखपुर · 23वाँ संस्करण", srcEn:"Gita Press, Gorakhpur · 23rd edn." },
  guru_granth_sahib:     { icon:"☬",  title:"गुरु ग्रंथ साहिब",     en:"Guru Granth Sahib",    sub:"गुरुवाणी — नाम, सेवा और सिमरन का प्रकाश", src:"हिंदी टीका: समन चेतनराय · मुद्रक: रोहित आर्ट प्रेस, दिल्ली", srcEn:"Hindi commentary: Saman Chetanray · Printer: Rohit Art Press, Delhi" },
  chanakya_neeti:        { icon:"🦉", title:"चाणक्य नीति",          en:"Chanakya Neeti",       sub:"जीवन, राजनीति और व्यवहार की अमर सूत्र-नीति", src:"संकलन: विश्वामित्र शर्मा · प्रकाशक अज्ञात", srcEn:"Compiled by Vishvamitra Sharma · Publisher unknown" },
  ekadashi_mahatmya:     { icon:"🌕", title:"एकादशी व्रत माहात्म्य", en:"Ekadashi Mahatmya",    sub:"सभी एकादशियों की कथा, विधि और फल", src:"गौड़ीय वेदांत प्रकाशन", srcEn:"Gaudiya Vedanta Publications" },
  mantra_maha_sagar:     { icon:"📿", title:"मंत्र महासागर",        en:"Mantra Maha Sagar",    sub:"मंत्रों का महाकोश — साधना और सिद्धि", src:"चौखम्बा कृष्णदास अकादमी, वाराणसी · 2017", srcEn:"Chowkhamba Krishnadas Academy, Varanasi · 2017" },
  // mantra_shakti ki jagah (2026-08-04) — wo kitab kharab nahi thi, par
  // DUPLICATE thi: mantra_maha_sagar wahi vishay kai guna zyada cover karta
  // hai (मन्त्र 652 vs 3,833 | टोटका 0 vs 92 | उपाय 11 vs 137).
  // Yoga Vasishtha advaita vedanta ka granth hai — मन, वैराग्य, मोक्ष,
  // संसार ka swaroop. Yahi wo vishay hain jinpe log SAARTHI se sabse zyada
  // poochte hain, aur inka koi samarpit granth pehle tha hi nahi.
  yoga_vasishtha:        { icon:"🪞", title:"श्रीयोगवासिष्ठ महारामायण", en:"Shri Yoga Vasishtha", sub:"वसिष्ठ-राम संवाद — मन, वैराग्य और मोक्ष का दर्शन", src:"श्रीयोगवासिष्ठ महारामायण (हिंदी अनुवाद) · 4 भाग", srcEn:"Shri Yoga Vasishtha Maharamayana (Hindi translation) · 4 parts" },
  // nitya_devta_archana ki jagah (2026-08-04) — wo kitab hatai gayi kyunki
  // uska vishay nitya_karm_pooja pehle se behtar cover karta tha, aur uska
  // OCR sabse kharab tha (56% shabd garbled; "मन्त्र" shabd 0 baar).
  // Ramcharitmanas ise isliye chuna gaya ki app pehle se iski chaupaiyan
  // quote karti thi (DAILY_WISDOMS mein 3) par corpus mein ek bhi chunk
  // nahi tha — yaani ek maujooda jhoothi citation theek ho rahi hai.
  ramcharitmanas:        { icon:"🚩", title:"श्रीरामचरितमानस",      en:"Shri Ramcharitmanas", sub:"तुलसीदास कृत — भक्ति, मर्यादा और जीवन-नीति की चौपाइयाँ", src:"गोस्वामी तुलसीदास · गीता प्रेस, गोरखपुर", srcEn:"Goswami Tulsidas · Gita Press, Gorakhpur" },
  nitya_karm_pooja:      { icon:"🛕", title:"नित्य कर्म पूजा प्रकाश", en:"Nitya Karm Pooja",     sub:"संध्या, पूजन और नित्य कर्मों का संग्रह", src:"गीता प्रेस, गोरखपुर · 62वाँ पुनर्मुद्रण", srcEn:"Gita Press, Gorakhpur · 62nd reprint" },
  lal_kitab:             { icon:"📕", title:"लाल किताब (उपाय सहित)", en:"Lal Kitab",            sub:"ज्योतिष और सरल उपायों का प्रसिद्ध ग्रंथ", src:"प्रकाशक अज्ञात", srcEn:"Publisher unknown" },
  rashi_muhurt_vigyan:   { icon:"🪐", title:"सम्पूर्ण राशि और मुहूर्त विज्ञान", en:"Rashi & Muhurt Vigyan", sub:"राशियों, ग्रहों और शुभ मुहूर्त का विज्ञान", src:"आधुनिक संकलन · प्रकाशक अज्ञात", srcEn:"Modern compilation · Publisher unknown" },
};
