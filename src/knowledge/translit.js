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
  kaisa: "कैसा", kaisi: "कैसी", kab: "कब", kahan: "कहाँ", kaun: "कौन",
  // ⚠️ `kaha: "कहाँ"` YAHAN SE HATAYA (2026-08-10).
  // Woh DOHRI chaabi thi — neeche kriya wale block mein `kaha: "कहा"`
  // (bola/said) bhi hai. JS chup-chaap AAKHRI wali rakhta hai, koi error
  // nahi deta, isliye kaam sahi chal raha tha... sirf ittefaq se.
  // Do block ka kram kabhi badla, ya koi upar wala block neeche khiska,
  // aur "Ram ne kya kaha" turant "राम ने क्या कहाँ" ban jaata — matlab hi
  // ulta. "kahan/kahaan" (where) alag chaabi hai, wo upar maujood hai.
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
  ved: "वेद", puran: "पुराण", gita: "गीता", ramayan: "रामायण",   // granth neeche

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
  // "main" par ek do-arthi maamla hai: Hindi mein "मैं" (I), angrezi
  // mein "mukhya". Upar `main: "मैं"` pehle se hai aur wahi rehne diya —
  // user "main pareshan hu" zyada likhta hai bajaye "main message" ke.
  // "Ramayan ka main message" mein arth phir bhi bach jaata hai kyunki
  // EN_CONCEPT "message" ko "संदेश" bana deta hai.

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

  // 298 sawaalon par mile do aur matlab-badalne wale takrav:
  //     shastra → शस्त्र  (hathiyaar!)  — chahiye शास्त्र (granth)
  //     kaha    → कहाँ    (kahan/where) — chahiye कहा (said)
  // "kaha gaya hai" bahut aam vaakya hai; uska matlab "kahan chala gaya"
  // ban raha tha. Inke saath kehna/kehte/kehti ke roop bhi jode.
  shastra: "शास्त्र", shastron: "शास्त्रों", shaastra: "शास्त्र",

  // Ye do angrezi shabd yahan JAAN-BOOJH KAR hain, EN_CONCEPT mein nahi.
  // Kram maayne rakhta hai: toDevanagari PEHLE chalta hai, EN_CONCEPT
  // uske BAAD. Toh lexicon inhe pehle hi bigaad deta tha aur EN_CONCEPT
  // ko mauka hi nahi milta:
  //     war   → वर      (dulha/vardaan!)  — "Kurukshetra war" barbaad
  //     atman → आत्मानं (vibhakti-roop)
  // WORDS lexicon se pehle dekha jaata hai, isliye yahan likhne se hi
  // ye theek hote hain. Baaki 6 aise shabd bhi mile par unke dono roop
  // corpus mein maujood hain (मंत्र/मन्त्र, सत्व/सत्त्व) — unhe chhoda.
  war: "युद्ध", atman: "आत्मा",
  kaha: "कहा", kahe: "कहे", kahi: "कही", kahin: "कहीं",
  kehte: "कहते", kehta: "कहता", kehti: "कहती", kehna: "कहना",
  karne: "करने", karke: "करके", karta: "करता", karti: "करती",
  hone: "होने", hoti: "होती", hone_ke: "होने के",
  jaata: "जाता", jaati: "जाती", jaate: "जाते",
  dete: "देते", deti: "देती", deta: "देता",
  lete: "लेते", leti: "लेती", leta: "लेता",
  batao: "बताओ", bataya: "बताया", batate: "बताते",
  samjhao: "समझाओ", samjhaya: "समझाया", samjha: "समझा",
  seekh: "सीख", seekhne: "सीखने", sikhe: "सीखे",

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
  barbaad: "बर्बाद", upyog: "उपयोग", parmatma: "परमात्मा",   // simran neeche
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

  // ── RAMAYAN KE NAAM (2026-08-10, user ne pakda) ────────────────────
  //
  // ASLI GHATNA: "Bharat ji jab Ram ko wapas lane van gaye to unki Ram se
  // kya baat hui?" — is sawaal ka jawab MAHABHARAT (p.4103) se aaya, aur
  // Ramcharitmanas gate tak pahuncha hi nahi (gate-paar sirf 2, best 0.526).
  //
  // Jad do shabd the:
  //     bharat → भारत   (Ram ka bhai NAHI, DESH!)
  //     van    → वां     (bilkul bekaar)
  //
  // "भारत" par sabse bada dher kahan milega? महा-भारत mein. Yaani
  // transliteration khud sawaal ko galat granth ki taraf le ja rahi thi.
  // Ye wahi kism ka bug hai jo pehle `war → वर` mein tha.
  //
  // Jaanchne par pata chala ye akela nahi tha — 38 Ramayan-shabdon mein se
  // 19 transliterate ho hi nahi rahe the (Latin mein hi jaate the, jahan
  // corpus mein unka koi match nahi):
  //   ayodhya, kaikeyi, dashrath, sugriv, kumbhkaran, chitrakoot, paduka,
  //   jatayu, kewat, meghnad, sanjeevani, setu, agnipariksha, mandodari,
  //   urmila, shatrughna, angad, panchvati, laxman (spelling)
  //
  // Ye WORDS mein hain, LEXICON mein nahi, kyunki toDevanagari() pehle
  // WORDS dekhta hai — corpus-lexicon ka fuzzyKey inhi par ya to fail
  // hota hai ya galat jagah le jaata hai.
  //
  // ⚠️ bharat = भरत ka faisla: "bharat" ka doosra matlab DESH bhi hai.
  // Par ye granth-app hai — yahan "Bharat ne Ram se kya kaha" jaise sawaal
  // "Bharat desh" se kai guna zyada aate hain. Desh wale artha ke liye
  // shastriya shabd bharatvarsh hai, jo alag se neeche joda hai.
  bharat: "भरत", bharatji: "भरत", bharatvarsh: "भारतवर्ष",
  bharatvarsha: "भारतवर्ष",
  van: "वन", vann: "वन",
  laxman: "लक्ष्मण", lakshmana: "लक्ष्मण", laxmana: "लक्ष्मण",
  shatrughna: "शत्रुघ्न", shatrughan: "शत्रुघ्न",
  dashrath: "दशरथ", dasharath: "दशरथ", dashratha: "दशरथ",
  kaikeyi: "कैकेयी", kaikai: "कैकेयी", kausalya: "कौसल्या",
  sumitra: "सुमित्रा", urmila: "उर्मिला", mandavi: "माण्डवी",
  sugriv: "सुग्रीव", sugreev: "सुग्रीव", bali: "बालि", baali: "बालि",
  angad: "अंगद", nal: "नल", neel: "नील",
  // ⚠️ HALANT MAT LAGAO. Corpus mein "जाम्बवान" hai (48 ansh), aur FTS
  // prefix-match `"जाम्बवान्"*` uss chhote roop se KABHI match nahi karega
  // — lamba shabd chhote ka prefix nahi ho sakta. Ye galti aankh se nahi
  // dikhti, sirf 0 nateeje se pata chalti hai.
  jambavan: "जाम्बवान", jambvan: "जाम्बवान", jambavant: "जाम्बवान",
  // Tulsidas Awadhi mein likhte hain — Ramcharitmanas ke 20 ansh mein
  // "जामवंत" hai, "जाम्बवान" nahi. Dono roop chahiye.
  jamvant: "जामवंत", jamavant: "जामवंत", jambvant: "जामवंत",
  jatayu: "जटायु", sampati: "सम्पाति", kewat: "केवट", kevat: "केवट",
  guh: "गुह", nishad: "निषाद",
  kumbhkaran: "कुम्भकर्ण", kumbhakarna: "कुम्भकर्ण",
  meghnad: "मेघनाद", meghnath: "मेघनाद", indrajit: "इन्द्रजित्",
  mandodari: "मन्दोदरी", surpanakha: "शूर्पणखा", shurpanakha: "शूर्पणखा",
  mareech: "मारीच", marich: "मारीच", tadka: "ताड़का", taraka: "ताड़का",
  ahalya: "अहल्या", ahilya: "अहल्या", gautam: "गौतम",
  vishwamitra: "विश्वामित्र", vasishth: "वसिष्ठ", vashishth: "वसिष्ठ",
  parshuram: "परशुराम", parashuram: "परशुराम", janak: "जनक",
  ayodhya: "अयोध्या", mithila: "मिथिला", kishkindha: "किष्किन्धा",
  chitrakoot: "चित्रकूट", panchvati: "पञ्चवटी", panchavati: "पञ्चवटी",
  dandakvan: "दण्डकवन", ashokvatika: "अशोकवाटिका",
  paduka: "पादुका", padukayen: "पादुका",
  vatika: "वाटिका", batika: "वाटिका",

  // ⚠️ anuman = हनुमान — ek soch-samajh kar liya gaya faisla.
  //
  // "anuman" ka asli matlab अनुमान (andaaza/inference) hai, aur wo Nyaya
  // ka paribhashik shabd bhi hai (pramana). Par is app par sawaal aata
  // hai "anuman ji ne Lanka me…" — yaani ye "Hanuman" ka H chhoot jaana
  // hai, aur bahut aam hai.
  //
  // Bina iske kya hota tha, naapa gaya: query ban jaati thi
  //     "अनुमान जी ने लंका में अशोक Vatika को destroy करने का निर्णय…"
  // "अनुमान" (andaaza) poori query ka matlab hi badal deta hai. Us sawaal
  // par 0 ansh mile aur model ne apni yaad se jawab de kar VALMIKI
  // RAMAYANA ka naam le liya — wo granth humne corpus se hataya hua hai.
  //
  // Andaaze wale artha ke liye "anumaan" (do a) alag rakha hai, aur
  // "pratyaksh/anumaan/shabd" jaise darshan ke sawaal usi roop mein
  // likhe jaate hain.
  anuman: "हनुमान", hanumanji: "हनुमान", hanumaan: "हनुमान",
  anumaan: "अनुमान", pratyaksh: "प्रत्यक्ष", pramana: "प्रमाण",

  // "yaad dilaya" poora toot raha tha — yaad -> यदा (jab!) aur dilaya
  // Latin mein hi. Do aam kriya, aur dono galat.
  // ── TITHI ke naam (2026-08-11) ──────────────────────────────────────
  // "Ekadashi ke vrat me Dashami aur Dwadashi ka kya relevance?" par
  // "Dashami" Latin mein hi ja raha tha. Corpus mein दशमी 53, द्वादशी 96,
  // एकादशी 99 ansh mein hai — content tha, shabd nahi pahunch raha tha.
  // Ye vrat/upvaas ke sawaalon ki reedh hain, isliye poori list.
  pratipada: "प्रतिपदा", dwitiya: "द्वितीया", tritiya: "तृतीया",
  chaturthi: "चतुर्थी", panchami: "पंचमी", shashthi: "षष्ठी",
  saptami: "सप्तमी", ashtami: "अष्टमी", navami: "नवमी",
  dashami: "दशमी", ekadashi: "एकादशी", dwadashi: "द्वादशी",
  trayodashi: "त्रयोदशी", chaturdashi: "चतुर्दशी",
  purnima: "पूर्णिमा", poornima: "पूर्णिमा", amavasya: "अमावस्या",
  paran: "पारण", parana: "पारण", vrat: "व्रत", upvas: "उपवास",
  shukla: "शुक्ल", krishna_paksh: "कृष्ण", paksh: "पक्ष",

  // ⚠️ YE WORDS MEIN HAIN, EN_CONCEPT MEIN NAHI — aur wajah kram hai.
  // toDevanagari() PEHLE chalta hai (WORDS → LEXICON), mapEnglishConcepts
  // BAAD mein. Isliye "way" ko LEXICON pehle hi pakad kar "वयो" bana
  // deta tha (bekaar shabd) aur EN_CONCEPT ka "मार्ग" kabhi laga hi nahi.
  // Naapa gaya: "Overthinking ko kaise kam kare spiritual way se?"
  //   → "चिन्ता को कैसे कम करे वयो से?"   ← "वयो" kahin nahi hai
  // WORDS LEXICON se pehle dekha jaata hai, isliye ilaaj yahan lagta hai.
  way: "मार्ग", ways: "मार्ग", path: "मार्ग",
  // "free will" DO shabd hai; alag-alag aate hain. Shastron mein iska
  // jodaa "पुरुषार्थ बनाम प्रारब्ध" hai (पुरुषार्थ 624, प्रारब्ध 348) —
  // "स्वतन्त्र इच्छा" ka seedha anuvaad us parampara ka shabd nahi hai.
  free: "पुरुषार्थ", will: "इच्छा",
  // ⚠️ "sankhya" LEXICON se "संख्या" (ginti!) ban raha tha — Gita ka
  // doosra adhyaya "सांख्ययोग" hai, ginti se koi lena-dena nahi.
  sankhya: "सांख्य", saankhya: "सांख्य", sankhyayog: "सांख्ययोग",
  books: "ग्रन्थ", book: "ग्रन्थ", granth: "ग्रन्थ",
  // 298 sawaalon ke DOOSRE daur se bache hue Latin shabd.
  // Sab corpus se chune — jahan seedha anuvaad corpus me nahi tha,
  // wahan uska nikat-shabd liya (jaise lifestyle -> आचार, 1,677 ansh;
  // "जीवनशैली" corpus me 0 baar hai).
  help: "सहायता", helps: "सहायता",          // सहायता 938
  decided: "निश्चित", decide: "निश्चय", fixed: "नियत",   // निश्चित 1,283
  improve: "उन्नति", improvement: "उन्नति", better: "श्रेष्ठ",  // उन्नति 306
  awakening: "जागरण", awaken: "जाग्रत", awake: "जाग्रत",  // जागरण 120 · जाग्रत 506
  third: "तृतीय", second: "द्वितीय", first: "प्रथम",       // तृतीय 991
  lifestyle: "आचार", habit: "आचार", routine: "नित्यकर्म",  // आचार 1,677 (जीवनशैली 0!)
  strong: "दृढ़", strength: "बल", weak: "दुर्बल",         // दृढ़ 983
  leadership: "नेतृत्व", leader: "नेता",                   // नेतृत्व 41
  energy: "शक्ति", power: "शक्ति",                        // शक्ति 5,593 — "तेज" galat lagta tha
  practice: "अभ्यास", daily: "नित्य", seeker: "साधक",
  advanced: "उन्नत", beginner: "नवीन", expert: "निपुण",
  analysis: "विवेचन", character: "चरित्र", judge: "न्यायाधीश",
  // ⚠️ Ye DOHRI chaabiyan thi — upar "granth: ग्रंथ" aur "simran: सिमरन"
  // bhi likha tha. JS chup-chaap AAKHRI rakhta hai, isliye kaam sahi chal
  // raha tha... sirf ittefaq se. Block ka kram badalte hi matlab palat
  // jaata. Corpus ne faisla diya:
  //     ग्रन्थ 455  vs  ग्रंथ 88
  //     स्मरण 1,873 vs  सिमरन 13 (sirf guru_granth_sahib mein)
  // Purani wali hata di; ab ek hi jagah hai.
  simran: "स्मरण", naam: "नाम",                            // स्मरण 1,873
  thinking: "विचार", thought: "विचार", thoughts: "विचार",

  // Do-akshar ke Hindi shabd — LEXICON inhe pehchanta hi nahi (bahut
  // chhote hain), isliye ye Latin me hi ja rahe the.
  ja: "जा", ho: "हो", le: "ले", de: "दे", kar: "कर", na: "ना",
  yaad: "याद", yad: "याद", dilaya: "दिलाया", dilana: "दिलाना",
  dilai: "दिलाई", yaadgar: "यादगार",
  sanjeevani: "संजीवनी", sanjivani: "संजीवनी",
  setu: "सेतु", ramsetu: "रामसेतु",
  agnipariksha: "अग्निपरीक्षा", vanvaas: "वनवास",
  swayamvar: "स्वयंवर", swayamvara: "स्वयंवर",
  // sarvanaam jo LEXICON se chhoot rahe the
  unki: "उनकी", unke: "उनके", unhe: "उन्हें",   // unko pehle se maujood

  // ── GITA ke paribhashik shabd (usi din, usi sawaal se) ─────────────
  // ⚠️ `sampat` aur `sampati` ALAG hain — sampati = सम्पाति (Jatayu ka
  // bhai, upar Ramayan wale block mein). Dono ek jaise dikhte hain,
  // isliye ye tippani.
  // Naapa gaya: दैवी 157 ansh (gita mein 9), आसुरी 87 (gita mein 10),
  // सम्पत्ति 769. Gita ka 16va adhyaya hi "दैवासुरसम्पद्विभागयोग" hai.
  sampat: "सम्पत्ति", sampatti: "सम्पत्ति", sampada: "सम्पदा",
  sampad: "सम्पद्", daivi: "दैवी", daiv: "दैव", asuri: "आसुरी",
  daivasur: "दैवासुर", vibhag: "विभाग", vibhaag: "विभाग",
  sthitpragya: "स्थितप्रज्ञ", nishkaam: "निष्काम",
  swadharma: "स्वधर्म", paradharma: "परधर्म",   // yagya pehle se maujood
  gunatit: "गुणातीत", kshetra: "क्षेत्र", kshetragya: "क्षेत्रज्ञ",
  vishwaroop: "विश्वरूप",   // purushottam upar "naam" block mein pehle se hai
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

  // ══ ROZ-MARRA KE SHABD JO SHASTRA KE SHABDON SE TAKRA RAHE THE ══════
  //                                                    18 Agast 2026
  // ⚠️ UPAR WALA BLOCK AUR YE BLOCK ALAG BAATEIN HAIN.
  //     upar : jaan-boojhkar PARYAY — "khushi" ko "सुख" isliye bheja
  //            jaata hai ki corpus me खुशी 23 baar hai aur सुख 9,221.
  //            Wo SAHI matlab hai, bas granth ki bhasha me.
  //     yahan: GALAT MATLAB. Ye paryay nahi, gadbad hai.
  //
  // KAISE PAKDA GAYA: control-naap me "kal ka mausam kaisa rahega" par
  // jhoothi citation aa rahi thi (mahabharata, best 0.9387). Pehle laga
  // gate ka masla hai — do baar gate badla, dono baar fail. Phir us ek
  // sawaal ka chittha khola (36_ek_sawaal.mjs):
  //
  //     findQ bana : "काल का मौसम कैसा रहेगा"
  //
  // "kal" → "काल". कल = aane wala din. काल = Samay, Mrityu, Yama —
  // Mahabharata ka sabse bhara hua vishay. Reranker galat nahi tha, usne
  // theek hi 0.9387 diya — us panne me sach me काल hai. QUERY GALAT THI.
  //
  // JAD: lexicon.js corpus se banaya gaya (build-lexicon.mjs). Granthon
  // me "कल", "शाम", "पापा" aate hi nahi, par "काल", "शम", "पाप" bhare
  // pade hain. Isliye har roz-marra ka shabd apne shastriya humshakl se
  // takra jaata hai. Ye ek SHRENI ka bug hai, ek shabd ka nahi.
  //
  // WORDS, LEXICON se PEHLE dekha jaata hai (toDevanagari me kadam 1 aur
  // 2), isliye yahan likhna hi kaafi hai — 25,000 wali generated file ko
  // haath lagane ki zarurat nahi.
  //
  // ⚠️ SABSE KHATARNAK: papa → पाप. Koi likhe "papa ki tabiyat kharab
  // hai" aur uski query me "पाप" chala jaye. Wo galti chup-chaap hoti —
  // jawab aa jaata, bas paap-punya ke panno se.
  kal: "कल", kaal: "काल",          // कल = din · काल = samay/mrityu — dono chahiye
  parso: "परसों", hafta: "सप्ताह",
  shaam: "शाम", sham: "शाम",       // शम = shanti/daman, bilkul alag shabd
  mahina: "महीना", mahine: "महीने",
  papa: "पापा", pita: "पिता",      // पाप se bachao
  gaadi: "गाड़ी", gadi: "गाड़ी",
  chhutti: "छुट्टी", chutti: "छुट्टी",
  net: "नेट", internet: "इंटरनेट", // नेता = neta, alag shabd
  // ye bas LEXICON me the hi nahi — Latin me ja rahe the
  padosi: "पड़ोसी", umeed: "उम्मीद", baarish: "बारिश",
  safar: "सफ़र", karza: "कर्ज़", karz: "कर्ज़",

  // ══ GRANTH KE APNE SHABD JO ROMAN ME LIKHE JAATE HAIN ═══════════════
  //                                                    19 Agast 2026
  // 32_khaali_kyun.mjs ne 11 aise sawaal nikale jo HAR BAAR khaali
  // lautte the. Unme bache hue Roman shabd ye the — aur ye koi angrezi
  // shabd nahi hain, ye HAMARE APNE GRANTHON KE SHABD hain jo user Roman
  // me likh deta hai:
  //
  //     "Tena tyaktena bhunjitha" ka practical meaning kya hai?
  //          findQ bana : "तेना tyaktena bhunjitha ka …"
  //     "Andham tamah" concept ko kaise samjhen?
  //          findQ bana : "Andham तमाह …"
  //
  // Ye Ishavasya Upanishad ke prasiddh mantra hain. Devanagari roop
  // corpus me maujood hai (381 ansh me in shabdon ka milna naapa gaya).
  // Par Roman roop lexicon me nahi tha, isliye query aadhi Roman rehti
  // thi aur reranker ka ank 0.0123 tak gir jaata tha.
  //
  // ⚠️ DO SHABD PEHLE SE GALAT MAP HO RAHE THE — aur wo shayad zyada bura
  // tha "na milne" se:
  //     tena → "तेना"   (sahi: तेन)
  //     tamah → "तमाह"  (sahi: तमः)
  // Ye fuzzy-match se bane the. Aadha-sahi Devanagari shabd corpus me
  // milta hi nahi, par dikhta bilkul theek hai — isliye ye galti chup-chaap
  // rehti hai.
  tena: "तेन", tyaktena: "त्यक्तेन",
  bhunjitha: "भुञ्जीथाः", bhunjithah: "भुञ्जीथाः",
  andham: "अन्धं", tamah: "तमः", tamas: "तमस्",
  sambhuti: "सम्भूति", asambhuti: "असम्भूति",
  ashvin: "अश्विन", ashvins: "अश्विनौ", ashwini: "अश्विनी",
  ishavasya: "ईशावास्य", isha: "ईश",

  // Hinglish kriya ke wo roop jo LEXICON me the hi nahi. Inhe niyam se
  // banane ki koshish 18 Agast ko AAZMAYI AUR HATAYI GAYI — 25,000 shabd
  // ki list khud adhoori hai, isliye niyam bhi adhoora rehta tha (poori
  // naap toDevanagari ke andar likhi hai). Ab sirf wahi jode ja rahe hain
  // jo naap me sach me bache the.
  kehne: "कहने", samjhen: "समझें", samajhne: "समझने", dekhne: "देखने",
  sochne: "सोचने", milne: "मिलने", rakhne: "रखने", chalne: "चलने",
};

// ── 1b. Corpus se bana lexicon (scripts/build-lexicon.mjs) ────────────
// 24 granthon ke 6,000 sabse aam Devanagari shabd, Roman "fuzzy key" ke
// saath. Yeh hamara "kya yeh shabd sach mein Hindi hai?" detector hai.
import LEXICON from "./lexicon.js";
// ⚠️ Ye list DO jagah chahiye — yahan (citation lagne hi na do) aur
// bookHints.js me (galat granth ka hint na bane). Do nakal rakhna is
// project ka sabse purana jaal hai, isliye ek hi file.
import { ANUPASTHIT_GRANTH } from "./anupasthitGranth.js";

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

    // ── AAZMAYA AUR HATAYA: kriya ka "-ne" roop niyam se banana ─────────
    //    (2026-08-18 — ye teesri cheez hai jo aaj aazma kar hatayi gayi)
    //
    // Dikha tha ki "-na" chalta hai par "-ne" nahi:
    //     kehna → कहना ✓      kehne → kehne ✗
    //     dekhna → देखना ✓    dekhne → dekhne ✗
    // par karne/hone/lene/dene chalte the. Lagta tha ek gayab NIYAM hai,
    // 25,000 alag galtiyan nahi: "agar X-na jaana-pehchana hai to X-ne
    // wahi shabd hai." Vyakaran ke hisaab se ye sahi bhi hai.
    //
    // NAAP NE MANA KAR DIYA:
    //   sirf "X+na" ki shart  → 6 kriya theek, PAR 3 angrezi shabd toote
    //                           (tone→टोने, wine→विने, vine→विने), kyunki
    //                           fuzzy match "tona/wina" jaisa kuch dhoondh
    //                           leta hai jo "ना" par khatam hota hai.
    //   "X+na" AUR "X+ta"     → sirf 2 theek (kehne, rehne), 1 abhi bhi
    //   dono ki shart           toota. dekhne/samajhne/sochne chhoot gaye
    //                           kyunki unka "-ta" roop list me hai hi nahi.
    //
    // ASLI SEEKH: kami koi gayab niyam nahi thi — LIST KHUD jagah-jagah se
    // adhoori hai (kisne kaunsa roop yaad se daala, bas utna hi chalta
    // hai). Adhoori list ke upar niyam lagane par niyam bhi utna hi adhoora
    // rehta hai, aur uske saath naya kachra bhi aata hai.
    //
    // Aur ginti bhi yahan nahi thi: 29 khaali sawaalon me "-ne" wale shabd
    // sirf ~5 baar aaye. Bache hue Roman shabd me sabse zyada ye the —
    //     house(9)  relate(5)  context(4)  explain(3)
    // — yaani ilaaj EN_CONCEPT me hai, toDevanagari ke niyam me nahi.
    //
    // Agar kabhi dobara karna ho: pehle LEXICON hi theek se banao (uski
    // apni script build-lexicon.mjs hai), niyam se paiband mat lagao.

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

  // ── 2026-08-07 ke fail sawaalon se ──────────────────────────────────
  // Ye shabd corpus mein lagbhag hain hi nahi, par unka BHAAV bharpoor
  // maujood hai. Bina pul ke ye sawaal hamesha khaali lautte the.
  //     हिसाब 58 hits      → कर्मफल/फल/यम        ("कर्मों का हिसाब")
  //     आत्मविश्वास 6      → धैर्य/बल/साहस
  //     राजयोग 44          → योग/समाधि
  //     संतुलन 20          → समता
  //     तनाव 38            → उद्वेग/क्लेश        (upar chinta bhi hai)
  //     सकारात्मक 4        → शुभ
  //     नकारात्मक ~0       → अशुभ/दोष
  "हिसाब": ["फल", "यम"],           "आत्मविश्वास": ["धैर्य", "बल", "साहस"],
  "राजयोग": ["योग", "समाधि"],      "संतुलन": ["समता"],
  "सकारात्मक": ["शुभ"],            "नकारात्मक": ["अशुभ", "दोष"],
  "एकाग्रता": ["एकाग्र", "धारणा"], "जागरूकता": ["जाग्रत", "विवेक"],
  "ऊर्जा": ["तेज", "ओज", "प्राण"], "शक्तिशाली": ["बलवान", "समर्थ"],
  // NOTE: "रहस्य" (1,114 hits) aur "आदर्श" (106) yahan JAAN-BOOJH KAR
  // nahi hain — wo khud corpus mein kaafi hain, paryay jodna sirf shor
  // badhata. Naksha mein wahi shabd aate hain jo corpus mein hain hi nahi.
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
  // 1. Devanagari bolchaal → granth-shabd
  for (const [bol, paryay] of Object.entries(GRANTH_PARYAY)) {
    if (!s.includes(bol)) continue;
    for (const p of paryay) if (!s.includes(p) && !add.includes(p)) add.push(p);
  }

  // ── 2. JYOTISH KE BHAAV — DO KITABEIN, DO BHASHAYEIN (2026-08-19) ────
  //
  // Hamare paas jyotish ki DO kitabein hain aur wo bhaav (house) ko ALAG
  // NAAM se bulati hain. Naapa gaya (ansh me kitni baar):
  //
  //                       द्वितीय  तृतीय  भाव  खाना
  //     rashi_muhurt_vigyan   229    230   189    0
  //     lal_kitab               0      0    56*  141
  //     (*aur wo 56 me se kai "समयाभाव" jaise shabd hain — house nahi)
  //
  // Yaani "द्वितीय भाव" poochhne par LAL KITAB KA CONTENT PAHUNCH SE
  // BAAHAR HAI. Uske 211 me se sirf 1-4 ansh pool me aate the, aur wo bhi
  // sanyog se — unka rerank ank 0.0005 se 0.0226 tak tha.
  //
  // ⚠️ "खाना" KO SEEDHA PARYAY BANANA BAHUT KHATARNAK HOTA. Uska doosra
  // matlab BHOJAN hai, aur wo is corpus me bhara pada hai (vrat, prasad,
  // annadaan). Har khaane-peene wale sawaal me "भाव" ghus jaata.
  // Isliye sirf GINTI KE SAATH — jahan matlab me koi shak nahi.
  //
  // ⚠️ AUR YE SIRF findQ PAR LAGTA HAI, rerankQ PAR NAHI — wahi is
  // function ka poora asool hai. Paryay UMMEEDWAAR dhoondhne ke liye hain;
  // reranker ko dena sawaal ko anaad kar deta hai (poori wajah upar).
  const BHAAV_KHAANA = {
    "प्रथम": "पहला", "द्वितीय": "दूसरा", "तृतीय": "तीसरा", "चतुर्थ": "चौथा",
    "पंचम": "पाँचवाँ", "षष्ठ": "छठा", "सप्तम": "सातवाँ", "अष्टम": "आठवाँ",
    "नवम": "नौवाँ", "दशम": "दसवाँ", "एकादश": "ग्यारहवाँ", "द्वादश": "बारहवाँ",
  };
  if (s.includes("भाव")) {
    for (const [sanskrit, aam] of Object.entries(BHAAV_KHAANA)) {
      if (!s.includes(sanskrit)) continue;
      for (const p of [`${aam} खाना`, `${aam} घर`]) if (!add.includes(p)) add.push(p);
    }
  }

  return add.length ? `${s} ${add.join(" ")}` : s;
}

/**
 * Angrezi vishay-shabd ko UNKI APNI JAGAH par Devanagari kar do.
 *
 * ⚠️ SUDHAAR (2026-08-07, dopahar): pehle ye shabd query ke AAKHIR mein
 * jode jaate the — "Jealousy को कैसे control करे? ईर्ष्या". Us soorat
 * mein query ka dhaancha angrezi hi rehta tha aur embedding par angrezi
 * token haavi rehte the. Ab badal-kar-wahin rakhte hain —
 *     "ईर्ष्या को कैसे control करे?"
 * — vaakya Hindi ka Hindi rehta hai aur shabd sahi jagah baithta hai.
 *
 * Shabd-seema (\b) zaroori hai warna "mind" ko "reminder" ke andar bhi
 * pakad leta. Bade-chhote akshar dono chalte hain (user "Ego" bhi likhta
 * hai aur "ego" bhi).
 */
export function mapEnglishConcepts(text) {
  let s = String(text || "");
  if (!s) return s;

  // ── JYOTISH: "<ginti> house" → "<ginti> भाव"  (2026-08-18) ──────────
  //
  // EN_CONCEPT me "second house" jaisi chaabi likhi thi, par wo KABHI
  // match nahi karti thi — kyunki toDevanagari() ISSE PEHLE chalta hai
  // aur "second" ko lexicon se "द्वितीय" bana chuka hota hai. Paath tab
  // "द्वितीय house" hota hai, aur ASCII chaabi us par lagti hi nahi.
  // ("fourth"–"twelfth" lexicon me nahi hain, isliye wo chaabiyan chal
  // gayi — yaani aadha kaam chup-chaap ho raha tha, aadha nahi.)
  //
  // ⚠️ YAHAN \b MAT LAGANA — shuru me nahi. JS ka \b sirf [A-Za-z0-9_]
  // ko shabd maanta hai; Devanagari uske liye shabd hai hi nahi, isliye
  // /\bद्वितीय/ kabhi match nahi karta. Yahi jaal is file me teen aur
  // jagah likha hua hai. Aakhir me "house" ASCII hai, wahan \b theek hai.
  s = s.replace(
    /(प्रथम|द्वितीय|तृतीय|चतुर्थ|पंचम|षष्ठ|सप्तम|अष्टम|नवम|दशम|एकादश|द्वादश)\s+house\b/gi,
    "$1 भाव"
  );

  for (const [en, hi] of Object.entries(EN_CONCEPT)) {
    s = s.replace(new RegExp(`\\b${en}\\b`, "gi"), hi);
  }
  return s;
}

/**
 * META-DHAANCHA HATAO (2026-08-07)
 * =====================================================================
 * ASLI GHATNA: "क्रोध को नियंत्रित करने के लिए शास्त्र क्या कहते हैं?"
 * par retrieval ne 0 ansh diye — jabki corpus mein krodh-niyantran par
 * 464 chunks hain. Aise hi "इच्छाओं को नियंत्रित…" (349 chunks) aur
 * "आत्मविश्वास बढ़ाने के लिए आध्यात्मिक ज्ञान क्या कहता है".
 *
 * JAD: "शास्त्र क्या कहते हैं" / "क्या कहता है" jaise shabd sawaal ko
 * VISHAY se hata kar KITAB par le jaate hain. Reranker ek cross-encoder
 * hai — wo poochta hai "kya ye ansh batata hai ki SHASTRA KYA KEHTE
 * HAIN". Jo ansh seedha "क्रोध को त्यागे" kehta hai, wo is ghumaav-daar
 * sawaal par pass nahi hota. Ansh maujood tha, sawaal ka dhaancha
 * raaste mein aa gaya.
 *
 * Ye SIRF dhoondhne/aankne ki query se hatte hain. AI ke prompt mein
 * user ka sawaal poora jaata hai — jawab ki bhasha nahi badalti.
 *
 * Kitab ka naam JAAN-BOOJH KAR nahi hataya: "गीता के अनुसार" mein sirf
 * "के अनुसार" jaata hai, "गीता" rehti hai — warna detectHintedBook aur
 * book-grounding dono toot jaate.
 */
const META_FRAMES = [
  /\s*(?:के|का|की)\s*अनुसार\s*/g,
  /\s*शास्त्र(?:ों)?\s*(?:में)?\s*क्या\s*(?:कहते|कहता|कहती)\s*(?:हैं|है)\s*/g,
  /\s*(?:आध्यात्मिक\s*)?ज्ञान\s*क्या\s*(?:कहता|कहती)\s*है\s*/g,
  /\s*क्या\s*(?:कहते|कहता|कहती)\s*(?:हैं|है)\s*/g,
  /\s*में\s*क्या\s*(?:बताया|कहा|लिखा)\s*गया\s*है\s*/g,
  /\s*के\s*बारे\s*में\s*/g,
  /\s*ke\s+(?:according|anusaar)\s*/gi,
];

/**
 * Angrezi ka DHAANCHA-SHOR — sirf wo shabd jo SACH MEIN khaali hain.
 *
 * ⚠️ SUDHAAR (2026-08-07, dopahar): pehli koshish mein maine "meaning",
 * "importance", "significance", "difference" ko bhi shor maan kar hata
 * diya tha. Wo GALTI thi — 298 sawaalon par chalane se dikha ki wahi
 * shabd sawaal ka matlab the, aur unhe hatane se sirf THOONTH bachta tha:
 *     "Seva ka spiritual meaning kya hai?"   → "सेवा का क्या है?"
 *     "Forgiveness ka importance kya hai?"   → "Forgiveness का क्या है?"
 * Aisi khaali query par reranker kuch bhi pass nahi karta — isliye दान
 * (21,097 baar corpus mein) par bhi 0 jawab aaya.
 *
 * Ab wo shabd HATTE nahi, EN_CONCEPT mein BADALTE hain (meaning→अर्थ,
 * importance→महत्व/माहात्म्य). Yahan sirf wahi bache hain jinka koi
 * Devanagari joda hai hi nahi aur jo query mein kuch nahi jodte.
 */
/*
 * ⚠️ WAHI GALTI DOBARA — "spiritual" YAHAN SE HATAYA (2026-08-11).
 *
 * 7 August ko upar likha gaya tha ki "meaning/importance" ko shor maanna
 * galti thi. Par usi list mein "spiritual(ly|ity)" bhi baitha raha, aur
 * wo bhi wahi galti thi. 298 sawaalon ke naap se dikha:
 *     "Kya spirituality se stress kam ho sakta hai?"
 *              → "क्या से क्लेश कम हो सकता है?"   ← vishay hi gaayab
 *     "Spiritual growth kya hoti hai?"  · "Spiritual books ka benefit?"
 * In sabpar best-rerank 0.02 se neeche tha.
 *
 * "spiritual" khaali shabd nahi hai — is app mein wahi to VISHAY hai.
 * Corpus mein आध्यात्मिक 181 aur अध्यात्म maujood hai. Ab wo EN_CONCEPT
 * mein badalta hai, hatta nahi.
 *
 * SABAK: is list mein sirf wo shabd rahne chahiye jinka koi Devanagari
 * joda HAI HI NAHI. Agar shabd ka koi arth hai, to use BADLO — hatao mat.
 */
const EN_NOISE = new RegExp(
  "\\b(?:actual(?:ly)?|real(?:ly)?|according|"
  + "view|point|simple|basic|proper|exact|complete|full)\\b",
  "gi");

/**
 * DAAYRE SE BAHAR (2026-08-10)
 * =====================================================================
 * ASLI GHATNA: 32 control sawaalon par 4 JHOOTHI citation mili —
 *     "Quran ki mukhya shiksha kya hai"        rerank 0.926
 *     "Meditation app kaunsa best hai"         rerank 0.907
 *     "Gautam Buddha ne dukh ke bare me kaha"  rerank 0.802
 *     "Ayurveda me vata pitta kapha"           rerank 0.430
 * Teen ka score 0.8 se upar tha — yaani purane 0.5 ke gate par BHI ye
 * jhoothi citation dete. Pehle ye pakde nahi gaye kyunki purane 17
 * control bahut aasan the (petrol ka rate, IPL kaun jeeta).
 *
 * JAD: reranker VISHAY milata hai, SAWAAL nahi. "Meditation app kaunsa
 * best hai" par dhyan waala ansh 0.907 paata hai — ansh dhyan ke BAARE
 * mein hai, par sawaal phone ke app ka tha. Koi bhi threshold ise nahi
 * pakad sakta, kyunki score sach mein ooncha hai.
 *
 * ILAAJ: hamare paas 24 GINE-CHUNE granth hain — Ved, Puran, Upanishad,
 * Gita, Ramcharitmanas, Mahabharat, Guru Granth Sahib, Chanakya Niti,
 * jyotish. Bas. Agar user KISI AUR parampara ya aadhunik cheez ka naam
 * leta hai, to uska jawab in granthon mein hai HI NAHI — chahe reranker
 * kitna bhi ooncha score de. Aise sawaal par citation lagana hi galat
 * hai.
 *
 * Yeh soochi SIRF citation rokti hai. AI phir bhi jawab deta hai, bas
 * "granth ke anusaar" kehkar nahi — jo bilkul sahi bartaav hai.
 *
 * ⚠️ Yahan wo naam JAAN-BOOJH KAR nahi hain jo hamare granthon mein
 * sach mein aate hain (बुद्ध/बौद्ध Puranon mein avatar ke roop mein aate
 * hain, आयुर्वेद Atharvaveda se juda hai). Ginti ki gayi: "बुद्ध" ke
 * naam par sawaal ka matlab Gautam Buddha ki shiksha hai, jo hamare
 * paas nahi — isliye wo yahan hai. Faisla shabd se nahi, SAWAAL KE
 * IRAADE se hua hai.
 */
const OUT_OF_SCOPE = [
  // anya parampara — inke apne granth hain, hamare paas nahi
  /\b(?:quran|qur'?an|koran|bible|injeel|torah|hadith|sunnah)\b/i,
  /\bgautam\s*buddha\b|\bbuddha\s*(?:ne|ki|ke|kaa?)\b|\bbuddhis[mt]\b|\bbaudh\s*dharm\b/i,
  /\bjain\s*(?:dharma?|dharm|mat|granth|agam)\b|\bmahavir\b|\btirthankar\b/i,
  /\b(?:confucius|socrates|plato|aristotle|nietzsche|freud|jung)\b/i,
  /\b(?:christian|islam|muslim|sikh\s*history|zoroastrian|taoism|tao\s*te)\b/i,
  // aadhunik vidhaayein — hamare granthon ka vishay nahi
  /\b(?:tarot|numerolog|reiki|feng\s*shui|crystal\s*healing|astral|aura\s*read)/i,
  /\bayurved/i,
  // aadhunik gurus / sanstha
  /\b(?:sadhguru|isha\s*foundation|osho|rajneesh|art\s*of\s*living|brahma\s*kumari)/i,

  // ── AISE GRANTH JINKA HAMARE PAAS KOI JAWAB NAHI (2026-08-11) ───────
  //
  // 78 aise sawaal naape gaye jinme aisi kitab ka naam tha jo hamare paas
  // nahi hai. 44 par koi na koi Aadhaar jud gaya — yaani JHOOTHI citation.
  // Do kism nikli:
  //
  //   A) content hamare paas HAI, bas kitab ka naam alag tha —
  //      "Bhagavatam me Govardhan"  → विष्णु पुराण (wahan hai HI)
  //      "Mantra Shakti me mantra siddhi" → मन्त्र महासागर
  //      Ye poori tarah galat nahi. Inka ilaaj rokna NAHI, balki jawab
  //      mein saaf kehna hai ki maanga hua granth hamare paas nahi.
  //      (Wo prompt ka kaam hai, yahan ka nahi.)
  //
  //   B) content hamare paas HAI HI NAHI —
  //      "Majjhima Nikaya me Buddha ki teaching" → ईशादि उपनिषद्
  //      "Chandogya Upanishad me Shvetaketu"     → ईशादि उपनिषद्
  //      "Avidya ko Patanjali kyu mante hain"    → महाभारत
  //      Yahan koi bhi citation poori tarah jhoothi hai.
  //
  // Ye list SIRF (B) ke liye hai — anya paramparaon ke wo granth jinka
  // hamare 24 se koi overlap nahi. (A) wale jaan-boojhkar bahar rakhe
  // hain, kyunki unhe rokne se asli jawab bhi ruk jaata.
  /\b(?:dhammapada|majjhima\s*nikaya|digha\s*nikaya|tripitaka|sutta)\b/i,
  /\blotus\s*sutra\b|\bbodhisattva\b/i,
  /\b(?:tattvartha|acharanga)\s*sutra\b/i,
  /\btao\s*te\s*ching\b|\bwu\s*wei\b|\banalects\b|\bconfucius\b/i,
  /\bmarcus\s*aurelius\b|\bmeditations\s+(?:me|mein|book)\b/i,
  /\balmustafa\b|\bimitation\s*of\s*christ\b/i,
  /\bdasam\s*granth\b/i,
  // Upanishad jo hamare paas nahi — hamare paas sirf ईशादि aur कठ hain.
  // Inhe rokna zaroori hai kyunki generic "upanishad" hint inhe ईशादि par
  // bhej deta tha, aur wo GALAT granth hai.
  /\b(?:chandogya|brihadaranyaka|mandukya|taittiriya|aitareya|mundaka)\b/i,
  // "prashna"/"kena" akele MAT likhna — "प्रश्न" Sanskrit ka aam shabd hai
  // aur "Yaksha Prashna" (Mahabharata ka prasang) usme fans jaata tha.
  /\b(?:prashna|kena)\s*upanishad\b/i,
  /\bshvetaketu\b|\byajnavalkya\b|\bmaitreyi\b/i,
  // takneek / utpaad — sawaal granth ka nahi, bazaar ka hai
  /\b(?:app|application|website|online|download|youtube|google|whatsapp|instagram)\b/i,
  /\b(?:weight\s*loss|gym|diet\s*plan|calorie|fitness)\b/i,

  // ── KHUD SAARTHI KE BAARE MEIN SAWAAL (2026-08-11) ──────────────────
  // "SAARTHI GYAAN AI ek spiritual guide ki tarah meri daily life mein
  // kaise help kar sakta hai?" — ye sawaal APP ke baare mein hai, kisi
  // granth ke baare mein nahi. Iska jawab hamari kitaabon mein hai hi
  // nahi, isliye ispar koi bhi citation JHOOTHI citation hai.
  //
  // Pehle ye chup-chaap bach jaata tha kyunki uska score gate se neeche
  // rehta tha — yaani hum sahi jagah nahi, ITTEFAQ se bache hue the.
  // Jaise hi questionToTopic ne sawaal ko vishay-vaakya banaya, uska
  // score 0.4905 ho gaya aur Yoga Vasishtha cite ho gayi. Jhoothi
  // citation 0 se 1 par pahunch gayi.
  //
  // Sabak: "score kam hai" suraksha nahi hai. Jo sawaal daayre se bahar
  // hai, use NAAM SE rokna chahiye — score ke bharose nahi chhodna.
  /\b(?:saarthi|सारथी)\b/i,
  /\b(?:ye|yeh|is|this)\s*(?:ai|app|chatbot|bot|tool|platform)\b/i,
  /\b(?:chatgpt|gemini|claude|openai|artificial\s*intelligence)\b/i,

  // ── DUNIYAVI SAWAAL — MAUSAM, BHAAV, GADGET, SAFAR (2026-08-18) ──────
  //
  // ASLI GHATNA: control-naap me "kal ka mausam kaisa rahega" par jhoothi
  // citation aa rahi thi. Do baar gate badla gaya — dono baar fail, kyunki
  // gate ka masla tha hi nahi. Phir chittha khola (36_ek_sawaal.mjs) aur
  // do alag-alag bug nikle, ek ke peeche doosra:
  //
  //   1. "kal" → "काल" ban raha tha (upar WORDS me theek kiya). कल = din,
  //      काल = Samay/Mrityu — Mahabharata ka sabse bhara vishay.
  //
  //   2. Theek karne par BHI 0.9748 aaya. Jo panne aaye wo YUGANTKAAL ke
  //      the — pralaya, Kali-yug ka ant, Kalki avatar:
  //          "युगान्तकालमे संसारकी यही दशा होगी"
  //          "एक महान्‌ शक्तिशाली बालक प्रकट होगा"
  //      Sawaal tha "kal ka mausam KAISA RAHEGA" — bhavishya ke baare me.
  //      Wo panne bhi bhavishya ka varnan hain. Cross-encoder ne VAAKYA KA
  //      ROOP milaya, vishay nahi.
  //
  // ⚠️ ISE KOI THRESHOLD NAHI ROK SAKTA — 0.97 asli lagta hai. Yahi baat
  // upar (line ~1144) SAARTHI wale niyam me pehle se likhi hai:
  //     "score kam hai" suraksha nahi hai. Jo sawaal daayre se bahar hai,
  //     use NAAM SE rokna chahiye — score ke bharose nahi chhodna.
  // Wahan wo sabak SAARTHI par laga tha; ye usi sabak ka agla hissa hai.
  //
  // ⚠️ ASLI KHATRA IN NIYAMON ME ULTA HAI — koi SAHI sawaal galti se block
  // ho jaye. Isliye jodne se pehle naapa gaya: hindi_100 + hinglish_100 +
  // hinglish_300 + naye_granth + yogasutra_11 + hint_hataye + naye_design
  // = 1,012 in-corpus sawaal. Inme se GALTI SE BAHAR gine gaye: 0.
  // Control ke 13 aur sawaal pakde gaye.
  //
  // ⚠️ JO JAAN-BOOJHKAR NAHI LIKHA: "भाव" (bhakti-bhaav, aur jyotish ka
  // bhaav), "मूल्य" (jeevan ka mulya), "सोना" (nींद), "gate" (Vastu wala
  // sawaal Agni Purana me sach me hai). Ye shabd dono taraf chalte hain,
  // isliye inhe naam se rokna sahi sawaal maar dega.
  /\b(?:mausam|weather|temperature|forecast)\b|मौसम/i,
  /\b(?:petrol|diesel|bitcoin|dollar|rupee\s*rate|gst|emi|ipl|cricket)\b/i,
  /बिटकॉइन|डॉलर|पेट्रोल|डीज़ल|डीजल/i,
  /\b(?:iphone|android|laptop|router|wifi|wi-fi|battery|charger|smartphone)\b/i,
  /वाई-?फ़?ाई|राउटर|बैटरी|मोबाइल\s*फ़?ोन/i,
  /\b(?:python|javascript|java|sql|for\s*loop|code|coding|api)\b/i,
  /\b(?:flight|train|bus|ticket|time\s*table|timetable|booking)\b/i,
  /फ्लाइट|ट्रेन|टिकट|बुकिंग/i,
  /\b(?:price|rate|kitne\s*ka|kitne\s*ki|kimat|cost)\b/i,
  /\b(?:nearest|nearby|hospital)\b/i,
  /\b(?:car|bike|scooter)\b/i,

  // ── JO GRANTH HAMARE PAAS HAIN HI NAHI (2026-08-19) ─────────────────
  // Poori list aur uski wajah: anupasthitGranth.js
  //
  // ⚠️ YE UPAR WALI BAATON SE ALAG ROG HAI. Upar wale sawaal (mausam,
  // petrol, iPhone) ka VISHAY hi hamare corpus me nahi hai. Yahan vishay
  // hamare paas HAI, par granth nahi:
  //     "अष्टावक्र गीता में विदेह मुक्ति क्या है"
  //     → Yoga Vasishtha ka videha-mukti wala ansh, rerank 0.9965
  // विदेह मुक्ति sach me hamare granthon me hai. Reranker galat nahi.
  // Galti ATTRIBUTION ki hai — user ne poochha ki FALAN granth kya kehta
  // hai, aur hum doosre granth ka naam laga rahe hain.
  //
  // Naapa (control_kathin, 20 sawaal): pehle 17/20 jhoothi citation,
  // best 0.84 se 0.9992 tak. Koi bhi threshold ise nahi rok sakta tha.
  ...ANUPASTHIT_GRANTH,
];

/**
 * Kya ye sawaal hamare 24 granthon ke daayre se bahar hai?
 * `true` = citation mat lagao (jawab phir bhi do, bas granth ka naam na lo).
 */
/**
 * CHHOOT — ye sawaal DAAYRE ME hain, chahe upar ka koi niyam match kare.
 *
 * Dono asli naap se aaye:
 *   "Mahabharata me Yaksha Prashna episode kya hai?"
 *        → "prashna" wala niyam pakad leta tha (Prashna Upanishad samajh
 *          kar), jabki "प्रश्न" Sanskrit ka aam shabd hai aur ye prasang
 *          Mahabharata ka hai — hamari sabse badi kitab.
 *   "Agni Puran me Ayurveda se related kya material milta hai?"
 *        → "ayurved" wala niyam pakadta tha. Par Agni Puran me SACH MEIN
 *          Ayurveda ka hissa hai, aur wo hamari kitab hai.
 *
 * Yahan sirf wo mamle likhne hain jahan HAMARI kitab ka naam saath mein
 * ho — warna ye list ek pichhla darwaza ban jaayegi.
 */
const CHHOOT = [
  /yaksha\s*prashna/i,
  /agni\s*pura?na?\b.{0,40}ayurved/i,
];

export function isOutOfScope(text) {
  const s = String(text || "");
  if (CHHOOT.some(re => re.test(s))) return false;
  return OUT_OF_SCOPE.some(re => re.test(s));
}

export function stripMetaFraming(text) {
  let s = String(text || "");
  for (const re of META_FRAMES) s = s.replace(re, " ");
  s = s.replace(EN_NOISE, " ");
  s = mapEnglishConcepts(s);   // angrezi vishay-shabd → Devanagari, wahin par
  // meta hatne ke baad akela bacha "?" ya "," saaf karo
  s = s.replace(/\s+([?,.])/g, "$1").replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s?,.]+|[\s,.]+$/g, "");
  return s || String(text || "");
}

/**
 * PRASHN ko VISHAY-VAAKYA banao — sirf RERANKER ke liye (2026-08-11)
 * =====================================================================
 * YE AB TAK KA SABSE BADA EK BADLAV HAI. Naap (ek hi granth, ek hi ansh,
 * sirf sawaal ki shakl badli):
 *
 *     "चेतना क्या होती है?"                sabse ooncha  0.0023
 *     "चेतना"                              sabse ooncha  0.1813
 *     "चेतना का स्वरूप और उसका वर्णन"      sabse ooncha  0.6831
 *
 * TEEN SAU GUNA ka farak — na kitab badli, na ansh, na koi setting.
 *
 * KYUN: cross-encoder ka sawaal hota hai "kya ye ansh IS PRASHN KA UTTAR
 * deta hai?" Granth prashn-uttar ki shaili mein likhe hi nahi gaye. Wo
 * vishay ka VARNAN karte hain — "चेतना सर्वत्र व्याप्त है…", "अहंकार ही
 * बन्धन का मूल है…". Aise ansh ke saamne "क्या होती है?" rakho to model
 * ko koi uttar-dhaancha dikhta hi nahi, aur wo lagbhag shoonya deta hai.
 * Wahi ansh vishay-vaakya ke saamne khul jaata hai.
 *
 * ⚠️ SIRF rerankQ PAR — findQ par NAHI.
 * findQ FTS aur Vectorize ko jaati hai. Wahan "क्या/कैसे" stopword hain,
 * koi nuksaan nahi karte, aur wahan asli sawaal ke shabd rehne se hi
 * pool banta hai. Isliye ye badlaav sirf aankne wali query par lagta hai.
 *
 * ⚠️ JO PEHLE SE PRASHN NAHI HAI, USE CHHOOTA NAHI. Har niyam ka apna
 * saaf dhaancha hai; mel na khaye to query jyon ki tyon lautti hai. 298
 * sawaalon mein 281 pehle se paas ho rahe the — unhe bigadna sabse bada
 * khatra tha, isliye har niyam sirf VAAKYA KE ANT par lagta hai.
 */
// Wo sanjnaayein jo KHUD hi vishay bata deti hain. Inke aage kuch jodna
// nahi hai — "दान का महत्व क्या है" ka jawab "दान का महत्व" hai, na ki
// "दान का महत्व का स्वरूप और वर्णन" (pehli koshish mein yahi ban raha tha).
const VISHAY_SANJNA = "महत्व|माहात्म्य|अर्थ|लाभ|भेद|अन्तर|कारण|फल|स्वरूप|उपाय|विधि|प्रभाव|रहस्य|वर्णन|प्रक्रिया|भूमिका|सम्बन्ध|प्रकार|गुण|लक्षण|नियम|कर्तव्य|शिक्षा|सन्देश|उद्देश्य";

const PRASHN_NIYAM = [
  // 1. "X का महत्व क्या है"  →  "X का महत्व"   (sirf prashn hatao)
  [new RegExp(`^(.{2,}?\\s*(?:का|की|के)\\s*(?:\\S+\\s+)?(?:${VISHAY_SANJNA}))\\s*क्या\\s*(?:है|हैं|होता\\s*है|होती\\s*है)\\s*\\??$`),
   "$1"],

  // 2. "X में क्या भेद है"  →  "X का भेद"   (shabd-kram ulta hota hai)
  [new RegExp(`^(.{2,}?)\\s*(?:में|मे)?\\s*क्या\\s*(${VISHAY_SANJNA})\\s*(?:है|हैं)\\s*\\??$`),
   "$1 का $2"],

  // 3. "X क्या है / क्या होती है"  →  "X का स्वरूप और वर्णन"
  //    ⚠️ SIRF CHHOTE VISHAY PAR (4 shabd tak). "मृत्यु के बाद आत्मा का
  //    क्या होता है" jaise lambe, khaas sawaal PEHLE SE paas ho rahe hain
  //    — unhe chhoona sabse bada khatra tha. 4 ya zyada shabd = chhodo.
  //    (Pehle {0,3} tha aur "मृत्यु के बाद आत्मा का क्या होता है" pakda
  //     ja raha tha — wahi sawaal jo pehle se theek chal raha hai.)
  [/^([^\s?]+(?:\s+[^\s?]+){0,2})\s*क्या\s*(?:है|हैं|होता\s*है|होती\s*है|होते\s*हैं)\s*\??$/,
   "$1 का स्वरूप और वर्णन"],

  // 4. "X कैसे करे / छोड़े / रोके"  →  "X का उपाय और विधि"
  // ⚠️ Beech me koi shabd AANE MAT DO ((?:\S+\s+)? mat lagao).
  // Naapa gaya: usse "गुस्सा कैसे शांत करें" → "गुस्सा का उपाय और विधि"
  // ban gaya — "शांत" hi gaayab. Wo sawaal PEHLE SE paas ho raha tha.
  // Aur "…जीवन में कैसे लागू करें" → "…जीवन में का उपाय" — toota vaakya.
  // Sirf seedhe "X कैसे करे/छोड़े" par lagta hai; baaki jyon ke tyon.
  [/^(.{2,}?)\s*कैसे\s*(?:करे|करें|छोड़े|छोड़ें|त्यागें|रोके|रोकें|बचें|पाएं|पायें|करना\s*चाहिए|कर\s*सकते\s*हैं|किया\s*जा\s*सकता\s*है)\s*\??$/,
   "$1 का उपाय और विधि"],

  // 5. "X कैसे होता है"  →  "X की प्रक्रिया"
  [/^(.{2,}?)\s*कैसे\s*(?:होता\s*है|होती\s*है|होते\s*हैं)\s*\??$/,
   "$1 की प्रक्रिया और वर्णन"],

  // 6. "X क्यों होता है / क्यों कहा जाता है"  →  "X का कारण"
  [/^(.{2,}?)\s*क्यों\s*(?:है|हैं|होता\s*है|होती\s*है|कहा\s*(?:जाता|गया)\s*है|माना\s*(?:जाता|गया)\s*है|समझा\s*(?:जाता|गया)\s*है|लेते\s*हैं|हुआ\s*था|बनता\s*है|पड़ता\s*है)\s*\??$/,
   "$1 का कारण"],

  // 7. "क्या X ... है?"  — haan/naa wala prashn; shuru ka "क्या" bekaar hai.
  //    Ant ke "होता/होती/सकता" jaise sahayak kriya bhi hata dete hain.
  [/^क्या\s+(.{2,}?)\s*(?:होता|होती|होते)?\s*(?:है|हैं|हो\s*सकता\s*है|हो\s*सकती\s*है|सकते\s*हैं|जा\s*सकता\s*है|सकता\s*है|सकती\s*है)\s*\??$/,
   "$1"],
];

export function questionToTopic(text) {
  const s = String(text || "").trim();
  if (!s) return s;

  // JODA HUA SAWAAL CHHODO — par sahi tareeke se pehchano.
  //
  // "कृतज्ञता क्या होता है और इसका लाभ क्या है?" — ismein DO sawaal hain.
  // Koi bhi ek niyam lagane se aadha vaakya bigadta hai (pehli koshish
  // mein "…और इसका लाभ का स्वरूप और वर्णन" ban raha tha).
  //
  // ⚠️ PEHLI JAANCH GALAT THI: maine "और" dekh kar hi chhod diya tha —
  //     /\sऔर\s.*(?:क्या|कैसे|क्यों)/
  // Us niyam ne "सेवा और परोपकार को धर्म क्यों माना गया है?" ko bhi joda
  // hua sawaal maan liya. Par wo EK hi sawaal hai; "सेवा और परोपकार" bas
  // ek joda hua NAAM hai. Nateeja: us sawaal par sudhaar laga hi nahi
  // aur jawab "सम्पूर्ण राशि और मुहूर्त विज्ञान" se juda — ek jyotish ki
  // kitab, seva-paropkar ke sawaal par.
  //
  // Asli pehchan "और" nahi, PRASHN-SHABDON KI GINTI hai. Do ya zyada
  // (क्या/कैसे/क्यों) = do sawaal. Ek = ek sawaal, chahe usme kitne bhi
  // "और" ho.
  // ⚠️ YAHAN \b MAT LAGANA. JS ka \b sirf [A-Za-z0-9_] ko shabd maanta
  // hai; Devanagari uske liye shabd hai hi nahi. Isliye /\bक्या\b/ KABHI
  // match nahi karta — naapa gaya:
  //     /\bक्या\b/.test("कृतज्ञता क्या होता है")  →  false
  //     /क्या/.test("कृतज्ञता क्या होता है")        →  true
  // Pehle yahan \b tha, isliye ginti hamesha 0 aati thi aur joda hua
  // sawaal bhi chhan jaata tha — yaani pehra tha hi nahi.
  const prashnShabd = (s.match(/क्या|कैसे|क्यों|कौन\b|कब\b|कहाँ/g) || []).length;
  if (prashnShabd >= 2) return s;

  for (const [re, rep] of PRASHN_NIYAM) {
    const out = s.replace(re, rep).replace(/\s+/g, " ").trim();
    if (out !== s && out.replace(/[\s?,.]/g, "").length >= 2) return out;
  }
  return s;
}

/**
 * Angrezi VISHAY-shabd → granth ka shabd (2026-08-07).
 *
 * KYUN: user Hinglish likhta hai par mool shabd aksar angrezi hi rakhta
 * hai — "Consciousness kya hoti hai", "destiny change kar sakta hai",
 * "attachment aur love me difference". Ye shabd Devanagari corpus se
 * kabhi match nahi karte. Keyword search ke liye to bilkul bekaar hain.
 *
 * Sirf wahi shabd yahan hain jinka granth mein SAAF ek shabd hai. Jinka
 * nahi (leadership, mindfulness, energy) unhe chhod diya — jhootha
 * paryay na paryay se bura hai.
 */
export const EN_CONCEPT = {
  // ⚠️⚠️ JODNE KA KRAM MAAYNE RAKHTA HAI — SABSE UPAR KYUN
  //
  // mapEnglishConcepts() Object.entries() ke KRAM me chalta hai aur har
  // chaabi ko badal deta hai. Isliye BAHU-SHABD chaabi ("second house")
  // apne tukdon ("second", "house") se PEHLE aani chahiye. Agar "second"
  // pehle chal gaya to paath "द्वितीय house" ban jayega aur "second house"
  // wali chaabi ka match hoga hi nahi — wo line chup-chaap bekaar ho
  // jayegi. Isliye ye block file me sabse upar hai, aur naya bahu-shabd
  // niyam bhi YAHIN aana chahiye, neeche nahi.

  // ── JYOTISH KE BHAAV (2026-08-18) ───────────────────────────────────
  // 29 khaali sawaalon ki naap me sabse zyada bacha hua Roman shabd yahi
  // tha — "house", 9 baar. Saare Lal Kitab ke sawaal the:
  //     "Second house ka sambandh family aur speech se…"
  //     findQ bana: "द्वितीय house का सम्बन्ध कुटुम्ब और speech से…"
  // aur us granth ke 18 ansh pool me hone ke baad bhi best score 0.0018
  // aaya — yaani gate ne sab gira diya.
  //
  // ⚠️ AKELA "house" JAAN-BOOJHKAR NAHI JODA. Jyotish me "house" = भाव,
  // par aam baat me "house" = घर. "ghar me shanti kaise laayein" jaisa
  // sawaal "भाव me shanti" ban jaata — aur wo galti chup-chaap hoti,
  // kyunki jawab phir bhi aa jaata, bas galat ansh se. Isliye sirf
  // ginti-ke-saath wala roop, jahan matlab me koi shak nahi hai.
  "first house": "प्रथम भाव",    "second house": "द्वितीय भाव",
  "third house": "तृतीय भाव",    "fourth house": "चतुर्थ भाव",
  "fifth house": "पंचम भाव",     "sixth house": "षष्ठ भाव",
  "seventh house": "सप्तम भाव",  "eighth house": "अष्टम भाव",
  "ninth house": "नवम भाव",      "tenth house": "दशम भाव",
  "eleventh house": "एकादश भाव", "twelfth house": "द्वादश भाव",

  // ── AATM- ke jode shabd (bahu-shabd, isliye upar) ───────────────────
  // "self" akela nahi joda — "self" ka matlab bahut phaila hua hai. Ye
  // do jode roop hi granth ki bhasha me seedhe milte hain.
  "self-realization": "आत्म-साक्षात्कार", "self realization": "आत्म-साक्षात्कार",
  "self-control": "आत्म-संयम",           "self control": "आत्म-संयम",

  // sawaal ka DHAANCHA — ye pehle "shor" maane the, par ye hi sawaal ka
  // matlab hain. Hatane se query thoonth ban jaati thi.
  meaning: "अर्थ", importance: "महत्व", significance: "माहात्म्य",
  difference: "भेद", concept: "स्वरूप", purpose: "उद्देश्य",
  benefit: "लाभ", effect: "प्रभाव", reason: "कारण", result: "फल",
  types: "प्रकार", qualities: "गुण", rules: "नियम", lesson: "शिक्षा",
  message: "संदेश", secret: "रहस्य", nature: "स्वरूप", state: "अवस्था",
  // vishay ke shabd
  soul: "आत्मा", atma: "आत्मा", consciousness: "चेतना", awareness: "चेतना",
  mind: "मन", intellect: "बुद्धि", ego: "अहंकार", thoughts: "विचार",
  destiny: "प्रारब्ध", fate: "प्रारब्ध", luck: "दैव",
  death: "मृत्यु", rebirth: "पुनर्जन्म", birth: "जन्म",
  liberation: "मोक्ष", salvation: "मोक्ष", meditation: "ध्यान",
  devotion: "भक्ति", worship: "पूजा", prayer: "प्रार्थना",
  sacrifice: "त्याग", charity: "दान", service: "सेवा",
  forgiveness: "क्षमा", patience: "धैर्य", anger: "क्रोध",
  fear: "भय", desire: "काम", greed: "लोभ", attachment: "आसक्ति",
  jealousy: "ईर्ष्या", happiness: "सुख", suffering: "दुःख",
  peace: "शान्ति", truth: "सत्य", knowledge: "ज्ञान", wisdom: "विवेक",
  ignorance: "अज्ञान", illusion: "माया", creation: "सृष्टि",
  universe: "जगत", duty: "कर्तव्य", discipline: "संयम",
  anxiety: "चिन्ता", stress: "क्लेश", gratitude: "कृतज्ञता",
  humility: "विनय", compassion: "करुणा", friendship: "मित्रता",
  enemy: "शत्रु", wealth: "धन", money: "धन", food: "आहार",
  guru: "गुरु", teacher: "आचार्य", student: "शिष्य", family: "कुटुम्ब",
  chanting: "जप", mantra: "मन्त्र", breath: "प्राण", body: "शरीर",
  life: "जीवन", success: "सिद्धि", failure: "पराजय", growth: "उन्नति",
  // granth aur paribhashik naam — ye Latin mein hi reh jaate the
  vedas: "वेद", veda: "वेद", upanishads: "उपनिषद", upanishad: "उपनिषद",
  puranas: "पुराण", purana: "पुराण", gita: "गीता", ramayan: "रामायण",
  mahabharat: "महाभारत", vedanta: "वेदान्त", advaita: "अद्वैत",
  dvaita: "द्वैत", triguna: "गुण", sattva: "सत्त्व", rajas: "रजस",
  tamas: "तमस", sadguru: "सद्गुरु", samadhi: "समाधि", yoga: "योग",
  karma: "कर्म", dharma: "धर्म", moksha: "मोक्ष", bhakti: "भक्ति",
  atman: "आत्मा", brahman: "ब्रह्म", maya: "माया", chakra: "चक्र",
  chakras: "चक्र", kundalini: "कुण्डलिनी", pranayama: "प्राणायाम",
  mindfulness: "एकाग्रता", nishkam: "निष्काम", sthitaprajna: "स्थितप्रज्ञ",
  // ── 2026-08-10: live app par bache hue Latin shabd ──────────────────
  // "Gita me Daivi Sampat aur Asuri Sampat ka practical difference kya
  // hai?" → findQ bana:
  //     "गीता में दैवी Sampat और आसुरी Sampat का practical भेद क्या है?"
  // Do Latin shabd beech mein pade rahe. Ye sirf "thoda shor" nahi hai —
  // rerankQ bhi yehi hota hai, aur cross-encoder ko aadha-Latin sawaal
  // dene se uska faisla bigadta hai. Us sawaal par best-rerank 0.3447
  // aaya aur SIRF 1 ansh gate paar kar paya.
  // ── 2026-08-11: live app par bache hue Latin shabd (doosra daur) ────
  // "Gita ke according death ke samay consciousness ka direction kaise
  // matter karta hai?" → findQ bana:
  //     "गीता के मृत्यु के समय चेतना का direction कैसे matter करता है?"
  // Us sawaal ka Aadhaar Yoga Vasishtha nikla, Gita nahi.
  //
  // ⚠️ CHUNAAV CORPUS SE, SHABDKOSH SE NAHI. "risky" ka seedha anuvaad
  // "जोखिम" hai — par corpus mein wo sirf 6 ansh mein hai. "गोपनीय" 160
  // aur "रहस्य" 865 mein hai. Isliye "risky" ko "जोखिम" mat bhejo; jo
  // shabd granthon mein sach mein likha hai, wahi bhejo. Yahi soch
  // GRANTH_PARYAY ke peeche bhi hai.
  // ── AAJ KE SELF-HELP SHABD (2026-08-11, 298 sawaal ke naap se) ──────
  //
  // 298 sawaalon mein 41 par koi granth nahi mila. Unmein se 30 — yaani
  // TEEN-CHAUTHAI — ek hi kism ke the: aaj ki self-help wali bhasha.
  //     Overthinking, Negative thoughts, Comparison, Free will,
  //     Positive thinking, Mindfulness, Inner voice, balance, stress
  // In par best-rerank 0.003 se 0.14 tak tha, yaani reranker ko kuch
  // mila hi nahi. Wajah saaf: ye shabd Latin mein hi ja rahe the aur
  // corpus poora Devanagari hai.
  //
  // ⚠️ CHUNAAV CORPUS SE. Shabdkosh "overthinking" ka "अतिचिन्तन" deta
  // hai — corpus mein wo shabd 0 baar hai. "चिन्ता" 993 baar hai. Isi
  // tarah "negative" ka seedha "नकारात्मक" sirf 20 mein hai, par uska
  // asli bhaav "दुर्भावना/कुविचार" bhi kam hai — isliye "बुरे विचार"
  // (do aam shabd) behtar hai.
  //
  // ⚠️ AUR EK: "free will" ka anuvaad "स्वतन्त्र इच्छा" nahi, PURUSHARTH
  // hai. Shastron mein yehi wo shabd hai jo प्रारब्ध (destiny) ke saamne
  // rakha jaata hai — पुरुषार्थ 624 ansh, प्रारब्ध 348. Ye anuvaad nahi,
  // us paramparaa ka apna shabd-jodaa hai. Isi tarah Arjun ka
  // "confusion" = मोह (3,430) — Gita ka pehla adhyaya hi
  // "अर्जुनविषादयोग" hai.
  overthinking: "चिन्ता",                      // चिन्ता 993 (अतिचिन्तन 0)
  negative: "बुरे", positive: "शुभ",
  comparison: "तुलना", compare: "तुलना",        // तुलना 128
  destiny: "प्रारब्ध", freewill: "पुरुषार्थ",   // पुरुषार्थ 624
  balance: "समता", maintain: "बनाए",            // समता 290 (सन्तुलन 0!)
  test: "परीक्षा", exam: "परीक्षा",             // परीक्षा 369
  confusion: "मोह", confused: "मोह", doubt: "संशय",  // मोह 3,430 · संशय 1,654
  remove: "दूर", reduce: "कम", overcome: "जीत",  // दूर 4,176
  spiritual: "आध्यात्मिक", spirituality: "अध्यात्म",
  way: "मार्ग", path: "मार्ग", ways: "मार्ग",   // मार्ग 3,260 — "way" pehle "वयो" ban raha tha!
  observe: "देखना", observation: "साक्षी",
  competition: "स्पर्धा",
  intuition: "अन्तरात्मा", conscience: "अन्तरात्मा",  // अन्तरात्मा 148
  discrimination: "विवेक", discernment: "विवेक",      // विवेक 1,068
  benefit: "लाभ", growth: "उन्नति", role: "भूमिका",

  direction: "दिशा",            // दिशा 2,741
  matter: "महत्व", matters: "महत्व", relevance: "महत्व",   // महत्व 157
  share: "बाँटना", sharing: "बाँटना",                       // बाँट 111
  risky: "गोपनीय", secret: "रहस्य", secrecy: "गोपनीय",      // गोपनीय 160, रहस्य 865

  practical: "व्यावहारिक", theoretical: "सैद्धान्तिक",
  destroy: "नाश", destruction: "विनाश", destroyed: "नष्ट",
  promise: "प्रतिज्ञा", curse: "शाप",   // decision pehle se maujood
  boon: "वरदान", battle: "युद्ध", army: "सेना", messenger: "दूत",
  narrative: "प्रसंग", episode: "प्रसंग",   // story pehle se maujood
  example: "उदाहरण", method: "विधि", process: "प्रक्रिया",
  origin: "उत्पत्ति", role: "भूमिका", symbol: "प्रतीक",
  quality: "गुण", rule: "नियम", type: "प्रकार",
  // 298 sawaalon par chalane ke baad bache hue aam shabd
  scriptures: "शास्त्र", scripture: "शास्त्र", control: "संयम",
  problems: "कष्ट", problem: "कष्ट", solution: "समाधान",
  relation: "सम्बन्ध", relationship: "सम्बन्ध", connection: "सम्बन्ध",
  character: "चरित्र", decision: "निर्णय", war: "युद्ध",
  avatar: "अवतार", science: "विज्ञान", students: "विद्यार्थी",
  student_life: "विद्यार्थी", career: "वृत्ति", balance: "समता",
  emotions: "भाव", healing: "आरोग्य", disease: "रोग", health: "आरोग्य",
  journey: "यात्रा", practice: "अभ्यास", teachings: "शिक्षा",
  summary: "सार", story: "कथा", king: "राजा", warrior: "योद्धा",
  equality: "समानता", surrender: "शरण",

  // ── SANSKRIT/HINDI KE NAAM (2026-08-10) ───────────────────────────
  //
  // ASLI GHATNA: 298 sawaalon ke poore run mein 114 fail hue. Unme se
  // 61 par best-rerank 0.10 se bhi kam tha — yaani reranker ko dene ko
  // kuch tha hi nahi. Pehle laga corpus ki kami hai. Par jaanch par:
  //     "Draupadi ke life lessons"  → "Draupadi के जीवन lessons"
  //     "Prarabdha Karma kya hota"  → "Prarabdha कर्म क्या होता है?"
  //     "Kaurav aur Pandav conflict"→ "Kaurav और Pandav conflict"
  // NAAM Latin mein hi reh gaye the. Aur jahan mukhya shabd Latin tha,
  // wahan ummeedwaaron mein 0 prasangik ansh mile — jabki corpus mein
  // द्रौपदी 1,503 baar, अर्जुन 8,949 baar, मुहूर्त 726 baar hai.
  //
  // Ye wahi kism ki galti hai jo ab tak teen baar mil chuki hai. Naam
  // sabse zyada nuksan karte hain kyunki wahi sawaal ka asli vishay
  // hote hain — unka Latin reh jaana poori query bekaar kar deta hai.
  draupadi: "द्रौपदी", yudhishthir: "युधिष्ठिर", yudhisthir: "युधिष्ठिर",
  dronacharya: "द्रोणाचार्य", drona: "द्रोण", yamraj: "यमराज",
  kaurav: "कौरव", kaurava: "कौरव", kauravas: "कौरव",
  pandav: "पाण्डव", pandava: "पाण्डव", pandavo: "पाण्डव", pandavas: "पाण्डव",
  kurukshetra: "कुरुक्षेत्र", vashisht: "वसिष्ठ", vasishtha: "वसिष्ठ",
  patanjali: "पतंजलि", ashtanga: "अष्टांग", vedic: "वैदिक",
  punarjanam: "पुनर्जन्म", prarabdha: "प्रारब्ध", kriyamana: "क्रियमाण",
  sanchit: "संचित", nirodha: "निरोध", vishad: "विषाद",
  brahmasmi: "ब्रह्मास्मि", nasadiya: "नासदीय", mahabhuta: "महाभूत",
  muladhara: "मूलाधार", sahasrara: "सहस्रार", ajna: "आज्ञा",
  kena: "केन", mandukya: "माण्डूक्य", taittiriya: "तैत्तिरीय",
  navadha: "नवधा", namah: "नमः", mahamrityunjaya: "महामृत्युंजय",
  chiranjeevi: "चिरंजीवी", kalki: "कल्कि", kundli: "कुण्डली",
  navgraha: "नवग्रह", muhurat: "मुहूर्त", muhurta: "मुहूर्त",
  bhagwat: "भागवत", bhagavat: "भागवत", dharman: "धर्मान्",

  // Hindi ke wo shabd jo abhi bhi Latin mein bach rahe the
  insaan: "मनुष्य", tarika: "तरीका", fayda: "लाभ", kareeb: "निकट",
  achhe: "अच्छे", milte: "मिलते", milegi: "मिलेगी", padhne: "पढ़ने",
  bolti: "बोलती", humari: "हमारी", sabki: "सबकी", chhode: "छोड़े",
  sikhate: "सिखाते", jiye: "जिए", badhaye: "बढ़ाए", nikle: "निकले",

  // aam angrezi jinka saaf Devanagari joda hai
  change: "परिवर्तन", person: "व्यक्ति", develop: "विकास",
  inner: "अन्तर", daily: "नित्य", power: "शक्ति", reality: "सत्य",
  philosophy: "दर्शन", ideal: "आदर्श", energy: "तेज", love: "प्रेम",
  trust: "विश्वास", voice: "वाणी", time: "समय", steps: "चरण",
  forms: "प्रकार", friend: "मित्र", strength: "बल", strategy: "नीति",
  source: "मूल", astrology: "ज्योतिष", human: "मनुष्य", music: "संगीत",
  childhood: "बाल्य", lessons: "शिक्षा", concepts: "स्वरूप",
  chapters: "अध्याय", chapter: "अध्याय", desires: "काम",
  enemies: "शत्रु", root: "मूल", cause: "कारण", future: "भविष्य",
  eye: "नेत्र", important: "महत्व", overcome: "जीत",

  // ── 2026-08-18: 29 KHAALI SAWAALON KI GINTI SE AAYE SHABD ───────────
  //
  // Ye andaaze se nahi chune gaye. 31_khaali_jaanch.mjs ne 29 aise sawaal
  // nikale jo HAR BAAR khaali lautte the (shor nahi — teen baar jaancha),
  // aur 32_khaali_kyun.mjs ne unme bache hue Roman shabd gine. Neeche
  // wahi shabd hain, ginti ke saath.
  //
  // KYUN YE MAAYNE RAKHTA HAI — naapa hua:
  //     Devanagari  0-50%  → best rerank score ka ausat 0.0106
  //     Devanagari 50-60%  → 0.0348
  //     Devanagari 60-70%  → 0.0730
  //     Devanagari 70-100% → 0.1406        (13 guna, r = 0.55)
  // Corpus poora Devanagari hai. Query me bacha hua Roman shabd sirf "ek
  // shabd kam" nahi hai — wo poore vaakya ka score neeche kheenchta hai,
  // aur gate (0.30) sab kuch gira deta hai. Un 29 me se EK BHI 0.30 tak
  // nahi pahuncha (sabse ooncha 0.2913), jabki 19 me sahi granth ke ansh
  // pool me maujood the.
  //
  // ⚠️ JO JAAN-BOOJHKAR NAHI JODE: near, far, higher, central, present,
  // based, created, events, partnership, self, world. Inka matlab
  // sandarbh se badalta hai, aur galat map hone par nuksaan CHUP-CHAAP
  // hota hai — jawab phir bhi aata hai, bas galat ansh se. 6 Agast wali
  // ghatna yahi thi: "the/say/is/me" Hindi lexicon me match kar rahe the
  // aur har angrezi sawaal ki query aadhi bakwaas ban rahi thi.
  relate: "सम्बन्ध",        // 5 baar
  context: "सन्दर्भ",       // 4
  explain: "वर्णन",         // 3
  interpret: "अर्थ",        // 2
  philosophical: "दार्शनिक", // 2
  chariot: "रथ",            // 2 — Kathopanishad ki rath-upma
  analogy: "उपमा",          // 2
  cosmic: "ब्रह्माण्ड",      // 2
  divine: "दिव्य", justice: "न्याय", karmic: "कर्म", actions: "कर्म",
  translation: "अनुवाद", beings: "प्राणी", senses: "इन्द्रिय",
  symbolism: "प्रतीक", hymns: "सूक्त", experience: "अनुभव",
  naraka: "नरक", narakas: "नरक",
  education: "विद्या", intelligence: "बुद्धि", children: "संतान",
  courage: "साहस", siblings: "भाई", transformation: "परिवर्तन",
  guidance: "मार्गदर्शन", comfort: "सुख", mother: "माता",
  ruler: "राजा", conflict: "संघर्ष", preservation: "पालन",
  rescue: "रक्षा",
  // "depression" ko "विषाद" — granth ki apni bhasha yahi hai (Gita ka
  // pehla adhyaay "अर्जुन विषाद योग" hai). "डिप्रेशन" likhne se corpus me
  // kuch nahi milta.
  depression: "विषाद",

  // ── 19 Agast: 11 bache hue khaali sawaalon ki ginti se ──────────────
  // Wahi tareeka — andaaze se nahi, 32_khaali_kyun.mjs ki ginti se.
  // ⚠️ near, far, created, based, partnership JAAN-BOOJHKAR CHHODE —
  // inka matlab sandarbh se badalta hai aur galat map hone par nuksaan
  // chup-chaap hota hai.
  speech: "वाणी",      // "Second house … family aur speech se"
  indicate: "संकेत",   // "Tenth house … kya indicate karta hai"
  bind: "बाँध",        // "Desire mind ko kaise bind karti hai"
  world: "संसार",      // "World ko mind-created … kehne ka arth"
};

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
