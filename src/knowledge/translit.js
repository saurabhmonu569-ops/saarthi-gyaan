/**
 * SAARTHI — Hinglish (Roman Hindi) → Devanagari transliteration
 * =====================================================================
 * KYUN (naapa hua, andaaza nahi — 2026-08-03 calibration):
 * Poora corpus Devanagari mein hai. Jab user Roman mein poochta hai
 * ("gussa kaise shant karein"), embedding model use na Hindi maanta hai
 * na English — score girkar shor ke barabar aa jaata hai:
 *
 *     gussa kaise shant karein      →  0.4370
 *     गुस्सा कैसे शांत करें            →  0.6595   (+0.2225)
 *     mrityu ke baad aatma...       →  0.5038
 *     मृत्यु के बाद आत्मा...           →  0.7479   (+0.2441)
 *
 * Aausat faayda +0.1490. Iske bina koi bhi relevance threshold Hinglish
 * sawaalon ke saare granth chheen lega — jabki jawab granthon mein
 * maujood hai. Aur "Ek IAS aspirant baar-baar fail ho raha hai" jaisa
 * andaz SAARTHI ke asli users ka aam tarika hai.
 *
 * DESIGN:
 *  1. Pehle se Devanagari hai? → chhoo mat.
 *  2. Aam Hindi shabdon ki dictionary (sabse zyada aane wale, aur wahi
 *     jinhe akshar-dar-akshar badalna sabse zyada bigaadta hai —
 *     "kaise" → "कैसे", naive tareeke se "कऐसे" ban jaata).
 *  3. Bache hue shabd akshar-dar-akshar (syllable) badle jaate hain.
 *
 * YEH PERFECT NAHI HAI — aur hone ki zaroorat bhi nahi. Iska kaam sirf
 * itna hai ki query embedding space mein corpus ke paas pahunch jaye.
 * "करेइन" aur "करें" ka vector kaafi paas hota hai; "karein" ka nahi.
 */

// ── 1. Aam Hindi shabd (function words + sawaal wale shabd) ───────────
// Yeh sabse zyada aate hain aur syllable-rule inhe sabse zyada bigaadta
// hai, isliye seedha map. Yahi list sabse zyada faayda deti hai.
const WORDS = {
  // ginti / aam
  ek: "एक", do: "दो", teen: "तीन", char: "चार", paanch: "पाँच",
  // sawaal
  kya: "क्या", kyu: "क्यों", kyun: "क्यों", kyon: "क्यों", kaise: "कैसे", kese: "कैसे",
  kaisa: "कैसा", kaisi: "कैसी", kab: "कब", kahan: "कहाँ", kaha: "कहाँ", kaun: "कौन",
  kon: "कौन", kitna: "कितना", kitni: "कितनी", kitne: "कितने", konsa: "कौनसा",
  // hona
  hai: "है", hain: "हैं", tha: "था", thi: "थी", the: "थे", hoga: "होगा", hogi: "होगी",
  ho: "हो", hona: "होना", hota: "होता", hoti: "होती", hote: "होते", huaa: "हुआ",
  hua: "हुआ", hui: "हुई", hue: "हुए",
  // sarvanaam
  main: "मैं", mai: "मैं", mera: "मेरा", meri: "मेरी", mere: "मेरे", mujhe: "मुझे",
  mujhko: "मुझको", hum: "हम", hamara: "हमारा", hamari: "हमारी", humein: "हमें",
  // "hme" ki wajah se ek asli bug hua tha (2026-08-04): user ne
  // "HME JAP VIDHI BATAYE" likha, "hme" kisi list mein nahi tha, Latin
  // mein reh gaya — aur us EK anjaan token ne retrieval bigaad diya.
  // Saaf "जप विधि बताइए" par nitya_karm_pooja p.69 rank-1 par rerank 0.95
  // paata hai; "HME" jud'te hi wahi panna gate se hi bahar ho gaya.
  hme: "हमें", hmein: "हमें", hume: "हमें", humey: "हमें", humko: "हमको",
  hmko: "हमको", hamein: "हमें", hamko: "हमको", mereko: "मेरे को",
  tumhe: "तुम्हें", tumko: "तुमको", aapko: "आपको", inko: "इनको", unko: "उनको",
  // aur aam jodne wale shabd jo pehle chhoot rahe the
  bare: "बारे", baare: "बारे", vishay: "विषय", kripya: "कृपया", kripaya: "कृपया",
  zara: "ज़रा", jara: "ज़रा", thoda: "थोड़ा", poora: "पूरा", pura: "पूरा",
  saral: "सरल", vistar: "विस्तार", detail: "विस्तार", short: "संक्षेप",
  aap: "आप", aapka: "आपका", aapki: "आपकी", aapke: "आपके", tum: "तुम",
  woh: "वह", wo: "वह", yeh: "यह", ye: "यह", uska: "उसका", uski: "उसकी",
  iska: "इसका", iski: "इसकी", unka: "उनका", inka: "इनका", koi: "कोई", kuch: "कुछ",
  sab: "सब", sabhi: "सभी", apna: "अपना", apni: "अपनी", apne: "अपने",
  // vibhakti
  ka: "का", ki: "की", ke: "के", ko: "को", se: "से", mein: "में", me: "में",
  par: "पर", pe: "पे", tak: "तक", liye: "लिए", ke_liye: "के लिए", saath: "साथ",
  bina: "बिना", jaisa: "जैसा", jaise: "जैसे", jaisi: "जैसी",
  // aam kriya
  kar: "कर", karo: "करो", karna: "करना", karta: "करता", karti: "करती",
  karte: "करते", karein: "करें", kare: "करे", karu: "करूँ", karun: "करूँ",
  karunga: "करूँगा", kiya: "किया", kiye: "किए", ki_gayi: "की गई",
  bata: "बता", bataye: "बताइए", bataiye: "बताइए", batao: "बताओ", batana: "बताना",
  samjhaye: "समझाइए", samjhao: "समझाओ", samjhana: "समझाना", samajh: "समझ",
  chahiye: "चाहिए", chahta: "चाहता", chahti: "चाहती", milta: "मिलता", mile: "मिले",
  raha: "रहा", rahi: "रही", rahe: "रहे", rehta: "रहता", rehna: "रहना",
  gaya: "गया", gayi: "गई", jana: "जाना", jata: "जाता", jaati: "जाती",
  dena: "देना", deta: "देता", diya: "दिया", lena: "लेना", lu: "लूँ", lun: "लूँ",
  hoke: "होके", paye: "पाए", sakta: "सकता", sakti: "सकती", sakte: "सकते",
  // aam vishesan / kriya-visheshan
  nahi: "नहीं", nahin: "नहीं", na: "ना", haan: "हाँ", han: "हाँ",
  aur: "और", ya: "या", lekin: "लेकिन", par_lekin: "लेकिन", agar: "अगर",
  toh: "तो", to: "तो", bhi: "भी", hi: "ही", phir: "फिर", fir: "फिर",
  ab: "अब", abhi: "अभी", baad: "बाद", pehle: "पहले", pahle: "पहले",
  bahut: "बहुत", bohot: "बहुत", zyada: "ज़्यादा", jyada: "ज़्यादा", kam: "कम",
  accha: "अच्छा", achha: "अच्छा", bura: "बुरा", sahi: "सही", galat: "ग़लत",
  baar: "बार", roz: "रोज़", hamesha: "हमेशा", kabhi: "कभी", sirf: "सिर्फ़",
  // aatmik / SAARTHI ke aam shabd
  bhagwan: "भगवान", ishwar: "ईश्वर", dharm: "धर्म", karm: "कर्म", karma: "कर्म",
  gyan: "ज्ञान", moksh: "मोक्ष", atma: "आत्मा", aatma: "आत्मा", mann: "मन",
  // पितृ ka fuzzyKey "pitri" banta hai par log "pitr"/"pitra" likhte hain
  pitr: "पितृ", pitra: "पितृ", pitru: "पितृ", pitar: "पितर",
  tarpan: "तर्पण", shraddh: "श्राद्ध", shradh: "श्राद्ध",
  yagya: "यज्ञ", yagna: "यज्ञ", yajna: "यज्ञ", hawan: "हवन", havan: "हवन",
  namaskar: "नमस्कार", surya: "सूर्य", arghya: "अर्घ्य",
  man: "मन", jeevan: "जीवन", jivan: "जीवन", mrityu: "मृत्यु", janm: "जन्म",
  shanti: "शांति", dhyan: "ध्यान", pooja: "पूजा", puja: "पूजा", mantra: "मंत्र",
  vrat: "व्रत", paap: "पाप", punya: "पुण्य", guru: "गुरु", shishya: "शिष्य",
  gussa: "गुस्सा", krodh: "क्रोध", darr: "डर", dar: "डर", dukh: "दुख",
  sukh: "सुख", prem: "प्रेम", pyar: "प्यार", ahankar: "अहंकार", lobh: "लोभ",
  moh: "मोह", shanti_ke: "शांति के", parivar: "परिवार", ghar: "घर",
  maa: "माँ", pita: "पिता", beta: "बेटा", beti: "बेटी", bhai: "भाई", behen: "बहन",
  shaadi: "शादी", shadi: "शादी", kaam: "काम", paisa: "पैसा", padhai: "पढ़ाई",
  pariksha: "परीक्षा", safal: "सफल", asafal: "असफल", fail: "असफल",
  vidyarthi: "विद्यार्थी", chhatra: "छात्र", jyotish: "ज्योतिष", grah: "ग्रह",
  shani: "शनि", upay: "उपाय", totka: "टोटका", shlok: "श्लोक", shloka: "श्लोक",
  granth: "ग्रंथ", ved: "वेद", puran: "पुराण", gita: "गीता", ramayan: "रामायण",

  // ── BOLCHAAL KE SHABD (2026-08-06) ────────────────────────────────────
  //
  // KYUN JODE GAYE: eval-ask.mjs mein "sacche mitra ki pehchan kya hai"
  // fail hua, jabki uska theek jawab corpus mein maujood hai —
  // "मित्र की पहचान भी विपत्ति के समय ही होती है" (चाणक्य नीति).
  // Wajah retrieval nahi thi, TRANSLIT thi: query ban rahi thi
  // "सचे मित्र की pehchan क्या है" — "pehchan" Latin mein hi reh gaya.
  //
  // Naapa gaya: 89 aam Hinglish shabdon mein se 37 (42%) Devanagari
  // ban hi nahi rahe the. Aur ye theek wahi shabd hain jinse log apni
  // PARESHANI batate hain — pareshani, dikkat, takleef, jhagda, rishta.
  //
  // Jad: LEXICON corpus se bana hai, aur corpus granth-bhasha likhta
  // hai (मित्र, शत्रु, कलह). User bolchaal likhta hai (dost, dushman,
  // jhagda). Dono kabhi mile hi nahi.
  //
  // NIYAM (naap ke tay kiya, andaaze se nahi): seedha lipyantaran hi
  // dete hain. SIRF tab granth-shabd par le jaate hain jab bolchaal ka
  // roop corpus mein lagbhag hai hi nahi (<30 hits) AUR arth bilkul
  // wahi ho. Kachcha paryayvachi (thakan→श्रम jaisa) JAAN-BOOJH KAR
  // nahi jodha — galat naksha na hone se bura hai.
  //
  // Yaad rahe: ye sirf DHOONDHNE ke liye hai (searchQ). AI ke prompt
  // mein user ka apna sawaal jaisa ka taisa jaata hai.

  // Chhoote hue function words. Ye chaar isliye reh gaye the ki inke
  // angrezi roop bhi hain ("in", "us", "no", "jo") — par sawaal Hinglish
  // ho to Hindi arth hi sahi hai. Naapa: 97 aam function words mein se
  // sirf yahi 4 Latin mein reh rahe the.
  ne: "ने", jo: "जो", us: "उस", in: "इन", inn: "इन",

  // ── 100 ASLI SAWAALON SE MILI KAMIYAN (2026-08-07) ────────────────────
  //
  // Saurabh ne 100 asli sawaal diye. Unpar chalane par 100 mein se 56
  // sawaalon mein Latin shabd bach rahe the — mera pichhla test sirf 89
  // BANAYE HUE shabdon par tha, aur usne 1% batayi thi. Asli sawaalon ne
  // 56% dikhaya. Yahi farak hai banaye hue aur asli data mein.
  //
  // Do GALAT anuvad bhi mile — ye zyada gambhir hain, kyunki inse sawaal
  // ka MATLAB badal jaata hai:
  //     "sabse bada daan"  → "sabse बाद दान"   (बाद = "after"!)
  //     "bhakti ka saar"   → "भक्ति का सारा"
  // Jad fuzzyKey ka takrav hai: "aa"→"a" aur aakhri "a" hatne se
  //     bada → bad   aur   baad → bad     (dono ek hi chaabi)
  //     saar → sar   aur   sara → sar
  // Lexicon mein jo pehle mila wahi jeet gaya. WORDS lexicon se PEHLE
  // dekha jaata hai, isliye yahan likhne se takrav khatam.
  bada: "बड़ा", badi: "बड़ी", bade: "बड़े", saar: "सार", sar: "सार",

  // Wahi takrav aur bhi jagah nikla — ye sab MATLAB badal dete the:
  //     seekha → सिख   ("Nachiketa ne kya seekha" → "…क्या सिख")
  //     maana  → मन    (माना = "samjha gaya", मन = "mind")
  //     aana   → अन्न  (anaaj)      paana → पान (paan ka patta)
  //     paar   → पर                 deen  → दिन (दीन = gareeb)
  // Ek-ek karke 52 aam shabd jaanche, jo galat the wo yahan likhe.
  maana: "माना", mana: "माना", maani: "मानी",
  aana: "आना", aaye: "आये", aaya: "आया",
  paana: "पाना", paaya: "पाया", paar: "पार",
  seekha: "सीखा", seekhna: "सीखना", sikha: "सिखा", sikhna: "सीखना",
  deen: "दीन", saab: "साहब",
  dekhna: "देखना", samajhna: "समझना", sunna: "सुनना", bolne: "बोलने",
  sochna: "सोचना", jeetna: "जीतना", haarna: "हारना", chhodna: "छोड़ना",
  chhodi: "छोड़ी", chhoda: "छोड़ा", milta: "मिलता", milti: "मिलती",

  // sabse aam — "sabse" akele 12 sawaalon mein tha
  sabse: "सबसे", kaunsa: "कौनसा", kaunsi: "कौनसी", kounsa: "कौनसा",
  asli: "असली", itna: "इतना", itni: "इतनी", doosre: "दूसरे", doosra: "दूसरा",
  dusre: "दूसरे", cheez: "चीज", cheeze: "चीजें", karni: "करनी", karna: "करना",
  pehla: "पहला", pehli: "पहली", jude: "जुड़े", judi: "जुड़ी",
  padhna: "पढ़ना", banta: "बनता", banti: "बनती", banein: "बनें",
  marti: "मरती", marta: "मरता", kehta: "कहता", kehti: "कहती",
  padta: "पड़ता", padti: "पड़ती", bolna: "बोलना", badla: "बदला",
  sikhata: "सिखाता", sikhati: "सिखाती", samjhate: "समझाते",
  bhatakne: "भटकने", pehchanein: "पहचानें", pehchane: "पहचाने",

  // vishay ke shabd
  sandesh: "संदेश", shastriya: "शास्त्रीय", prabhavi: "प्रभावी",
  prarabdh: "प्रारब्ध", vanvas: "वनवास", visheshta: "विशेषता",
  visheshtayein: "विशेषताएँ", safalta: "सफलता", niyantrit: "नियंत्रित",
  rajdharma: "राजधर्म", rajneeti: "राजनीति", aadat: "आदत", aadatein: "आदतें",
  barbaad: "बर्बाद", upyog: "उपयोग", simran: "सिमरन", parmatma: "परमात्मा",
  paramatma: "परमात्मा", adhura: "अधूरा", langar: "लंगर", zaruri: "ज़रूरी",
  zaroori: "ज़रूरी", sujhav: "सुझाव", uttar: "उत्तर", prashn: "प्रश्न",
  tattva: "तत्त्व", lakshan: "लक्षण", sarvottam: "सर्वोत्तम",
  adhyatmik: "आध्यात्मिक", parampara: "परम्परा", kamai: "कमाई",
  uchcharan: "उच्चारण", diksha: "दीक्षा", sankalp: "संकल्प",
  samanata: "समानता", varnit: "वर्णित", sweekar: "स्वीकार",
  kartavya: "कर्तव्य", dhairya: "धैर्य", tyag: "त्याग", nash: "नाश",

  // naam
  vibhishan: "विभीषण", lanka: "लंका", shabari: "शबरी", narsimha: "नृसिंह",
  narasimha: "नृसिंह", mahabharat: "महाभारत", bhagavad: "भगवद्",
  dashavatar: "दशावतार", nachiketa: "नचिकेता", maryada: "मर्यादा",
  purushottam: "पुरुषोत्तम", kaliyug: "कलियुग", brahman: "ब्रह्म",
  // NOTE: angrezi shabd (depression, leadership, practical, business,
  // confusion, discipline, support, values) JAAN-BOOJH KAR nahi jode.
  // Unka Devanagari roop corpus mein hai hi nahi ("डिप्रेशन" 0 baar),
  // aur bge-m3 bahubhashi hai — wo unhe waise hi theek samajh leta hai.

  // seedha lipyantaran — corpus mein ye roop maujood hai
  pehchan: "पहचान", pahchan: "पहचान", pehchaan: "पहचान",    // पहचान 342
  sacche: "सच्चे", saccha: "सच्चा", sachcha: "सच्चा", sachche: "सच्चे",
  jhoot: "झूठ", jhuth: "झूठ", jhooth: "झूठ",                 // झूठ 352
  kalesh: "क्लेश",                                            // क्लेश 398
  prarthna: "प्रार्थना", prarthana: "प्रार्थना",              // प्रार्थना 1,531
  jhagda: "झगड़ा", jhagra: "झगड़ा",                          // झगड़ा 73
  ladai: "लड़ाई", ladayi: "लड़ाई",                           // लड़ाई 57
  naukri: "नौकरी", nokri: "नौकरी",                           // नौकरी 148
  bachpan: "बचपन", buddhapa: "बुढ़ापा",                      // बचपन 66
  tanav: "तनाव", samasya: "समस्या", thakan: "थकान",
  bimari: "बीमारी", dawa: "दवा", aaram: "आराम", neend: "नींद",
  sasural: "ससुराल", bacche: "बच्चे", bachche: "बच्चे",
  soch: "सोच", vichar: "विचार", dil: "दिल", chinta: "चिंता",

  // bolchaal ka roop corpus mein lagbhag nahi — granth-shabd par le jao
  rishta: "संबंध", rishte: "संबंध", rishton: "संबंध",        // रिश्ता 2 → संबंध 845
  biwi: "पत्नी", patni: "पत्नी", pati: "पति",                // बीवी 12 → पत्नी 1,629
  dikkat: "बाधा", dikkate: "बाधा",                           // दिक्कत 0 → बाधा 542
  dost: "मित्र", dosti: "मित्रता", mitra: "मित्र",           // दोस्त 17 → मित्र 4,170
  dushman: "शत्रु", bairi: "शत्रु", shatru: "शत्रु",         // दुश्मन 65 → शत्रु 5,588
  dimag: "बुद्धि", dimaag: "बुद्धि",                         // दिमाग 22 → बुद्धि 5,210
  sapna: "स्वप्न", sapne: "स्वप्न",                          // सपना 17 → स्वप्न 2,541
  maafi: "क्षमा", maaf: "क्षमा", kshama: "क्षमा",            // माफी 2 → क्षमा 616
  galti: "दोष", galtiyan: "दोष",                             // गलती 18 → दोष 2,774
  khushi: "सुख", khush: "सुख",                               // खुशी 23 → सुख 9,221
  jawani: "यौवन", umar: "आयु",                               // जवानी 16 → यौवन 314
  takleef: "पीड़ा", pareshani: "कष्ट", pareshan: "कष्ट",     // तकलीफ 27 → पीड़ा 477
  mushkil: "कठिनाई", mushkilein: "कठिनाई",                   // मुश्किल 18 → कठिन 680
  ilaj: "चिकित्सा", ilaaj: "चिकित्सा",                       // इलाज 34 → चिकित्सा 308
  karobar: "व्यापार", business: "व्यापार", vyapar: "व्यापार",// कारोबार 27 → व्यापार 833
  bharosa: "विश्वास", vishwas: "विश्वास",                    // भरोसा 43 → विश्वास 572
};

// ── 1b. Corpus se bana lexicon (scripts/build-lexicon.mjs) ────────────
// 24 granthon ke 6,000 sabse aam Devanagari shabd, Roman "fuzzy key" ke
// saath. Yeh hamara "kya yeh shabd sach mein Hindi hai?" detector hai.
import LEXICON from "./lexicon.js";

/**
 * Hijje ke aam farak mita do — "kitab" aur "kitaab" ek hi key par aayein.
 * NOTE: yeh build-lexicon.mjs ke fuzzyKey se HUBAHU milna chahiye, warna
 * lookup fail ho jayega. Dono jagah saath mein badalna.
 */
function fuzzyKey(roman) {
  let s = roman.toLowerCase().replace(/[^a-z]/g, "");
  s = s.replace(/aa/g, "a").replace(/ee/g, "i").replace(/ii/g, "i")
       .replace(/oo/g, "u").replace(/uu/g, "u").replace(/ou/g, "au");
  s = s.replace(/w/g, "v");
  // SANSKRIT CONJUNCT (2026-08-04): "ज्ञ" ka asli roman "jn" hai, par Hinglish
  // mein log "gy" likhte hain — यज्ञ=yagya, ज्ञान=gyan. Isi mismatch se
  // "SURYA KE 12 NAMASKAR KIN MANTRO SE" wala sawaal fail hua tha.
  s = s.replace(/gy/g, "jn").replace(/gn/g, "jn");
  s = s.replace(/(.)\1+/g, "$1");
  // BAHUVACHAN / VIBHAKTI (2026-08-04): corpus mein "मंत्र" hai par user
  // "मंत्रों" (mantro/mantron) likhta hai. Ant ka o/on/ein hata do taaki
  // dono ek hi key par aayein.
  s = s.replace(/(?:on|ein|en)$/, "").replace(/o$/, "");
  s = s.replace(/a$/, "");
  return s;
}

// ── 2. Syllable rules — AB ISTEMAL NAHI HOTE (neeche wajah dekhein) ───
// NAAPA HUA NATEEJA (2026-08-03): har anjaan shabd ko akshar-dar-akshar
// Devanagari mein badalne se asli Hinglish sawaalon ka 89% signal wapas
// aaya — PAR kachre sawaalon ka score bhi utna hi badh gaya:
//     "OCR me error ho to AI kya kare"   0.4541 → 0.5831  (+0.1290)
//     "React useState hook kaise use..."  0.4682 → 0.5411  (+0.0728)
// Kyunki "error" → "एर्रोर" jaisi bematlab Devanagari banti hai, aur
// corpus OCR-scanned hai — usme waisa hi garbled text bhara pada hai.
// Bakwas, kachre se match kar leti hai. Separation ULTA kharab ho gaya.
//
// Isliye ab: sirf pehchane hue Hindi shabd badalte hain. Baaki (English,
// tech, naam) Latin mein hi rehte hain — Devanagari bakwas banti hi nahi.
// Yeh code sirf reference ke liye rakha hai, chalta nahi.
const CONS = [
  ["kshh", "क्ष"], ["ksh", "क्ष"], ["chh", "छ"], ["shh", "ष"], ["gy", "ज्ञ"],
  ["tr", "त्र"], ["dr", "द्र"], ["pr", "प्र"], ["kr", "क्र"], ["br", "ब्र"],
  ["shr", "श्र"], ["str", "स्त्र"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"],
  ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["zh", "झ"],
  ["k", "क"], ["g", "ग"], ["c", "च"], ["j", "ज"], ["t", "त"], ["d", "द"],
  ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"],
  ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ"],
  ["z", "ज़"], ["q", "क"], ["x", "क्स"],
];
// [roman, matra, independent]
const VOW = [
  ["aa", "ा", "आ"], ["ai", "ै", "ऐ"], ["au", "ौ", "औ"], ["ee", "ी", "ई"],
  ["ii", "ी", "ई"], ["oo", "ू", "ऊ"], ["uu", "ू", "ऊ"], ["ou", "ौ", "औ"],
  ["ri", "ृ", "ऋ"],
  ["a", "", "अ"], ["i", "ि", "इ"], ["e", "े", "ए"], ["u", "ु", "उ"], ["o", "ो", "ओ"],
];
const HALANT = "्";

function translitWord(w) {
  const s = w.toLowerCase();
  let out = "";
  let i = 0;
  let lastWasCons = false;

  while (i < s.length) {
    let matched = false;

    // consonant?
    for (const [rom, dev] of CONS) {
      if (s.startsWith(rom, i)) {
        if (lastWasCons) out += HALANT;   // do vyanjan lagatar → halant
        out += dev;
        i += rom.length;
        lastWasCons = true;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // vowel?
    for (const [rom, matra, indep] of VOW) {
      if (s.startsWith(rom, i)) {
        out += lastWasCons ? matra : indep;
        i += rom.length;
        lastWasCons = false;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    out += s[i];   // digit / punctuation / anjaan akshar
    i++;
    lastWasCons = false;
  }
  return out;
}

const DEVA_RE = /[ऀ-ॿ]/;

/**
 * Text mein Devanagari kitna hissa hai (0..1).
 *
 * BUG FIX (2026-08-03, test ne pakda): pehle numerator aur denominator do
 * ALAG cheezein gin rahe the —
 *     denominator: \p{L}      (sirf akshar)
 *     numerator:   [ऀ-ॿ]      (akshar + matra + halant, sab)
 * "नमस्ते" mein 6 Devanagari code points hain par \p{L} sirf 4 ginta hai
 * (् aur े "mark" hain, "letter" nahi) — to ratio 6/4 = 1.5 aa jaata tha.
 * Ratio 1 se upar ja hi nahi sakta.
 *
 * Ab dono taraf ek hi cheez ginte hain: akshar + matra (\p{L} + \p{M}).
 */
export function devanagariRatio(text) {
  const total = (text.match(/[\p{L}\p{M}]/gu) || []).length;
  if (!total) return 0;
  const deva = (text.match(/\p{Script=Devanagari}/gu) || []).length;
  return deva / total;
}

/**
 * Hinglish → Devanagari.
 * Pehle se Devanagari (ya mostly Devanagari) ho toh jaisa hai waisa hi.
 *
 * @param {string} text
 * @returns {string}
 */
export function toDevanagari(text) {
  if (!text || !text.trim()) return text;
  if (devanagariRatio(text) >= 0.3) return text;   // already Hindi script

  // hyphen par bhi todo — "baar-baar" do shabd hain, ek nahi
  return text.split(/(\s+|-)/).map(tok => {
    if (!tok.trim()) return tok;
    // trailing/leading punctuation alag rakho
    const m = tok.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    const [, pre, core, post] = m;
    if (!core) return tok;
    if (DEVA_RE.test(core)) return tok;                 // pehle se Devanagari

    // 1. haath se banayi list — aam function words, jinke hijje niyam se
    //    nahi chalte ("kaise", "mein", "nahi")
    const lower = core.toLowerCase();
    if (WORDS[lower]) return pre + WORDS[lower] + post;

    // 2. corpus se bana lexicon — asli granth-vocabulary
    const hit = LEXICON[fuzzyKey(core)];
    if (hit) return pre + hit + post;

    // 3. NAHI PEHCHANA → Latin mein hi chhod do.
    //    Yahan pehle syllable-transliteration hoti thi. Usi ne kachre
    //    sawaalon ka score +0.13 tak badha diya tha. Ab nahi.
    return tok;
  }).join("");
}

// Aam angrezi shabd jo galti se Hindi lexicon mein match kar jaate hain
// ("to"→तो, "use"→उसे, "me"→में, "hi"→ही). Bhasha pehchante waqt inhe
// Hindi ka saboot mat maano — warna saaf English sawaal "Hinglish" gina
// jayega.
// Hindi ke JODNE WALE shabd (vyakaran). Inme se ek bhi mila toh vaakya ka
// dhaancha Hindi ka hai — yaani Hinglish. Vishay ke shabd angrezi ho sakte
// hain ("mera job chhut gaya hai"), phir bhi vaakya Hindi hi hai.
const HI_GRAMMAR = new Set([
  // hona
  // NOTE: "the" (थे) jaanbujh ke NAHI hai — woh angrezi ka sabse aam shabd
  // hai, aur usse "What happens to the soul after death?" bhi Hinglish gina
  // jaata tha. थे ka nuksaan chhota hai, "the" ka takraav bada.
  "hai","hain","tha","thi","hoga","hogi","hota","hoti","hote","hona","hua","hui","hue",
  // sawaal
  "kya","kyu","kyun","kyon","kaise","kese","kaisa","kaisi","kab","kahan","kaha",
  "kaun","kon","kitna","kitni","kitne","konsa",
  // vibhakti
  "ka","ki","ke","ko","se","mein","par","tak","liye","wala","wali","wale","vala","vali","vale",
  // sarvanaam
  "mera","meri","mere","mujhe","mujhko","hum","hamara","hamari","humein",
  "aap","aapka","aapki","aapke","tum","tumhara","apna","apni","apne",
  "yeh","woh","uska","uski","iska","iski","unka","inka",
  // kriya
  "kar","karo","karna","karta","karti","karte","karein","kare","karu","karun",
  "raha","rahi","rahe","rehta","gaya","gayi","gaye","jata","jaati","jaate",
  "diya","dena","lena","chahiye","sakta","sakti","sakte","batao","bataye","bataiye",
  // aam
  "nahi","nahin","aur","lekin","agar","toh","bhi","phir","abhi","bahut","bohot",
  "kuch","sab","koi","jab","tab","waise","aisa","aise",
]);

// Aam angrezi shabd jo galti se Hindi lexicon mein match kar jaate hain.
// (Ab bhasha-pehchaan HI_GRAMMAR se hoti hai, par yeh list aage kaam aa
// sakti hai — isliye rakhi hai.)
const EN_STOP = new Set([
  "a","an","the","and","or","if","is","are","was","were","be","been","being",
  "to","of","in","on","at","by","for","from","with","as","it","its","this",
  "that","these","those","i","you","he","she","we","they","me","my","your",
  "do","does","did","have","has","had","can","could","will","would","should",
  "not","no","yes","so","up","us","out","get","got","see","new","one","two",
  "what","when","where","who","whom","how","why","which","all","any","some",
  "use","using","used","hi","also","than","then","there","here","about",
]);

// ── CYRILLIC SAFAI (Fix 4) ────────────────────────────────────────────
// Groq ka llama-3.3-70b kabhi-kabhi Devanagari ke beech Cyrillic akshar
// ghusa deta hai — asli mein dekha gaya:
//     "मैं आपको एक नарам सावाल पूछना चाहता हूं"   (नरम hona chahiye tha)
//     "अपनी तैयारी की стратегी को दोबारा देखना"    (रणनीति hona chahiye tha)
// Yeh token-level corruption hai (wahi jad jisse angrezi mein "by" gir
// jaata hai). Us gire hue shabd ko toh code wapas nahi la sakta, PAR
// Cyrillic akshar dikhne mein Devanagari/Latin jaise hi hote hain aur
// unka dhwani-roop wahi hai — isliye unhe wapas badla ja sakta hai:
//     н→न  а→(antarnihit)  р→र  м→म   ⇒  "нарам" → "नरम"  ✅ sahi shabd
const CYR_TO_DEV = {
  "а":"", "б":"ब", "в":"व", "г":"ग", "д":"द", "е":"े", "ж":"झ", "з":"ज",
  "и":"ि", "й":"य", "к":"क", "л":"ल", "м":"म", "н":"न", "о":"ो", "п":"प",
  "р":"र", "с":"स", "т":"त", "у":"ु", "ф":"फ", "х":"ह", "ц":"च", "ч":"च",
  "ш":"श", "щ":"श", "ы":"ी", "э":"े", "ю":"यु", "я":"या", "ъ":"", "ь":"",
};
const CYR_TO_LAT = {
  "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ж":"zh","з":"z","и":"i",
  "й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s",
  "т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sh",
  "ы":"y","э":"e","ю":"yu","я":"ya","ъ":"","ь":"",
};
const CYR_RE = /[Ѐ-ӿ]/;

/**
 * Model ke jawab se Cyrillic corruption hatao.
 * Devanagari-bahul text mein Cyrillic → Devanagari, warna → Latin.
 *
 * IMAANDARI: yeh sirf CYRILLIC ka ilaaj hai. Usi corruption ki doosri
 * shakl — angrezi mein "by"/"of" jaise shabd gir jaana — code se theek
 * NAHI ho sakti. Uske liye behtar engine hi hal hai (Gemini quota).
 *
 * @returns {{ text: string, fixed: number }}
 */
export function stripCyrillic(text) {
  if (!text || !CYR_RE.test(text)) return { text, fixed: 0 };
  const toDev = devanagariRatio(text) >= 0.3;
  const map = toDev ? CYR_TO_DEV : CYR_TO_LAT;
  let fixed = 0;
  const out = text.replace(/[Ѐ-ӿ]/g, ch => {
    const lower = ch.toLowerCase();
    if (map[lower] === undefined) return ch;
    fixed++;
    return map[lower];
  });
  return { text: out, fixed };
}

/**
 * Sawaal ki bhasha pehchano — jawab kis bhasha mein dena hai, yeh tay
 * karne ke liye.
 *
 * KYUN (2026-08-03): pehle sirf app ka Hindi/English toggle faisla karta
 * tha. User ne "मृत्यु के बाद आत्मा का क्या होता है?" poocha, toggle
 * English par tha, aur poora jawab English mein aa gaya — jo saaf galat
 * laga. Ab niyam yeh hai:
 *
 *   saaf Devanagari  → "hi"      (script jeetega, toggle chahe kuch bhi ho)
 *   saaf English     → "en"      (script jeetega)
 *   Hinglish/Roman   → "mixed"   (dhundhla case — yahan toggle faisla kare)
 *
 * Hindi shabd pehchanne ke liye wahi lexicon istemal hota hai jo
 * transliteration ke liye banaya tha — corpus se nikale 6,000 shabd.
 *
 * @returns {"hi"|"en"|"mixed"|"unknown"}
 */
export function detectQueryLanguage(text) {
  if (!text || !text.trim()) return "unknown";
  if (devanagariRatio(text) >= 0.3) return "hi";

  const words = (text.toLowerCase().match(/[a-z]+/g) || []).filter(w => w.length >= 2);
  if (!words.length) return "unknown";

  // ASLI PEHCHAAN: Hindi VYAKARAN, Hindi shabd nahi.
  //
  // Pehla tarika "kitne shabd Hindi lexicon mein hain" ginta tha — par
  // usse "Explain karma yoga to me" bhi Hinglish gina gaya, kyunki karma
  // aur yoga to Hindi shabd hain hi. Woh angrezi vaakya hai jisme sanskrit
  // ke do shabd hain.
  //
  // Hinglish ki asli nishani uske JODNE WALE shabd hain — hai, kya, kaise,
  // ka/ki/ke, mein, se, karo. Ye aate hain toh vaakya ka dhaancha Hindi ka
  // hai, chahe vishay ke shabd angrezi hon ("mera job chhut gaya hai").
  for (const w of words) if (HI_GRAMMAR.has(w)) return "mixed";
  return "en";
}

/**
 * Search ke liye query taiyaar karo. Roman ho toh Devanagari banao,
 * warna jaisa hai waisa hi.
 * @returns {{ query: string, transliterated: boolean, original: string }}
 */
/**
 * BOLCHAAL → GRANTH-BHASHA (2026-08-07)
 * =====================================================================
 * ASLI GHATNA: eval-ask mein "पति पत्नी में झगड़ा हो तो क्या करें" 30 mein
 * se akela fail hota raha — Mahabharata jodne ke BAAD bhi. Jabki jawab
 * corpus mein saaf maujood hai:
 *     "पुरुषको चाहिये कि वह कुपित होनेपर भी पत्नीके साथ कोई अप्रिय
 *      बर्ताव न करे"                                   — महाभारत
 *     "गृहस्थ पुरुष सदा अपनी ही स्त्रीसे प्रेम करे"      — महाभारत
 * 79 chunks गृहस्थ-धर्म par, 13 kalah par.
 *
 * JAD: granth "कलह/भार्या/कुपित" likhte hain, user "झगड़ा/बीवी/नाराज"
 * likhta hai. Kal maine yahi pul HINGLISH ke liye banaya tha (WORDS
 * mein), par normalizeQueryForSearch Devanagari query par turant return
 * kar deti hai — yaani Hindi mein type karne wale ko wo pul milta hi
 * nahi tha. Aur wahi hamare sabse zyada users hain.
 *
 * NAAPKAR CHUNA (5.66 crore akshar ke corpus par):
 *   niyam — bolchaal shabd <300 baar aaye AUR granth-shabd 3x se zyada
 *   Misaal:  दिक्कत 1 vs बाधा 712  |  बीवी 13 vs पत्नी 2,654
 *   Niyam ne 4 jodiyan THUKRAYIN bhi: झूठ (651 — khud hi kaafi aam),
 *   बच्चे (300), सास (938), ससुराल (श्वसुर sirf 9 — ulta hota).
 *
 * PHIR HAATH SE SAAF KIYA — kuch paryay niyam paar kar gaye the par
 * shor laate:
 *   दिमाग→मन (मन ke 96,120 hits — har query mein daalna bekaar)
 *   इज्जत→मान (65,415, aur मानव/मानस/प्रमाण ke andar bhi milta hai)
 *   पैसा→अर्थ ("arth" = "matlab" bhi hota hai, do-arthi)
 *   बुढ़ापा→जरा ("zara" = "thoda" bhi)
 *   अकेलापन→विरह (virah = bichhadna, akelapan nahi)
 *
 * ⚠️ Ye query ko BADALTA nahi, BADHATA hai — user ke shabd hamesha
 * rehte hain, sirf granth-shabd saath jud jaate hain. Isse keyword
 * search ko seedha faayda hai (wo substring par chalti hai).
 *
 * ⚠️ Aur ye RERANKER ko nahi bheja jaata — dekho ChatView.jsx. Reranker
 * ek cross-encoder hai jo SAWAAL padhkar faisla karta hai; usme paryay
 * thoons dene se sawaal anaad ban jaata aur uska faisla bigadta. Use
 * hamesha asli sawaal milta hai. Paryay sirf UMMEEDWAAR DHOONDHNE ke
 * liye hain, unhe AANKNE ke liye nahi.
 */
export const GRANTH_PARYAY = {
  // rishte aur ghar
  "झगड़ा": ["कलह", "विवाद"],      "लड़ाई": ["युद्ध", "संग्राम"],
  "बीवी": ["पत्नी", "भार्या"],     "शौहर": ["पति", "स्वामी"],
  "घरवाले": ["कुटुम्ब", "परिवार"], "रिश्ता": ["सम्बन्ध", "संबंध"],
  "दोस्त": ["मित्र", "सखा"],       "दुश्मन": ["शत्रु", "रिपु"],
  // dukh aur samasya
  "दिक्कत": ["बाधा", "विघ्न"],     "परेशानी": ["कष्ट", "क्लेश"],
  "मुश्किल": ["कठिन", "दुष्कर"],   "तकलीफ": ["पीड़ा", "व्यथा"],
  "तनाव": ["चिन्ता"],              "घबराहट": ["व्याकुल", "उद्विग्न"],
  "अकेलापन": ["एकाकी"],            "नाराज": ["कुपित", "क्रुद्ध"],
  // man aur charitra
  "दिमाग": ["बुद्धि"],             "सपना": ["स्वप्न"],
  "गलती": ["दोष", "प्रमाद"],       "माफी": ["क्षमा"],
  "खुशी": ["सुख", "आनन्द"],        "इज्जत": ["सम्मान", "प्रतिष्ठा"],
  "भरोसा": ["विश्वास", "श्रद्धा"],
  // kaam aur jeevan
  "नौकरी": ["सेवा", "वृत्ति"],     "कारोबार": ["व्यापार"],
  "पैसा": ["धन"],                  "मेहनत": ["परिश्रम", "पुरुषार्थ"],
  "इलाज": ["चिकित्सा", "औषध"],
  "बुढ़ापा": ["वृद्धावस्था"],      "जवानी": ["यौवन"],  "बचपन": ["बाल्य"],

  // ── ROOP-BHED ────────────────────────────────────────────────────────
  // Milaan substring se hota hai, isliye "दोस्तों" mein "दोस्त" apne aap
  // mil jaata hai. Par jahan shabd ka DHAANCHA badalta hai, wahan alag
  // entry chahiye — warna sabse aam sawaal chhoot jaate hain:
  //     "पैसे की परेशानी"  mein "पैसा" hai hi nahi
  //     "गलतियों की माफी"  mein "गलती" hai hi nahi (ी → ि ho jaati hai)
  "पैसे": ["धन"],        "पैसों": ["धन"],
  "रिश्ते": ["सम्बन्ध", "संबंध"],  "रिश्तों": ["सम्बन्ध", "संबंध"],
  "सपने": ["स्वप्न"],    "सपनों": ["स्वप्न"],
  "गलतियों": ["दोष", "प्रमाद"],    "गलतियाँ": ["दोष", "प्रमाद"],
  "झगड़े": ["कलह", "विवाद"],       "झगड़ों": ["कलह", "विवाद"],
  "लड़ाइयाँ": ["युद्ध"],           "नौकरियाँ": ["सेवा", "वृत्ति"],
};

/**
 * Query ke saath granth-shabd jod do (DHOONDHNE ke liye, aankne ke liye
 * nahi). Anjaan shabd waise ke waise. Ek hi paryay do baar nahi judta.
 * @param {string} text  Devanagari query
 * @returns {string}
 */
export function expandQueryWithParyay(text) {
  const s = String(text || "");
  if (!s.trim()) return s;
  const add = [];
  for (const [bol, paryay] of Object.entries(GRANTH_PARYAY)) {
    if (!s.includes(bol)) continue;
    for (const p of paryay) if (!s.includes(p) && !add.includes(p)) add.push(p);
  }
  return add.length ? `${s} ${add.join(" ")}` : s;
}

export function normalizeQueryForSearch(text) {
  const original = text;
  const ratio = devanagariRatio(text);
  if (ratio >= 0.3) return { query: text, transliterated: false, original };

  // ANGREZI KO CHHEDO MAT (2026-08-06).
  //
  // Pehle yahan sirf Devanagari-ratio dekhi jaati thi, isliye SHUDDH
  // ANGREZI sawaal bhi lipyantaran mein chala jaata tha — aur bigad
  // jaata tha:
  //     "what does the gita say about karma"
  //         → "what does थे गीता साय about कर्म"     (the→थे, say→साय)
  //     "in this life what is the purpose"
  //         → "इन this life what एेसा थे purpose"    (is→एेसा !)
  //     "my friend betrayed me"  → "my friend betrayed में"
  // "the/say/is/me/do/in" jaise shabd Hindi lexicon mein galti se match
  // kar jaate the. Angrezi bolne wale har user ki search-query aadhi
  // bakwaas ban rahi thi.
  //
  // detectQueryLanguage() ye faisla theek karta hai — 28 sawaalon par
  // jaancha (14 angrezi + 14 Hinglish): 28/28 sahi, ek bhi Hinglish
  // sawaal "en" nahi bataya gaya. Isliye "en" par lipyantaran band.
  //
  // Hinglish ("mixed") par chalta rehta hai — wahi to iska asli kaam hai.
  if (detectQueryLanguage(text) === "en") {
    return { query: text, transliterated: false, original };
  }

  const dev = toDevanagari(text);

  // NOTE (2026-08-04): yahan ek aur niyam AAZMAYA AUR HATAYA gaya —
  // "agar translit ke baad query zyadatar Devanagari ho toh bache hue
  // Latin token hata do" (soch: woh anpehchane Hindi shabd honge).
  // Naapne par ULTA nikla:
  //     "OCR me error ho to AI kya kare" → "में हो तो आई क्या करे"
  //     "mera job chhut gaya hai..."     → "मेरा छूट गया है बहुत है"
  // OCR/error/job/tension — asli vishay ke shabd hi ud gaye, aur query
  // bematlab ho gayi. Isse wahi junk-rejection tootti jo reranker ke
  // saath mehnat se banayi thi. Isliye hata diya.
  //
  // Sahi ilaaj: dictionary badhao (upar WORDS mein). Bounded aur
  // surakshit hai — anjaan shabd Latin mein rehte hain, jo theek hai.
  return { query: dev, transliterated: dev !== text, original };
}
