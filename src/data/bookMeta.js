/**
 * SAARTHI — Curated metadata for the uploaded books (icons, Hindi/English
 * titles, subtitles). Extracted from App.jsx (item #4 refactor, 2026-07-27)
 * because both BooksView.jsx and AudioView.jsx (Amrit lessons) need it —
 * moved to a shared data file instead of duplicating or cross-importing
 * between two view files. Pure move — no data changed.
 */

// ── Curated metadata for the 13+ uploaded books — PROPER names, never OCR ────
export const BOOK_META = {
  bhagavad_gita_shankar: { icon:"🕉️", title:"श्रीमद्भगवद्गीता", en:"Shrimad Bhagavad Gita", sub:"शांकरभाष्य सहित — कर्म, भक्ति और ज्ञान का सार" },
  valmiki_ramayana:      { icon:"🏹", title:"वाल्मीकि रामायण",   en:"Valmiki Ramayana",     sub:"मर्यादा पुरुषोत्तम श्रीराम की पावन गाथा" },
  rigveda_1:             { icon:"📜", title:"ऋग्वेद",             en:"Rigveda",              sub:"विश्व का प्राचीनतम ग्रंथ — ऋचाओं का संग्रह" },
  samaveda:              { icon:"🎵", title:"सामवेद",             en:"Samaveda",             sub:"संगीत और साम-गान का वेद" },
  yajurveda:             { icon:"🔥", title:"यजुर्वेद",            en:"Yajurveda",            sub:"यज्ञ-विधि और मंत्रों का वेद" },
  atharvaveda_1:         { icon:"🌿", title:"अथर्ववेद",           en:"Atharvaveda",          sub:"जीवन, औषधि और रक्षा-मंत्रों का वेद" },
  shiva_purana_1:        { icon:"🔱", title:"शिव पुराण — खण्ड १",  en:"Shiva Purana Khand 1", sub:"भगवान शिव की महिमा और लीलाएँ" },
  shiva_purana_2:        { icon:"🔱", title:"शिव पुराण — खण्ड २",  en:"Shiva Purana Khand 2", sub:"शिव-भक्ति, व्रत और कथाएँ" },
  garuda_purana_1:       { icon:"🦅", title:"गरुड़ पुराण",         en:"Garuda Purana",        sub:"मृत्यु, परलोक और कर्मफल का ज्ञान" },
  vishnu_purana_1:       { icon:"🪷", title:"विष्णु पुराण",        en:"Vishnu Purana",        sub:"सृष्टि, अवतार और भक्ति की कथाएँ" },
  narasimha_purana:      { icon:"🦁", title:"नृसिंह पुराण",        en:"Narasimha Purana",     sub:"भक्त प्रह्लाद और नृसिंह अवतार" },
  bhavishya_purana:      { icon:"🔮", title:"भविष्य पुराण",        en:"Bhavishya Purana",     sub:"भविष्य-कथन, व्रत और धर्म-आचार" },
  agni_purana:           { icon:"🔥", title:"अग्नि पुराण",         en:"Agni Purana",          sub:"सर्व-विद्या का विश्वकोश पुराण" },
  // ── Batch 2: 11 nayi books (07_add_books.py se) ──
  ishadi_upanishad:      { icon:"🪷", title:"ईशादि उपनिषद्",       en:"Ishadi Upanishad",     sub:"ईश, केन, कठ आदि — आत्मज्ञान के मूल स्रोत" },
  kathopanishad:         { icon:"🕯️", title:"कठोपनिषद्",           en:"Kathopanishad",        sub:"नचिकेता-यम संवाद — मृत्यु और अमरता का रहस्य" },
  guru_granth_sahib:     { icon:"☬",  title:"गुरु ग्रंथ साहिब",     en:"Guru Granth Sahib",    sub:"गुरुवाणी — नाम, सेवा और सिमरन का प्रकाश" },
  chanakya_neeti:        { icon:"🦉", title:"चाणक्य नीति",          en:"Chanakya Neeti",       sub:"जीवन, राजनीति और व्यवहार की अमर सूत्र-नीति" },
  ekadashi_mahatmya:     { icon:"🌕", title:"एकादशी व्रत माहात्म्य", en:"Ekadashi Mahatmya",    sub:"सभी एकादशियों की कथा, विधि और फल" },
  mantra_maha_sagar:     { icon:"📿", title:"मंत्र महासागर",        en:"Mantra Maha Sagar",    sub:"मंत्रों का महाकोश — साधना और सिद्धि" },
  mantra_shakti:         { icon:"✨", title:"मंत्र शक्ति",          en:"Mantra Shakti",        sub:"मंत्र-विज्ञान और जप की शक्ति" },
  nitya_devta_archana:   { icon:"🪔", title:"नित्य देवता अर्चना",   en:"Nitya Devta Archana",  sub:"दैनिक देव-पूजन की सरल विधि" },
  nitya_karm_pooja:      { icon:"🛕", title:"नित्य कर्म पूजा प्रकाश", en:"Nitya Karm Pooja",     sub:"संध्या, पूजन और नित्य कर्मों का संग्रह" },
  lal_kitab:             { icon:"📕", title:"लाल किताब (उपाय सहित)", en:"Lal Kitab",            sub:"ज्योतिष और सरल उपायों का प्रसिद्ध ग्रंथ" },
  rashi_muhurt_vigyan:   { icon:"🪐", title:"सम्पूर्ण राशि और मुहूर्त विज्ञान", en:"Rashi & Muhurt Vigyan", sub:"राशियों, ग्रहों और शुभ मुहूर्त का विज्ञान" },
};
