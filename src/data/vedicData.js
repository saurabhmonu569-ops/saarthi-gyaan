/**
 * SAARTHI — Vedic Time: static reference content (bilingual hi/en).
 * Tithi/Nakshatra/Yoga/Karana/Vaar/Ritu/Month naam + ek-line arth, aur
 * "Learn Vedic Clock" ke 8 chhote paath. Panchang ke live-computed ank
 * (index) ye names lookup karne ke liye use hote hain — src/services/panchang.js
 */

export const TITHI_NAMES = [
  { sa: "प्रतिपदा", hi: "प्रतिपदा", en: "Pratipada" },
  { sa: "द्वितीया", hi: "द्वितीया", en: "Dwitiya" },
  { sa: "तृतीया",   hi: "तृतीया",   en: "Tritiya" },
  { sa: "चतुर्थी",  hi: "चतुर्थी",  en: "Chaturthi" },
  { sa: "पंचमी",    hi: "पंचमी",    en: "Panchami" },
  { sa: "षष्ठी",    hi: "षष्ठी",    en: "Shashthi" },
  { sa: "सप्तमी",   hi: "सप्तमी",   en: "Saptami" },
  { sa: "अष्टमी",   hi: "अष्टमी",   en: "Ashtami" },
  { sa: "नवमी",     hi: "नवमी",     en: "Navami" },
  { sa: "दशमी",     hi: "दशमी",     en: "Dashami" },
  { sa: "एकादशी",   hi: "एकादशी",   en: "Ekadashi" },
  { sa: "द्वादशी",  hi: "द्वादशी",  en: "Dwadashi" },
  { sa: "त्रयोदशी", hi: "त्रयोदशी", en: "Trayodashi" },
  { sa: "चतुर्दशी", hi: "चतुर्दशी", en: "Chaturdashi" },
];
export const PURNIMA  = { sa: "पूर्णिमा", hi: "पूर्णिमा", en: "Purnima" };
export const AMAVASYA = { sa: "अमावस्या", hi: "अमावस्या", en: "Amavasya" };
export function tithiName(inPaksha, paksha) {
  if (inPaksha === 15) return paksha === "shukla" ? PURNIMA : AMAVASYA;
  return TITHI_NAMES[inPaksha - 1];
}

export const NAKSHATRAS = [
  ["अश्विनी","Ashwini"], ["भरणी","Bharani"], ["कृत्तिका","Krittika"], ["रोहिणी","Rohini"],
  ["मृगशिरा","Mrigashira"], ["आर्द्रा","Ardra"], ["पुनर्वसु","Punarvasu"], ["पुष्य","Pushya"],
  ["आश्लेषा","Ashlesha"], ["मघा","Magha"], ["पूर्वाफाल्गुनी","Purva Phalguni"], ["उत्तराफाल्गुनी","Uttara Phalguni"],
  ["हस्त","Hasta"], ["चित्रा","Chitra"], ["स्वाति","Swati"], ["विशाखा","Vishakha"],
  ["अनुराधा","Anuradha"], ["ज्येष्ठा","Jyeshtha"], ["मूल","Mula"], ["पूर्वाषाढ़ा","Purva Ashadha"],
  ["उत्तराषाढ़ा","Uttara Ashadha"], ["श्रवण","Shravana"], ["धनिष्ठा","Dhanishtha"], ["शतभिषा","Shatabhisha"],
  ["पूर्वाभाद्रपद","Purva Bhadrapada"], ["उत्तराभाद्रपद","Uttara Bhadrapada"], ["रेवती","Revati"],
].map(([hi, en]) => ({ hi, en }));

export const YOGAS = [
  ["विष्कुम्भ","Vishkumbha"], ["प्रीति","Priti"], ["आयुष्मान्","Ayushman"], ["सौभाग्य","Saubhagya"],
  ["शोभन","Shobhana"], ["अतिगण्ड","Atiganda"], ["सुकर्मा","Sukarma"], ["धृति","Dhriti"],
  ["शूल","Shoola"], ["गण्ड","Ganda"], ["वृद्धि","Vriddhi"], ["ध्रुव","Dhruva"],
  ["व्याघात","Vyaghata"], ["हर्षण","Harshana"], ["वज्र","Vajra"], ["सिद्धि","Siddhi"],
  ["व्यतीपात","Vyatipata"], ["वरीयान्","Variyana"], ["परिघ","Parigha"], ["शिव","Shiva"],
  ["सिद्ध","Siddha"], ["साध्य","Sadhya"], ["शुभ","Shubha"], ["शुक्ल","Shukla"],
  ["ब्रह्म","Brahma"], ["इन्द्र","Indra"], ["वैधृति","Vaidhriti"],
].map(([hi, en]) => ({ hi, en }));

export const KARANAS = {
  kimstughna:  { hi: "किंस्तुघ्न",   en: "Kimstughna" },
  bava:        { hi: "बव",           en: "Bava" },
  balava:      { hi: "बालव",         en: "Balava" },
  kaulava:     { hi: "कौलव",         en: "Kaulava" },
  taitila:     { hi: "तैतिल",        en: "Taitila" },
  gara:        { hi: "गर",           en: "Gara" },
  vanija:      { hi: "वणिज",         en: "Vanija" },
  vishti:      { hi: "विष्टि (भद्रा)", en: "Vishti (Bhadra)" },
  shakuni:     { hi: "शकुनि",        en: "Shakuni" },
  chatushpada: { hi: "चतुष्पद",      en: "Chatushpada" },
  naga:        { hi: "नाग",          en: "Naga" },
};

export const VAARS = [
  { hi: "रविवार", en: "Sunday",    graha: { hi: "सूर्य", en: "Sun" } },
  { hi: "सोमवार", en: "Monday",    graha: { hi: "चंद्र", en: "Moon" } },
  { hi: "मंगलवार", en: "Tuesday",  graha: { hi: "मंगल", en: "Mars" } },
  { hi: "बुधवार", en: "Wednesday", graha: { hi: "बुध", en: "Mercury" } },
  { hi: "गुरुवार", en: "Thursday", graha: { hi: "बृहस्पति", en: "Jupiter" } },
  { hi: "शुक्रवार", en: "Friday",  graha: { hi: "शुक्र", en: "Venus" } },
  { hi: "शनिवार", en: "Saturday",  graha: { hi: "शनि", en: "Saturn" } },
];

export const RITUS = [
  { hi: "वसंत ऋतु", en: "Vasant (Spring)" },
  { hi: "ग्रीष्म ऋतु", en: "Grishma (Summer)" },
  { hi: "वर्षा ऋतु", en: "Varsha (Monsoon)" },
  { hi: "शरद ऋतु", en: "Sharad (Autumn)" },
  { hi: "हेमंत ऋतु", en: "Hemant (Pre-winter)" },
  { hi: "शिशिर ऋतु", en: "Shishir (Winter)" },
];

export const HINDU_MONTHS = {
  chaitra:      { hi: "चैत्र",      en: "Chaitra" },
  vaishakha:    { hi: "वैशाख",      en: "Vaishakha" },
  jyeshtha:     { hi: "ज्येष्ठ",    en: "Jyeshtha" },
  ashadha:      { hi: "आषाढ़",      en: "Ashadha" },
  shravana:     { hi: "श्रावण",     en: "Shravana" },
  bhadrapada:   { hi: "भाद्रपद",    en: "Bhadrapada" },
  ashwin:       { hi: "आश्विन",     en: "Ashwin" },
  kartika:      { hi: "कार्तिक",    en: "Kartika" },
  margashirsha: { hi: "मार्गशीर्ष", en: "Margashirsha" },
  pausha:       { hi: "पौष",        en: "Pausha" },
  magha:        { hi: "माघ",        en: "Magha" },
  phalguna:     { hi: "फाल्गुन",    en: "Phalguna" },
};

// Muhurta index 0..29 → simple, respectful one-line notes (subset labelled;
// numbers ke saath generic label baaki ke liye). Brahma Muhurta = index 28
// (sunrise se 2 muhurta pehle, ~1h 36m se 48m pehle) — parampara mein bahut
// mahatvapurna maana jaata hai. Abhijit Muhurta = din ka theek beech
// (muhurta #15, saamanya taur par 8th night... simplified: local-noon
// ke aas-paas ka muhurta) — hum ise dopahar ke muhurta index se dikhate hain.
export const MUHURTA_SPECIAL = {
  28: { hi: "ब्रह्म मुहूर्त", en: "Brahma Muhurta", note: {
    hi: "सूर्योदय से पहले का समय — ध्यान और अध्ययन के लिए परंपरागत रूप से उत्तम माना जाता है।",
    en: "The period before sunrise — traditionally considered excellent for meditation and study.",
  }},
};

export function muhurtaLabel(index, uiLang) {
  if (index == null) return uiLang === "en" ? "—" : "—";
  const n = index + 1;
  if (MUHURTA_SPECIAL[index]) return MUHURTA_SPECIAL[index][uiLang === "en" ? "en" : "hi"];
  return uiLang === "en" ? `Muhurta ${n}` : `मुहूर्त ${n}`;
}

// ─── "Learn Vedic Clock" — 8 chhote paath (hi + en) ─────────────────────────
export const VEDIC_LESSONS = [
  {
    id: "muhurta", icon: "🕐",
    title: { hi: "मुहूर्त क्या है?", en: "What is Muhurta?" },
    body: {
      hi: "एक दिन-रात (24 घंटे) को 30 बराबर भागों में बांटा जाता है, हर भाग को मुहूर्त कहते हैं। हर मुहूर्त लगभग 48 मिनट का होता है, और वैदिक दिन सूर्योदय से शुरू होता है। किसी भी शुभ कार्य के लिए मुहूर्त देखने की परंपरा इसी गणना पर आधारित है।",
      en: "A full day-night (24 hours) is divided into 30 equal parts called Muhurtas. Each Muhurta is roughly 48 minutes, and the Vedic day traditionally begins at sunrise. The custom of choosing an auspicious Muhurta for important activities is based on this division.",
    },
  },
  {
    id: "tithi", icon: "🌙",
    title: { hi: "तिथि क्या है?", en: "What is Tithi?" },
    body: {
      hi: "तिथि चंद्रमा और सूर्य के बीच के कोणीय अंतर (हर 12°) से बनती है। एक चांद्र मास में 30 तिथियां होती हैं — शुक्ल पक्ष की 15 (प्रतिपदा से पूर्णिमा तक) और कृष्ण पक्ष की 15 (प्रतिपदा से अमावस्या तक)। व्रत, त्योहार और पूजा अक्सर तिथि के अनुसार तय होते हैं।",
      en: "A Tithi is formed by the angular distance between the Moon and Sun (every 12°). A lunar month has 30 tithis — 15 in the waxing Shukla Paksha (ending in Purnima) and 15 in the waning Krishna Paksha (ending in Amavasya). Fasts, festivals, and rituals are often timed by tithi.",
    },
  },
  {
    id: "nakshatra", icon: "⭐",
    title: { hi: "नक्षत्र क्या है?", en: "What is Nakshatra?" },
    body: {
      hi: "आकाश को 27 बराबर भागों (हर 13°20') में बांटा गया है, हर भाग एक नक्षत्र कहलाता है — जैसे अश्विनी, भरणी, रोहिणी आदि। चंद्रमा जिस भाग में स्थित होता है, वही उस समय का नक्षत्र माना जाता है। जन्म-नक्षत्र और मुहूर्त-चयन में इसका विशेष महत्व है।",
      en: "The sky is divided into 27 equal segments (13°20' each), each called a Nakshatra — like Ashwini, Bharani, Rohini, and so on. Whichever segment the Moon occupies is the current Nakshatra. It plays a key role in birth charts and muhurta selection.",
    },
  },
  {
    id: "paksha", icon: "◐",
    title: { hi: "पक्ष क्या है?", en: "What is Paksha?" },
    body: {
      hi: "एक चांद्र मास दो पक्षों में बंटा है: शुक्ल पक्ष (अमावस्या से पूर्णिमा तक, चंद्रमा बढ़ता है) और कृष्ण पक्ष (पूर्णिमा से अमावस्या तक, चंद्रमा घटता है)। कई पूजा-पाठ और व्रत किसी विशेष पक्ष में ही किए जाते हैं।",
      en: "A lunar month has two Pakshas (fortnights): Shukla Paksha (Amavasya to Purnima, waxing moon) and Krishna Paksha (Purnima to Amavasya, waning moon). Many rituals and fasts are tied to a specific paksha.",
    },
  },
  {
    id: "yoga", icon: "☯",
    title: { hi: "योग क्या है?", en: "What is Yoga?" },
    body: {
      hi: "पंचांग में 'योग' सूर्य और चंद्रमा की संयुक्त स्थिति (देशांतर योग) से बनता है। कुल 27 योग हैं — जैसे विष्कुम्भ, प्रीति, आयुष्मान्। यह तिथि और नक्षत्र से अलग एक तीसरा गणना-अंग है, जिसे शुभ-अशुभ विचार में देखा जाता है।",
      en: "In the Panchang, 'Yoga' is formed by the combined longitude of the Sun and Moon. There are 27 yogas — like Vishkumbha, Priti, Ayushman. It is a distinct calculation, separate from tithi and nakshatra, considered when assessing auspiciousness.",
    },
  },
  {
    id: "karana", icon: "◑",
    title: { hi: "करण क्या है?", en: "What is Karana?" },
    body: {
      hi: "करण एक तिथि का आधा भाग होता है — हर तिथि में 2 करण आते हैं, यानी एक चांद्र मास में कुल 60 करण। इनमें से 7 चलायमान (बार-बार आने वाले) और 4 स्थिर (महीने में एक ही बार आने वाले) होते हैं।",
      en: "A Karana is half of a Tithi — each tithi has 2 karanas, making 60 in a lunar month. Of these, 7 are movable (recur repeatedly) and 4 are fixed (occur only once per month).",
    },
  },
  {
    id: "brahma-muhurta", icon: "🌅",
    title: { hi: "ब्रह्म मुहूर्त क्या है?", en: "What is Brahma Muhurta?" },
    body: {
      hi: "सूर्योदय से लगभग 1 घंटा 36 मिनट पहले शुरू होकर 48 मिनट पहले तक का समय ब्रह्म मुहूर्त कहलाता है। इसे परंपरागत रूप से ध्यान, योग और अध्ययन के लिए सबसे शांत और उपयुक्त समय माना जाता है — यह एक पारंपरिक मान्यता है, वैज्ञानिक दावा नहीं।",
      en: "The period roughly from 1h36m to 48m before sunrise is called Brahma Muhurta. It is traditionally regarded as the calmest, most suitable time for meditation, yoga, and study — this is a traditional belief, not a scientific claim.",
    },
  },
  {
    id: "abhijit-muhurta", icon: "☀️",
    title: { hi: "अभिजित मुहूर्त क्या है?", en: "What is Abhijit Muhurta?" },
    body: {
      hi: "दिन के ठीक बीच का मुहूर्त (सूर्योदय और सूर्यास्त के बीच का आठवां मुहूर्त) अभिजित मुहूर्त कहलाता है। इसे लगभग हर दिन शुभ माना जाता है, सिवाय बुधवार के — यह भी एक पारंपरिक मान्यता है।",
      en: "The muhurta right at the middle of the day (the eighth muhurta between sunrise and sunset) is called Abhijit Muhurta. It's traditionally considered auspicious on almost every day except Wednesday — again, a traditional belief.",
    },
  },
];
