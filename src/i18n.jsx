/**
 * SAARTHI — Global UI language (Hindi / English) toggle.
 *
 * This controls ONLY static app-chrome text (nav labels, headings, button
 * labels, placeholders, empty states, etc). It does NOT control:
 *   - AI-generated chat/Ask responses (handled by src/services/gemini.js
 *     language-detection logic)
 *   - Raw scripture/book content (OCR'd text of the 24 books)
 *   - User-typed content (search queries, chat messages)
 *   - The Amrit (daily lesson) per-item Hindi/English toggle on AmritCard —
 *     that is a separate, intentionally independent control.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const LS_KEY = "SAARTHI_UI_LANG";

export const LangContext = createContext({ uiLang: "hi", setUiLang: () => {} });

export function LangProvider({ children }) {
  const [uiLang, setUiLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved === "en" || saved === "hi" ? saved : "hi";
    } catch {
      return "hi";
    }
  });

  const setUiLang = useCallback((lang) => {
    const next = lang === "en" ? "en" : "hi";
    setUiLangState(next);
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {}
  }, []);

  // ACCESSIBILITY FIX (audit 2026-07-25): <html lang="hi"> index.html mein
  // hardcoded tha — user English toggle karta tab bhi screen-reader Hindi
  // pronunciation rules se hi padhta rehta tha. Ab toggle badalte hi
  // asli <html> tag ka lang attribute bhi sync hota hai.
  useEffect(() => {
    try { document.documentElement.lang = uiLang === "en" ? "en" : "hi"; } catch {}
  }, [uiLang]);

  return (
    <LangContext.Provider value={{ uiLang, setUiLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useUiLang() {
  return useContext(LangContext);
}

// ─────────────────────────────────────────────────────────────────────────
// TRANSLATION DICTIONARY
// ─────────────────────────────────────────────────────────────────────────
export const STRINGS = {
  // ── Global language toggle (Home page) ──
  langToggleLabel: { hi: "ऐप की भाषा", en: "App Language" },

  // ── Bottom navigation ──
  navHome:   { hi: "होम",   en: "Home" },
  navAsk:    { hi: "पूछें", en: "Ask" },
  navBooks:  { hi: "ग्रंथ", en: "Books" },
  navSearch: { hi: "खोज",   en: "Search" },
  navListen: { hi: "सुनें", en: "Listen" },
  navUpload: { hi: "PDF",   en: "PDF" },
  backToHome: { hi: "होम",  en: "Home" },

  // ── Home — greeting hero ──
  greetMorning:      { hi: "सुप्रभात 🌅", en: "Good morning 🌅" },
  greetMorningSub:   { hi: "आज का दिन आपका हो — मन में क्या है?", en: "Make today yours — what's on your mind?" },
  greetAfternoon:    { hi: "शुभ दोपहर ☀️", en: "Good afternoon ☀️" },
  greetAfternoonSub: { hi: "दिन कैसा जा रहा है? बात करने के लिए मैं यहाँ हूं।", en: "How's the day going? I'm here if you need to talk." },
  greetEvening:      { hi: "शुभ सायंकाल 🌇", en: "Good evening 🌇" },
  greetEveningSub:   { hi: "दिन भर के बाद — कुछ साझा करना है?", en: "After a long day — anything you'd like to share?" },
  greetNight:        { hi: "शुभ रात्रि 🌙", en: "Good evening 🌙" },
  greetNightSub:     { hi: "चिंतन के लिए अच्छा समय है। मन में क्या है?", en: "A good time for reflection. What's on your mind?" },
  greetLateNight:    { hi: "अभी जाग रहे हैं? 🕯️", en: "Still awake? 🕯️" },
  greetLateNightSub: { hi: "रात को जाग रहे हो — बात करो, मैं यहाँ हूं।", en: "Up late? Let's talk — I'm here." },

  todaysWisdomLabel: { hi: "✦ आज का ज्ञान", en: "✦ Today's Wisdom" },
  listenBtn: { hi: "▶ सुनें", en: "▶ Listen" },
  stopBtn:   { hi: "⏸ रोकें", en: "⏸ Stop" },
  resumeBtn: { hi: "▶ जारी रखें", en: "▶ Resume" },

  continueConversation: { hi: "अपनी बातचीत जारी रखें", en: "Continue your conversation" },

  startHereLabel: { hi: "यहाँ से शुरू करें", en: "Start here" },
  qcAskTitle:     { hi: "सारथी से पूछें", en: "Ask Saarthi" },
  qcAskDesc:      { hi: "जीवन मार्गदर्शन और ज्ञान", en: "Life guidance & wisdom" },
  qcBooksTitle:   { hi: "ग्रंथ पढ़ें", en: "Read Books" },
  qcBooksDesc:    { hi: "पवित्र ग्रंथ और अध्याय", en: "Sacred texts & chapters" },
  qcListenTitle:  { hi: "सुनें", en: "Listen" },
  qcListenDesc:   { hi: "शांत ऑडियो कथन", en: "Calm audio narration" },
  qcPdfTitle:     { hi: "PDF चैट", en: "PDF Chat" },
  qcPdfDesc:      { hi: "अपनी फ़ाइलों से बात करें", en: "Chat with your files" },

  amritSectionTitle: { hi: "🕉️ आज का अमृत", en: "🕉️ Today's Amrit" },
  amritCardTitle:    { hi: "हर ग्रंथ से आज का एक पाठ", en: "A daily reading from every scripture" },
  amritCardSub:      { hi: "सभी ग्रंथ · हिंदी + अंग्रेज़ी · पढ़ें या सुनें →", en: "All scriptures · Hindi + English · read or listen →" },
  vedicTimeCardTitle: { hi: "वैदिक समय — विक्रमादित्य वैदिक घड़ी", en: "Vedic Time — Vikramaditya Vedic Clock" },
  vedicTimeCardSub:   { hi: "आज का मुहूर्त, तिथि, नक्षत्र सरल भाषा में जानें →", en: "Today's Muhurta, Tithi, Nakshatra in simple language →" },
  bookPdfLoading:     { hi: "पुस्तक लोड हो रही है…", en: "Loading book…" },
  amritLoading:      { hi: "🕉️ अमृत ला रहे हैं…", en: "🕉️ Bringing today's Amrit…" },
  amritViewSubtitle: { hi: "हर ग्रंथ से आज का एक पाठ — पढ़ें या सुनें, हिंदी या अंग्रेज़ी", en: "A daily reading from every scripture — read or listen, in Hindi or English" },

  disclaimerText: {
    hi: "🙏 SAARTHI GYAAN एक शैक्षिक एवं आध्यात्मिक-अध्ययन प्लेटफ़ॉर्म है। AI के उत्तर गलत या अधूरे हो सकते हैं — महत्वपूर्ण बातों की पुष्टि मूल ग्रंथों से करें। यह चिकित्सा, कानूनी, वित्तीय या मनोवैज्ञानिक सलाह का विकल्प नहीं है। ग्रंथों पर हमारा कोई स्वामित्व-दावा नहीं है; कोई भी शुल्क AI-खोज तकनीक के लिए है, ग्रंथ के लिए नहीं। सभी धर्मों एवं परम्पराओं का पूर्ण सम्मान।",
    en: "🙏 SAARTHI GYAAN is an educational and spiritual-study platform. AI responses may contain errors or be incomplete — please verify important matters from the original scriptures. This is not a substitute for medical, legal, financial, or psychological advice. We claim no ownership over the scriptures; any fee charged is for the AI search technology, not for the scripture itself. Full respect to all religions and traditions.",
  },

  // ── Chat / Ask ──
  statusConnected: { hi: "जुड़ा हुआ", en: "Connected" },
  statusDemo:      { hi: "डेमो मोड", en: "Demo mode" },
  statusFallback:  { hi: "स्मार्ट फॉलबैक", en: "Smart fallback" },
  statusError:     { hi: "त्रुटि", en: "Error" },
  clearBtn:        { hi: "साफ़ करें", en: "Clear" },
  chatWelcomeGreetingPre:  { hi: "नमस्ते 🙏 मैं ", en: "Namaste 🙏 I'm " },
  chatWelcomeGreetingPost: { hi: " हूं।", en: "." },
  chatWelcomeDesc: {
    hi: "मैं यहां सुनने के लिए हूं — चाहे आप किसी भारी बात से जूझ रहे हों, स्पष्टता की तलाश में हों, या बस एक शांत आवाज़ चाहते हों। जो मन में है साझा करें, हम मिलकर इसे सुलझाएंगे।",
    en: "I'm here to listen — whether you're dealing with something heavy, looking for clarity, or just need a calm voice. Share what's on your mind and we'll work through it together.",
  },
  chatStartersLabel: { hi: "या इनमें से किसी एक से शुरू करें:", en: "Or start with one of these:" },
  chatInputPlaceholder: { hi: "अपने मन की बात लिखें…", en: "Share what's on your mind…" },
  chatFooterHint: { hi: "भेजने के लिए Enter · नई लाइन के लिए Shift+Enter", en: "Enter to send · Shift+Enter for new line" },
  retryBtn:  { hi: "↺ फिर से कोशिश करें", en: "↺ Try again" },
  copyBtn:   { hi: "कॉपी करें", en: "Copy" },
  copiedBtn: { hi: "✓ कॉपी हुआ", en: "✓ Copied" },

  // ── Search ──
  searchTitle:    { hi: "🔍 पवित्र खोज", en: "🔍 Sacred Search" },
  searchSubtitle: { hi: "कोई भी शब्द लिखें — गीता, रामायण, वेद, पुराण, उपनिषद — सभी ग्रंथों में खोजा जाएगा", en: "Type any word — Gita, Ramayana, Vedas, Puranas, Upanishads — search across all scriptures" },
  searchReady:    { hi: "✅ ज्ञान इंजन तैयार है", en: "✅ Knowledge engine ready" },
  searchLoading:  { hi: "⏳ लोड हो रहा है…", en: "⏳ Loading…" },
  searchPlaceholder: { hi: "धर्म क्या है? · कृष्ण कौन हैं? · क्रोध · कर्म · भय…", en: "What is Dharma? · Who is Krishna? · Anger · Karma · Fear…" },
  searchEmptyTitle: { hi: "सभी पवित्र परंपराओं में खोजें", en: "Search all sacred traditions" },
  searchEmptyDesc: {
    hi: "गीता, रामायण, वेद, पुराण, उपनिषद और अन्य पवित्र ग्रंथों में श्लोक, शिक्षाएं और ज्ञान खोजें।",
    en: "Find verses, teachings, and wisdom across the Gita, Ramayana, Vedas, Puranas, Upanishads and more sacred books.",
  },
  searchNoResults:           { hi: `"{q}" के लिए कोई परिणाम नहीं मिला`, en: `No results found for "{q}"` },
  searchNoResultsHintReady:  { hi: "अलग कीवर्ड या व्यापक विषय आज़माएं।", en: "Try different keywords or a broader concept." },
  searchNoResultsHintLoading:{ hi: "ज्ञान इंजन अभी भी लोड हो रहा है — कुछ देर बाद फिर कोशिश करें।", en: "Knowledge engine still loading — try again in a moment." },
  searchConclusionLabel:  { hi: "🕉️ निष्कर्ष — सभी ग्रंथों से", en: "🕉️ Conclusion — from all scriptures" },
  searchConclusionLoading:{ hi: "✨ सभी ग्रंथों का सार निकाला जा रहा है…", en: "✨ Drawing the essence from all scriptures…" },
  searchConclusionNoKey:  { hi: "निष्कर्ष के लिए API key चाहिए — या नीचे ग्रंथ-अंश देखें।", en: "An API key is needed for the conclusion — or see the passages below." },
  searchConclusionQuotaOver: { hi: "आज का मुफ़्त AI-कोटा पूरा हो गया — कल फिर कोशिश करें। खोज (search) बिना रुकावट चलती रहेगी।", en: "Today's free AI quota is used up — please try again tomorrow. Search itself keeps working without any limit." },
  searchSourcesHide:       { hi: "▲ ग्रंथ-अंश छुपाएं", en: "▲ Hide passages" },
  searchSourcesShow:       { hi: "📜 ग्रंथ-अंश देखें ({n})", en: "📜 View passages ({n})" },

  // ── Library / Books ──
  libraryTitle:    { hi: "📚 पवित्र ग्रंथालय", en: "📚 Sacred Library" },
  librarySubtitle: { hi: "ग्रंथ चुनें → नाम दबाते ही असली किताब खुलेगी (सुनने के लिए: आज का अमृत)", en: "Choose a scripture → tap the name to open the original book (to listen, see Today's Amrit)" },
  libraryReady:    { hi: "✅ जुड़ा हुआ", en: "✅ Connected" },
  libraryLoading:  { hi: "⏳ लोड हो रहा है…", en: "⏳ Loading…" },
  librarySearchPlaceholder: { hi: "ग्रंथ खोजें…", en: "Search books…" },
  libraryNoMatch: { hi: `"{q}" से कोई ग्रंथ मेल नहीं खाता`, en: `No books match "{q}"` },
  libraryBackLabel: { hi: "ग्रंथालय", en: "Library" },
  libraryAllChapters: { hi: "सभी अध्याय", en: "All Chapters" },
  libraryContinueReading: { hi: "पढ़ना जारी रखें", en: "Continue Reading" },
  chapterWord: { hi: "अध्याय", en: "Chapter" },

  // ── Chapter reader ──
  readerModeAsli:  { hi: "📖 असली", en: "📖 Original" },
  readerModeText:  { hi: "📝 पाठ", en: "📝 Text" },
  readerModeSaral: { hi: "✨ सरल", en: "✨ Simple" },
  readerBookmarkAdd:    { hi: "बुकमार्क", en: "Bookmark" },
  readerBookmarkRemove: { hi: "बुकमार्क हटाएं", en: "Remove bookmark" },
  readingAloud: { hi: "पढ़ा जा रहा है…", en: "Reading aloud…" },

  // ── PDF Upload ──
  pdfTitle:     { hi: "📄 PDF अपलोड", en: "📄 PDF Upload" },
  pdfSubtitle:  { hi: "अपनी कोई भी PDF अपलोड करें — सारांश, प्रश्नोत्तर और गहन व्याख्या पाएं", en: "Upload any PDF — get summaries, Q&A, and deep explanations" },
  pdfSubtitle2: { hi: "NCERT · नोट्स · कोचिंग सामग्री · किताबें · शोध पत्र", en: "NCERT · Notes · Coaching Material · Books · Research Papers" },
  pdfDropTitle: { hi: "PDF यहां छोड़ें", en: "Drop your PDF here" },
  pdfDropOr:    { hi: "या नीचे बटन दबाएं", en: "Or click the button below" },
  pdfChooseBtn: { hi: "PDF फ़ाइल चुनें", en: "Choose PDF File" },
  pdfFeature1Title: { hi: "कुछ भी पूछें", en: "Ask anything" },
  pdfFeature1Desc:  { hi: "कोई भी सवाल पूछें", en: "Ask any question" },
  pdfFeature2Title: { hi: "सारांश पाएं", en: "Get a summary" },
  pdfFeature2Desc:  { hi: "हर अध्याय का सारांश", en: "Summary of every chapter" },
  pdfFeature3Title: { hi: "MCQ बनाएं", en: "Generate MCQs" },
  pdfFeature3Desc:  { hi: "परीक्षा के लिए अभ्यास", en: "Practice for exams" },
  pdfFeature4Title: { hi: "समझाएं", en: "Explain" },
  pdfFeature4Desc:  { hi: "मुश्किल विषय आसान होंगे", en: "Difficult topics made easy" },
  pdfParsing:     { hi: "PDF पढ़ा जा रहा है…", en: "Reading your PDF…" },
  pdfContentsBtn: { hi: "विषय-सूची", en: "Contents" },
  pdfChangeBtn:   { hi: "बदलें", en: "Change" },
  pdfInputPlaceholder: { hi: "अपने दस्तावेज़ से पूछें…", en: "Ask from your document…" },
  pdfCancelBtn: { hi: "✕ रद्द करें", en: "✕ Cancel" },
  pdfFormatsHint: { hi: "PDF · Word (.docx) · फ़ोटो (.jpg/.png) — सब चलते हैं", en: "PDF · Word (.docx) · Photos (.jpg/.png) — all supported" },

  // ── Splash / onboarding ──
  splashTagline: { hi: "प्राचीन ज्ञान और सोच-समझ वाला AI — उन सवालों के लिए जो सबसे ज़्यादा मायने रखते हैं।", en: "Ancient wisdom and thoughtful AI — for the questions that matter most." },
  splashCta:     { hi: "अपनी यात्रा शुरू करें 🙏", en: "Begin Your Journey 🙏" },
  splashHint:    { hi: "शुरू करने के लिए दबाएं · आवाज़ और ऑडियो सुविधाएं अनलॉक होंगी", en: "Tap to begin · Unlocks voice and audio features" },
};

/**
 * useT() — returns a t(key) function that looks up STRINGS[key][uiLang].
 * Falls back to the Hindi value, then the raw key — never throws.
 */
export function useT() {
  const { uiLang } = useUiLang();
  return useCallback(
    (key) => {
      const entry = STRINGS[key];
      if (!entry) return key;
      return entry[uiLang] ?? entry.hi ?? key;
    },
    [uiLang]
  );
}
