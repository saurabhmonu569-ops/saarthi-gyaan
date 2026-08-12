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
  // ⚠️ "maharamayan" YAHAN, "ramayan" SE PEHLE — 2026-08-12.
  // Yoga Vasishtha ka poora naam "Yoga Vasishtha MAHARAMAYANA" hai, aur
  // usme "ramayan" chhupa hai. Neeche wala "ramayan" hint pehle match kar
  // leta tha, isliye us granth ka apna poora naam use RAMCHARITMANAS par
  // bhej deta tha. 20_hint_coverage.mjs ne ye pakda.
  "maharamayan": "yoga_vasishtha", "maha ramayan": "yoga_vasishtha",
  "महारामायण": "yoga_vasishtha",
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
  // "shiva puran khand 2" (shiva, shiv nahi) pehle CHOOK jaata tha aur
  // neeche wala generic "shiv puran" use KHAND 1 par bhej deta tha —
  // yaani user khand 2 poochta tha aur khand 1 milta tha. Naapa gaya.
  "shiv puran khand 2": "shiva_purana_2", "shiva purana khand 2": "shiva_purana_2",
  "shiva puran khand 2": "shiva_purana_2", "shiv purana khand 2": "shiva_purana_2",
  "shiv puran khand2": "shiva_purana_2", "shiva puran 2": "shiva_purana_2",
  "शिव पुराण खण्ड २": "shiva_purana_2", "शिव पुराण खंड 2": "shiva_purana_2",
  "jyotirlinga": "shiva_purana_2", "ज्योतिर्लिंग": "shiva_purana_2",
  "shiv puran": "shiva_purana_1", "shiva puran": "shiva_purana_1", "शिव पुराण": "shiva_purana_1",
  "vishnu puran": "vishnu_purana_1", "विष्णु पुराण": "vishnu_purana_1",
  // ⚠️ "agni" AKELA JAAN-BOOJHKAR NAHI HAI (2026-08-11).
  // Wo pehle tha, aur naapne par ye nikla:
  //     "Rigveda me Agni ko itna important kyu mana gaya hai" → agni_purana
  // Agni Rigveda ka pehla aur sabse bada devta hai; Yajurveda ka poora
  // yajna-vidhan usi par tika hai. Us ek shabd ne charon Ved ke sawaal
  // Agni Puran par bhej diye — aur kyunki hinted granth score-gate se
  // chhoot jaata hai (HINTED_PAKKA=2), galat Aadhaar PAKKA aata tha.
  // Granth ka poora naam chahiye, tabhi hint lage.
  "agni puran": "agni_purana", "agni purana": "agni_purana",
  "अग्नि पुराण": "agni_purana", "अग्निपुराण": "agni_purana",
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
  // ⚠️ AKELA "upanishad"/"उपनिषद" HATAYA (2026-08-11).
  //
  // Upanishad 108 hain; hamare paas DO hain — Ishadi aur Katho. Generic
  // "upanishad" ko Ishadi par bhejna maanta hai ki jo bhi Upanishad ka
  // naam le, use Ishadi hi chahiye. Naapne par galat nikla:
  //     "Chandogya Upanishad me Shvetaketu ko kya sikhaya gaya"
  //         → hinted=ishadi_upanishad → 6 ansh Ishadi se
  // Shvetaketu aur "tat tvam asi" CHANDOGYA me hai, Ishadi me hai hi
  // nahi. Aur kyunki hinted granth score-gate se chhoot jaata hai
  // (HINTED_PAKKA=2), wo galat Aadhaar PAKKA aata tha.
  //
  // Ab poora naam chahiye. Bina naam wale sawaal ("Upanishad me aatma ka
  // varnan") par koi hint nahi lagega — aur wo theek hai: dono Upanishad
  // barabari se pool me aayenge, aur reranker chunega.
  "ishadi upanishad": "ishadi_upanishad", "ishaadi upanishad": "ishadi_upanishad",
  "ishavasya": "ishadi_upanishad", "ishopanishad": "ishadi_upanishad",
  "ishawasya": "ishadi_upanishad", "isha upanishad": "ishadi_upanishad",
  "ईशादि": "ishadi_upanishad", "ईशावास्य": "ishadi_upanishad", "ईशोपनिषद": "ishadi_upanishad",
  "granth sahib": "guru_granth_sahib", "gurbani": "guru_granth_sahib", "guru nanak": "guru_granth_sahib",
  "ग्रंथ साहिब": "guru_granth_sahib", "गुरबाणी": "guru_granth_sahib", "गुरु नानक": "guru_granth_sahib",
  "chanakya": "chanakya_neeti", "चाणक्य": "chanakya_neeti",
  "ekadashi": "ekadashi_mahatmya", "एकादशी": "ekadashi_mahatmya",
  // ⚠️ AKELA "upay" HATAYA (2026-08-11) — 17 aam sawaalon par naapa,
  // 7 seedhe jyotish ki kitab par chale gaye:
  //     "krodh ko jeetne ka upay kya hai"  → lal_kitab
  //     "tanav door karne ka upay"         → lal_kitab
  //     "shanti pane ka upay kya hai"      → lal_kitab
  // "उपाय" rozmarra ka Hindi shabd hai — "hal", "tareeka". Lal Kitab ke
  // apne "upay" mashhoor zaroor hain, par us naate har dukhi user ka
  // sawaal jyotish par bhej dena galat hai. Yahi wo shikayat thi jab
  // "seva aur paropkar" ka jawab jyotish ki kitab se aaya tha.
  "lal kitab": "lal_kitab", "jyotish": "lal_kitab",
  "लाल किताब": "lal_kitab", "ज्योतिष": "lal_kitab",
  "rashi": "rashi_muhurt_vigyan", "muhurt": "rashi_muhurt_vigyan", "muhurat": "rashi_muhurt_vigyan",
  "राशि": "rashi_muhurt_vigyan", "मुहूर्त": "rashi_muhurt_vigyan",
  // ── PATANJALI YOGASUTRA (2026-08-11) ────────────────────────────────
  //
  // ⚠️ Sirf granth ka NAAM yahan hai, uske paribhashik shabd NAHI.
  //
  // Pehle maine "vairagya", "samadhi", "dharana" jaise shabd bhi jode the.
  // Naapne par galat nikla: "Yoga Vasishtha me vairagya prakaran" seedha
  // yoga_sutra par chala gaya. Wajah saaf hai — ye shabd Yogasutra ke apne
  // nahi hain; Gita, Yoga Vasishtha aur Upanishad sab inhe barabar
  // istemaal karte hain. Aise saanjhe shabd ko kisi ek granth se baandhna
  // baaki teen granth ka darwaza band kar deta hai.
  //
  // Jo bache hain wo sach me sirf Yogasutra ke hain — क्लेश (5 klesh),
  // चित्तवृत्ति (sutra 1.2), अस्मिता/अभिनिवेश (klesh ke naam), अष्टाङ्ग
  // (8 ang ka dhaancha). Inka koi doosra ghar nahi hai.
  "yoga sutra": "yoga_sutra", "yogasutra": "yoga_sutra", "yog sutra": "yoga_sutra",
  "patanjali": "yoga_sutra", "patanjal": "yoga_sutra",
  "योगसूत्र": "yoga_sutra", "योग सूत्र": "yoga_sutra",
  "पतंजलि": "yoga_sutra", "पातञ्जल": "yoga_sutra",
  "klesha": "yoga_sutra", "kleshas": "yoga_sutra", "क्लेश": "yoga_sutra",
  "chittavritti": "yoga_sutra", "chitta vritti": "yoga_sutra", "चित्तवृत्ति": "yoga_sutra",
  "asmita": "yoga_sutra", "अस्मिता": "yoga_sutra",
  "abhinivesh": "yoga_sutra", "अभिनिवेश": "yoga_sutra",
  "ashtanga yoga": "yoga_sutra", "अष्टांग योग": "yoga_sutra", "अष्टाङ्ग योग": "yoga_sutra",
  // ── HIJJE KE ROOP (2026-08-12) ──────────────────────────────────────
  // 1,250 sawaalon ki naap: is granth ne 12% kiya — 50 me se 49 sawaalon
  // par hint LAGA HI NAHI, jabki granth ka naam sawaal me saaf likha tha.
  // Wajah ek akshar thi:
  //     hamara hint  "yoga vasishtha"   (t-h-a)
  //     sawaal me    "Yoga Vasishta"    (t-a)
  // Milaan seedha substring hai, isliye 'h' ka farak poora hint chook
  // gaya. Ab dono roop hain — aur "sh"/"s", "v"/"w" wale bhi, kyunki
  // Sanskrit naam Roman me likhne ke ye teen farak sabse aam hain.
  "yoga vasishtha": "yoga_vasishtha", "yoga vasishta": "yoga_vasishtha",
  "yoga vasistha": "yoga_vasishtha",  "yoga vasista": "yoga_vasishtha",
  "yog vasishtha": "yoga_vasishtha",  "yog vasishta": "yoga_vasishtha",
  "yog vashisth": "yoga_vasishtha",   "yog vashishth": "yoga_vasishtha",
  "yogavasishtha": "yoga_vasishtha",  "yogavasishta": "yoga_vasishtha",
  "yoga vashishtha": "yoga_vasishtha","yoga vashistha": "yoga_vasishtha",
  "योगवासिष्ठ": "yoga_vasishtha", "योग वासिष्ठ": "yoga_vasishtha",
  "योगवाशिष्ठ": "yoga_vasishtha", "वसिष्ठ": "yoga_vasishtha", "वासिष्ठ": "yoga_vasishtha",
  "वशिष्ठ": "yoga_vasishtha", "वैराग्य": "yoga_vasishtha",
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

  // ── AKELA "vasishtha" → Yoga Vasishtha  (2026-08-12) ────────────────
  //
  // ⚠️ YE ENTRIES RAMCHARITMANAS KE NAAM WALE HINT KE BAAD HI RAHNI
  // CHAHIYE. Vasishtha DONO granthon me hain — Ramcharitmanas me Ram ke
  // guru, aur Yoga Vasishtha me poore granth ke vaqta. Pehla match jeetta
  // hai, isliye kram hi ye tay karta hai ki kaun jeete.
  //
  // Pehle maine ye Yoga Vasishtha ke hijje ke saath UPAR rakh diye the,
  // aur naapne par "Ramcharitmanas me Vasishtha ji ka updesh" bhi
  // yoga_vasishtha par chala gaya — jabki us sawaal me granth ka naam
  // saaf likha tha. Ab kram ulta hai:
  //     naam liya hai   → wahi granth
  //     naam nahi liya  → Yoga Vasishtha (kyunki wo granth hi Vasishtha
  //                       ka poora sanvaad hai)
  "vasishtha": "yoga_vasishtha", "vasishta": "yoga_vasishtha",
  "vashishth": "yoga_vasishtha", "vashisth": "yoga_vasishtha",
  // ⚠️ AKELA "mantra"/"मंत्र" HATAYA (2026-08-11).
  // Is granth ke paas naam wala EK BHI hint nahi tha — sirf ye aam shabd.
  // "मंत्र" charon Ved ka mool shabd hai (Samaveda to hai hi mantron ka
  // gaayan), aur Guru Granth Sahib me bhi baar-baar aata hai. Nateeja:
  //     "Samaveda ke mantron ka purpose"     → mantra_maha_sagar
  //     "Atharvaveda me raksha ke mantra"    → mantra_maha_sagar
  // Ab poora naam chahiye. Wo naam pehle kahin tha hi nahi, isliye jod
  // raha hoon — warna is granth par kabhi hint lagta hi nahi.
  "mantra maha sagar": "mantra_maha_sagar", "mantra mahasagar": "mantra_maha_sagar",
  "मंत्र महासागर": "mantra_maha_sagar", "मन्त्र महासागर": "mantra_maha_sagar",

  // ── SADHANA WALE ROOP (12 Aug 2026) ─────────────────────────────────
  //
  // KYUN WAPAS: 11 Aug ko akela "mantra" hataya tha. Wo aadha sahi tha.
  // Naapa (hint_hataye set, 68 sawaal → 60 pass, 8 fail): aatho failures
  // me granth ka naam nahi tha, aur 6 seedhe mantra-SADHANA ke the —
  //     "Mantra jap me mala ke 108 beads ka significance"
  //     "Mantra sadhana me brahmacharya aur diet discipline kyu"
  //     "Kya har mantra ka jap bina guru guidance ke kiya ja sakta hai"
  // Inke liye Mantra Maha Sagar SACH ME sahi granth hai. Wahan purana
  // hint theek kaam kar raha tha; poora hatana galti thi.
  //
  // Ek hi kaant-chhaant ne do ulte kaam kiye: Ved wale sawaal bachaye,
  // sadhana wale tod diye. Isliye ab poora shabd nahi — sirf wo roop jo
  // SIRF sadhana me aate hain aur Ved ke sawaalon me kabhi nahi.
  //
  // ⚠️ KRAM: ye Ved ke naam (line ~126) ke BAAD hain, isliye
  // "Samaveda me mantra jap" par Samaveda hi jeetega. Kram badla to wo
  // toot jaayega.
  //
  // ⚠️ AKELA "nyasa" JAAN-BOOJHKAR NAHI HAI. Milaan seedha substring hai
  // (detectHintedBook neeche dekho), aur "nyasa" सं-"न्यास" ke andar bhi
  // hai. Use jodte hi Gita/Upanishad ka sanyas wala har sawaal Mantra
  // Sagar par chala jaata — bilkul wahi jaal jisme "upay" aur "agni"
  // phanse the. Isliye "mantra nyasa" poora roop hi hai.
  //
  // Isi wajah se akela "jap" bhi nahi hai ("Japan", "japna" me chhupa
  // hai) — par "jaap" hai, kyunki uska matlab hi mantra-dohraav hai.
  "mantra jap": "mantra_maha_sagar", "mantra ka jap": "mantra_maha_sagar",
  "mantr jap": "mantra_maha_sagar", "mantron ka jap": "mantra_maha_sagar",
  "mantron ki": "mantra_maha_sagar", "mantron ko": "mantra_maha_sagar",
  "मंत्रों": "mantra_maha_sagar", "मन्त्रों": "mantra_maha_sagar",
  "mantra jaap": "mantra_maha_sagar", "mantra ka jaap": "mantra_maha_sagar",
  "jaap": "mantra_maha_sagar", "japna": "mantra_maha_sagar",
  "mantra sadhana": "mantra_maha_sagar", "mantra sadhna": "mantra_maha_sagar",
  "mantra siddhi": "mantra_maha_sagar",
  "purashcharan": "mantra_maha_sagar", "purascharan": "mantra_maha_sagar",
  // ⚠️ "mantra" NAHI, "mantr" — MOOL ROOP (2026-08-12).
  // Hindi me shabd mudta hai: mantra → mantroN, mantre, mantron ka.
  // Substring milaan me "beej mantra" ka "a" hi use tod deta tha:
  //     hint    "beej mantra"
  //     sawaal  "Beej mantroN ko powerful kyun maana jata hai?"
  // "beej mantr" dono me hai, isliye mool roop rakha hai.
  "beej mantr": "mantra_maha_sagar", "bij mantr": "mantra_maha_sagar",
  "बीज मंत्र": "mantra_maha_sagar", "बीज मन्त्र": "mantra_maha_sagar",
  "kavach mantr": "mantra_maha_sagar", "mantra siddh": "mantra_maha_sagar",
  "mala jap": "mantra_maha_sagar", "mala jaap": "mantra_maha_sagar",
  "mantra viniyoga": "mantra_maha_sagar", "viniyoga": "mantra_maha_sagar",
  "mantra nyasa": "mantra_maha_sagar",
  "मंत्र जप": "mantra_maha_sagar", "मन्त्र जप": "mantra_maha_sagar",
  "मंत्र जाप": "mantra_maha_sagar", "जाप": "mantra_maha_sagar",
  "मंत्र साधना": "mantra_maha_sagar", "मन्त्र साधना": "mantra_maha_sagar",
  "पुरश्चरण": "mantra_maha_sagar",
  "माला जप": "mantra_maha_sagar", "विनियोग": "mantra_maha_sagar",
  "मंत्र न्यास": "mantra_maha_sagar",
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
