/**
 * SAARTHI — Books reader (ChapterReader, BookDetail, ChapterRow, BookPdfView, BooksView, BookCard)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useKnowledge } from "@/hooks/useKnowledge";
import { useBookProgress } from "@/context/AppContext";
import { polishSacredText, hasApiKey } from "@/services/gemini";
import { BOOKS } from "@/data";
import { useT, useUiLang } from "@/i18n";
import { C, F, serif, HAS_PDF } from "@/styles/theme";
import { Prose } from "@/components/ui/Primitives";
import { AudioEngine, HAS_EL } from "@/services/audioEngine";
import { BOOK_META } from "@/data/bookMeta";

function ChapterReader({ book, ch, onBack, markRead, isBookmarked, toggleBookmark }) {
  const t = useT();
  // Reading modes: "asli" (embedded original PDF — DEFAULT for engine books,
  // this is the "asli jaisa feel"), "text" (OCR paath), "saral" (AI Saaf Hindi)
  // असली (PDF) tab sirf un books mein jinki PDF sach mein public/books/ mein hai
  const isAsliAvailable = ch.fromEngine && ch.pageStart != null && HAS_PDF.has(book.id);
  const [viewMode, setViewMode] = useState(isAsliAvailable ? "asli" : "text");
  useEffect(() => { setViewMode(isAsliAvailable ? "asli" : "text"); }, [ch, isAsliAvailable]);
  // ✨ AI polish: reconstruct readable Hindi from noisy OCR, on demand
  const [aiClean, setAiClean]       = useState(null);
  const [aiCleaning, setAiCleaning] = useState(false);
  const [showClean, setShowClean]   = useState(false);
  useEffect(() => { setAiClean(null); setShowClean(false); setAiCleaning(false); }, [ch]);
  const runAiClean = async () => {
    if (aiClean) { setViewMode("saral"); setShowClean(true); return; }
    if (!hasApiKey()) { alert("AI se saaf karne ke liye API key chahiye (Groq gsk_ key)."); return; }
    setAiCleaning(true); setViewMode("saral");
    try {
      const cleaned = await polishSacredText(ch.text || "");
      setAiClean(cleaned); setShowClean(true);
    } catch (e) {
      alert("AI abhi saaf nahi kar paya — thodi der baad try karein.");
      setViewMode(isAsliAvailable ? "asli" : "text");
    } finally { setAiCleaning(false); }
  };
  const [playing,  setPlaying]  = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try { const n = parseInt(localStorage.getItem("saarthi_reader_font") || "16"); return (Number.isFinite(n) && n >= 13 && n <= 24) ? n : 16; } catch { return 16; }
  });
  const scrollRef = useRef(null);

  const changeSize = (delta) => {
    setFontSize(prev => {
      const next = Math.min(24, Math.max(13, prev + delta));
      try { localStorage.setItem("saarthi_reader_font", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    markRead(book.id, ch.n);
    scrollRef.current?.scrollTo(0, 0);
    // Chapter badalte hi purane chapter ka audio poora band karo — warna
    // Ch.2 padhte waqt Ch.1 ki awaaz background mein chalti reh jaati thi.
    AudioEngine.stop();
    setPlaying(false); setPaused(false);
  }, [ch.n, book.id, markRead]); // markRead is stable (useCallback in context)

  // Reader se bahar jaate waqt bhi audio band karo (safety cleanup).
  useEffect(() => () => AudioEngine.stop(), []);

  // FIX (#5 — "resume from last position"): pehle Roko dabate hi poora
  // cancel ho jaata tha — dobara Sunein dabane par shuruaat se bajta tha.
  // Ab pause/resume asli hai: Roko = wahi rok do, Sunein dobara = wahi se
  // aage badho (AudioEngine.pause()/resume() speechSynthesis aur MP3/
  // ElevenLabs <audio> dono ke liye sahi position yaad rakhte hain).
  const togglePlay = () => {
    if (playing) { AudioEngine.pause(); setPlaying(false); setPaused(true); return; }
    if (paused)  { AudioEngine.resume(); setPlaying(true); setPaused(false); return; }
    AudioEngine._stopCallback = () => { setPlaying(false); setPaused(false); };
    AudioEngine.speak(ch.text, {
      onStart: () => { setPlaying(true); setPaused(false); },
      onEnd:   () => { AudioEngine._stopCallback = null; setPlaying(false); setPaused(false); },
    });
  };

  const bm = isBookmarked(book.id, ch.n);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>

      {/* Reader header — two-row layout so title is always readable at 375px */}
      <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
        {/* Row 1: back + title + bookmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button onClick={onBack} style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 10, padding: "5px 11px", cursor: "pointer", color: C.muted, fontSize: F.sm, flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: F.xs, color: C.muted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
            <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Ch.{ch.n} — {ch.title}
            </p>
          </div>
          <button onClick={() => toggleBookmark(book.id, ch.n)} title={bm ? t('readerBookmarkRemove') : t('readerBookmarkAdd')}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: bm ? C.gold : C.faint, padding: "2px 4px", flexShrink: 0 }}>
            {bm ? "★" : "☆"}
          </button>
        </div>
        {/* Row 2: font controls + listen — full width, never truncated */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => changeSize(-1)} aria-label="Decrease font size"
              style={{ width: 32, height: 26, borderRadius: 7, border: `1px solid ${C.border}`, background: "none", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
              A-
            </button>
            <button onClick={() => changeSize(1)} aria-label="Increase font size"
              style={{ width: 32, height: 26, borderRadius: 7, border: `1px solid ${C.border}`, background: "none", color: C.muted, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              A+
            </button>
          </div>
          <span style={{ fontSize: F.xs, color: C.faint }}>{fontSize}px</span>
          {isAsliAvailable && (
            <div style={{ display: "flex", gap: 4, background: C.cream, borderRadius: 20, padding: 3, flexShrink: 0 }}>
              {[["asli", t('readerModeAsli')], ["text", t('readerModeText')], ["saral", t('readerModeSaral')]].map(([mId, mLabel]) => (
                <button key={mId}
                  onClick={() => { if (mId === "saral") runAiClean(); else setViewMode(mId); }}
                  style={{ border: "none", borderRadius: 17, padding: "5px 12px", cursor: "pointer", fontSize: F.sm, fontWeight: 700,
                           background: viewMode === mId ? C.white : "transparent",
                           color: viewMode === mId ? C.saffron : C.muted,
                           boxShadow: viewMode === mId ? "0 1px 4px rgba(0,0,0,0.12)" : "none" }}>
                  {mId === "saral" && aiCleaning ? "✨ …" : mLabel}
                </button>
              ))}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={togglePlay}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", borderRadius: 18, border: `1px solid ${(playing || paused) ? C.saffron : C.border}`, background: (playing || paused) ? C.goldBg : "transparent", color: (playing || paused) ? C.saffron : C.muted, cursor: "pointer", fontSize: F.sm, fontWeight: 600, flexShrink: 0 }}>
            {playing ? t('stopBtn') : paused ? t('resumeBtn') : t('listenBtn')}
          </button>
        </div>
      </div>

      {/* Wave when playing */}
      {playing && (
        <div style={{ padding: "8px 18px", background: C.goldBg, borderBottom: `1px solid ${C.goldBdr}50`, display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 2.5, height: 18, alignItems: "center" }}>
            {Array.from({length: 16}, (_, i) => (
              <div key={i} style={{ width: 3, borderRadius: 2, background: C.saffron, minHeight: 3, transformOrigin: "bottom", animation: `wave ${0.5+i%3*0.13}s ease-in-out ${i*0.04}s infinite` }} />
            ))}
          </div>
          <span style={{ fontSize: F.sm, color: C.saffron, fontWeight: 600 }}>
            {HAS_EL ? `ElevenLabs · ${t('readingAloud')}` : t('readingAloud')}
          </span>
        </div>
      )}

      {/* Chapter content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "28px 22px 48px" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <h1 style={{ ...serif, fontSize: F.xxl, fontWeight: 400, color: C.ink, margin: "0 0 6px", lineHeight: 1.25, letterSpacing: -0.3 }}>{ch.title}</h1>
          <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 28px", paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
            {ch.pageStart != null ? ch.title : `${t('chapterWord')} ${ch.n}`} · {book.title}
          </p>
          {/* OCR quality notice for scanned-image books */}
          {ch.fromEngine && (() => {
            const text = ch.text || "";
            const devaChars = (text.match(/[\u0900-\u097F]/g) || []).length;
            const totalChars = text.replace(/\s/g,"").length;
            const devaRatio = totalChars > 0 ? devaChars / totalChars : 0;
            if (devaRatio < 0.4 && totalChars > 50) {
              return (
                <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:12, padding:"10px 14px", marginBottom:20 }}>
                  <p style={{ fontSize:F.xs+1, color:"#92400E", margin:0 }}>
                    ⚠️ <strong>OCR quality:</strong> This page was scanned from a printed book. Hindi text may contain recognition errors. Full corpus ingestion will improve quality.
                  </p>
                </div>
              );
            }
            return null;
          })()}
          {viewMode === "asli" && isAsliAvailable ? (
            <iframe
              title={`${book.title} — ${ch.title || "asli kitab"}`}
              src={`/books/${book.id}.pdf#page=${(ch.pdfPage || ch.pageStart || 0) + 1}`}
              // "PDF dim/blurry lagti hai" complaint ka halka fix — browser ka
              // apna PDF viewer poori tarah control nahi hota, par ek halki
              // brightness/contrast boost padhne mein saaf-sutha farak daalti hai.
              style={{ width: "100%", height: "78vh", border: `1px solid ${C.border}`, borderRadius: 14, background: "#525659", filter: "brightness(1.07) contrast(1.05)" }}
            />
          ) : viewMode === "saral" ? (
            <>
              {aiCleaning && (
                <div style={{ background: C.goldBg, border: `1px solid ${C.goldBdr}`, borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: F.sm, color: C.gold, margin: 0 }}>✨ AI poora bhaag saaf kar raha hai — lambe bhaag mein 30-60 second lag sakte hain…</p>
                </div>
              )}
              {aiClean && (
                <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "8px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: F.xs + 1, color: "#166534", margin: 0 }}>✨ AI dwara saaf kiya gaya paath</p>
                </div>
              )}
              <Prose text={aiClean || (aiCleaning ? "" : ch.text)} size={fontSize} scripture />
            </>
          ) : (
            <Prose text={ch.text} size={fontSize} scripture />
          )}
        </div>
      </div>
    </div>
  );
}

function BookDetail({ book, onBack, getChapters, getChapterChunks, getBookChunks, knowledgeReady }) {
  const t = useT();
  const { uiLang } = useUiLang();
  const en = uiLang === "en";   // shrey-line (edition/संस्करण) ke liye
  const { markRead, toggleBookmark, isBookmarked, lastChapter } = useBookProgress();
  const [chapter, setChapter] = useState(null);
  const last = lastChapter(book.id);

  // "भाग" system: OCR ke bhrosemand chapter-headers nahi hote (kisi book mein
  // 0, kisi mein 311 nikle) — isliye har book ko saaf 50-page bhaagon mein
  // baanto: "भाग 1 · पृष्ठ 1–50". Naam hamesha proper, navigation predictable.
  const allChunks = (knowledgeReady && book.fromEngine && getBookChunks)
    ? (getBookChunks(book.id) || [])
    : [];
  const engineChapters = React.useMemo(() => {
    if (!allChunks.length) return [];
    const pages = allChunks.map(c => c.page || 0);
    const minP = Math.min(...pages), maxP = Math.max(...pages);
    const parts = [];
    let n = 1;
    for (let start = minP; start <= maxP; start += PART_SIZE) {
      const end = Math.min(start + PART_SIZE - 1, maxP);
      parts.push({ chapter: n, title: `भाग ${n} · पृष्ठ ${start + 1}–${end + 1}`,
                   pageStart: start, pageEnd: end });
      n++;
    }
    return parts;
  }, [allChunks]);

  // Build chapter list: prefer engine (real OCR text), fall back to static
  const displayChapters = engineChapters.length > 0
    ? engineChapters.map(ec => ({
        n:          ec.chapter,
        title:      ec.title,
        text:       null,
        fromEngine: true,
        pageStart:  ec.pageStart,
        pageEnd:    ec.pageEnd,
      }))
    : (book.chapters || []);

  // When chapter is opened, get real text from engine if available
  const openChapter = useCallback((ch) => {
    if (ch.fromEngine && allChunks.length) {
      const inRange = allChunks
        .filter(c => (c.page || 0) >= ch.pageStart && (c.page || 0) <= ch.pageEnd)
        .sort((x, y) => (x.page || 0) - (y.page || 0));
      const fullText = inRange.map(c => c.text).join("\n\n");
      setChapter({ ...ch, text: fullText || `भाग ${ch.n} ka paath uplabdh nahi.`, pdfPage: ch.pageStart });
    } else {
      setChapter(ch);
    }
  }, [book.id, allChunks]);

  if (chapter) return (
    <ChapterReader book={book} ch={chapter} onBack={() => setChapter(null)}
      markRead={markRead} isBookmarked={isBookmarked} toggleBookmark={toggleBookmark} />
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
      <div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
        <button onClick={onBack} style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 10, padding: "6px 13px", cursor: "pointer", color: C.muted, fontSize: F.sm }}>
          ← {t('libraryBackLabel')}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {book.icon} {book.title}
          </p>
          <p style={{ fontSize: F.xs + 1, color: C.muted, margin: 0 }}>{book.lang}</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Book hero */}
        <div style={{ padding: "20px 18px 18px", background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 15, alignItems: "flex-start" }}>
            <div style={{ width: 62, height: 62, borderRadius: 18, background: `${book.color}14`, border: `2px solid ${book.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{book.icon}</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: F.lg + 1, fontWeight: 700, color: C.ink, margin: "0 0 4px" }}>{book.title}</h2>
              <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 8px" }}>{book.subtitle} · {book.totalChapters} chapters</p>
              <p style={{ fontSize: F.base, color: C.body, lineHeight: 1.65, margin: 0 }}>{book.description}</p>
              {/* SHREY (2026-08-03) — is sanskaran ka prakashak/anuvaadak.
                  Mool granth public domain hai, par yeh ANUVAAD/TEEKA unki
                  apni rachna hai. Bharat ka fair dealing (Sec 52) source ke
                  ullekh ki maang karta hai — isliye yeh dikhta hai. */}
              {book.source && (
                <p style={{ fontSize: F.xs, color: C.muted, lineHeight: 1.5, margin: "8px 0 0", fontStyle: "italic" }}>
                  {en ? "Edition: " : "संस्करण: "}{en ? (book.sourceEn || book.source) : book.source}
                </p>
              )}
            </div>
          </div>

          {/* Continue reading */}
          {last > 0 && last < displayChapters.length && (
            <button onClick={() => openChapter(displayChapters[last])}
              style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 14px", borderRadius: 12, border: `1px solid ${book.color}40`, background: `${book.color}08`, width: "100%", cursor: "pointer", textAlign: "left", transition: "all 0.18s" }}>
              <span style={{ fontSize: 20 }}>▶</span>
              <div>
                <p style={{ fontSize: F.xs + 1, color: book.color, fontWeight: 700, margin: "0 0 2px" }}>{t('libraryContinueReading')}</p>
                <p style={{ fontSize: F.sm, color: C.body, margin: 0 }}>{t('chapterWord')} {last + 1}: {displayChapters[last]?.title}</p>
              </div>
            </button>
          )}
        </div>

        {/* Chapter list */}
        <div style={{ padding: "16px 18px 32px" }}>
          <p style={{ fontSize: F.xs + 1, color: C.muted, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 12px" }}>
            {t('libraryAllChapters')}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {displayChapters.map(ch => {
              const done = ch.n <= last;
              const bm   = isBookmarked(book.id, ch.n);
              return (
                <ChapterRow key={ch.n} ch={ch} color={book.color} done={done} bookmarked={bm} onClick={() => openChapter(ch)} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterRow({ ch, color, done, bookmarked, onClick }) {
  const [hov, setHov] = useState(false);
  const preview = (ch.text || "").replace(/[*#`_>[\]|]/g, "").replace(/\s+/g, " ").slice(0, 72);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderRadius: 14, border: `1px solid ${hov ? color+"45" : C.border}`, background: hov ? `${color}06` : C.white, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.18s", boxShadow: hov ? C.shadowMd : C.shadow }}>
      <div style={{ width: 33, height: 33, borderRadius: 10, background: done ? `${color}20` : `${color}0D`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: F.sm, fontWeight: 700, color: done ? color : C.muted, flexShrink: 0 }}>
        {done ? "✓" : ch.n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: F.base, fontWeight: 600, color: C.ink, margin: "0 0 3px" }}>{ch.title}</p>
        <p style={{ fontSize: F.xs + 1, color: C.muted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}…</p>
      </div>
      {bookmarked && <span style={{ color: C.gold, fontSize: 16, flexShrink: 0 }}>★</span>}
      <span style={{ color: C.faint, fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}


const PART_SIZE = 50; // पृष्ठ प्रति भाग


// ── SIMPLE BOOK READER: click book → POORI asli kitab, seedha. Bas. ─────────
// FIX (#4 cross-check): yeh ACTUAL viewer hai jo sabhi 24 books ke liye
// istemal hota hai (HAS_PDF sab 24 ko cover karta hai) — pehle isme na koi
// loading-feedback thi (bade PDF par blank safed screen "atka hua" jaisa
// lagta tha) na hi brightness/contrast filter (woh sirf purane, ab-mritprayah
// ChapterReader wale PDF-mode iframe par tha, jo is book-set ke liye kabhi
// istemal hi nahi hota). Dono yahan jode:
function BookPdfView({ book, onBack }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); }, [book.id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: F.base, fontWeight: 600, color: C.ink }}>
          ←
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: F.lg, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {book.icon} {book.title}
          </p>
          {book.subtitle && <p style={{ margin: 0, fontSize: F.xs, color: C.muted }}>{book.subtitle}</p>}
        </div>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 12, background: C.cream, zIndex: 2 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", border: `3px solid ${C.border}`,
                          borderTopColor: C.saffron, animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, fontSize: F.sm, color: C.muted, fontWeight: 600 }}>
              {t('bookPdfLoading') || "पुस्तक लोड हो रही है…"}
            </p>
          </div>
        )}
        <iframe
          key={book.id}
          title={book.title}
          src={`/books/${book.id}.pdf`}
          onLoad={() => setLoading(false)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", border: "none",
            background: "#525659",
            // #4: pehle se zyada readable — brightness/contrast dono badhaye
            filter: "brightness(1.16) contrast(1.1)",
          }}
        />
      </div>
    </div>
  );
}

export function BooksView() {
  const t = useT();
  const [book,   setBook]   = useState(null);
  const [search, setSearch] = useState("");
  const { lastChapter } = useBookProgress();
  const { ready: knowledgeReady, getBooks: getEngineBooks, getChapters: getEngineChapters,
          getBookChunks, getChapterChunks, hybridSearch } = useKnowledge();

  // PURANA SEEDHA ANDAZ (user ki pasand): naam dabao → poori ASLI PDF khule —
  // jaise pehli 13 books mein tha. Ab sab 24 PDFs host hain (badi 3 compressed).
  // Suraksha: agar kisi book ki PDF na ho (HAS_PDF mein nahi), toh 404-blank
  // ki jagah text-reader khulega.
  if (book) return book.fromEngine && HAS_PDF.has(book.id)
    ? <BookPdfView book={book} onBack={() => setBook(null)} />
    : <BookDetail book={book} onBack={() => setBook(null)}
                  getChapters={getEngineChapters} getChapterChunks={getChapterChunks}
                  getBookChunks={getBookChunks}
                  knowledgeReady={knowledgeReady} />;

  // Merge knowledge engine books with static BOOKS for display metadata
  // Engine books have real extracted chunks; static BOOKS have icons, colors, descriptions
  const staticById = Object.fromEntries(BOOKS.map(b => [b.id, b]));

  // Build display list: prefer engine books (real data), supplement with static
  let displayBooks;
  if (knowledgeReady) {
    const engineBooks = getEngineBooks();
    // Map engine book_ids to static metadata where available
    const TRADITION_MAP = {
      gita: BOOKS.find(b => b.id === "gita"),
      ramayana: BOOKS.find(b => b.id === "ramayan"),
      veda: BOOKS.find(b => b.id === "vedas"),
      sikhism: BOOKS.find(b => b.id === "granth"),
      purana: null,
    };
    // SIRF uploaded 13 books — curated Hindi/English naam, koi OCR-title nahi,
    // koi purani static duplicate nahi.
    displayBooks = engineBooks.map(eb => {
      const m = BOOK_META[eb.id] || {};
      return {
        id:           eb.id,
        title:        m.title || eb.title,
        titleEn:      m.en    || eb.title,
        tradition:    eb.tradition,
        chunkCount:   eb.chunkCount,
        fromEngine:   true,
        icon:         m.icon  || "📖",
        color:        C.saffron,
        subtitle:     m.en    || eb.tradition,
        lang:         "Hindi / Sanskrit",
        description:  m.sub   || "",
        // SHREY (2026-08-03): is sanskaran ka prakashak/anuvaadak. Bharat ke
        // fair dealing (Copyright Act Sec 52) ki shart hi source ka ullekh
        // hai — isliye yeh chhupane ki nahi, DIKHANE ki cheez hai.
        source:       m.src   || "",
        sourceEn:     m.srcEn || "",
        totalChapters: null,
      };
    });
    // Order (Saurabh ka bataya hua): Ramayan → Gita → chaaron Ved → sab Puran
    const ID_ORDER = [
      "valmiki_ramayana", "bhagavad_gita_shankar",
      "rigveda_1", "samaveda", "yajurveda", "atharvaveda_1",
      "shiva_purana_1", "shiva_purana_2", "vishnu_purana_1", "garuda_purana_1",
      "narasimha_purana", "bhavishya_purana", "agni_purana",
    ];
    displayBooks.sort((x, y) => {
      const ox = ID_ORDER.indexOf(x.id), oy = ID_ORDER.indexOf(y.id);
      return (ox === -1 ? 99 : ox) - (oy === -1 ? 99 : oy);
    });
  } else {
    // Engine not loaded yet — fall back to static data
    displayBooks = BOOKS.map(b => ({ ...b, fromEngine: false }));
  }

  const filtered = search
    ? displayBooks.filter(b =>
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.tradition?.toLowerCase().includes(search.toLowerCase()))
    : displayBooks;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.cream }}>
      <div style={{ padding: "20px 18px 14px", background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontSize: F.xl + 2, fontWeight: 800, color: C.ink, margin: "0 0 4px", letterSpacing: -0.4 }}>{t('libraryTitle')}</h1>
        <p style={{ fontSize: F.base, color: C.muted, margin: "0 0 4px" }}>{t('librarySubtitle')}</p>
        <p style={{ fontSize: F.xs+1, color: C.faint, margin: "0 0 14px" }}>{knowledgeReady ? t('libraryReady') : t('libraryLoading')}</p>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: C.faint, pointerEvents: "none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('librarySearchPlaceholder')}
            style={{ width: "100%", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 13, padding: "10px 14px 10px 37px", fontSize: F.base, color: C.ink, outline: "none", boxSizing: "border-box", transition: "border-color 0.18s" }}
            onFocus={e => e.target.style.borderColor = C.saffron}
            onBlur={e  => e.target.style.borderColor = C.border} />
        </div>
      </div>

      <div style={{ padding: "14px 18px 32px", display: "grid", gap: 12 }}>
        {filtered.map(b => <BookCard key={b.id} book={b} progress={lastChapter(b.id)} onClick={() => setBook(b)} />)}
        {!filtered.length && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>📚</p>
            <p style={{ color: C.muted }}>{t('libraryNoMatch').replace('{q}', search)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BookCard({ book, progress, onClick }) {
  const [hov, setHov] = useState(false);
  const totalCh = book.totalChapters || 0;
  const pct = totalCh > 0 ? Math.round((progress / totalCh) * 100) : 0;
  // Badge: chapters if known, else chunk count for engine books
  const badge = totalCh > 0
    ? `${totalCh} ch`
    : book.chunkCount > 0
      ? `${book.chunkCount} passages`
      : null;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", gap: 15, alignItems: "center", padding: "18px", borderRadius: 18, border: `1px solid ${hov ? book.color+"45" : C.border}`, background: hov ? `${book.color}05` : C.white, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.22s", transform: hov ? "translateY(-2px)" : "none", boxShadow: hov ? C.shadowMd : C.shadow }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: `${book.color}12`, border: `2px solid ${book.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{book.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <p style={{ fontSize: F.md, fontWeight: 700, color: C.ink, margin: 0 }}>{book.title}</p>
          {badge && <span style={{ fontSize: F.xs, background: `${book.color}14`, color: book.color, borderRadius: 20, padding: "2px 9px", fontWeight: 700, flexShrink: 0 }}>{badge}</span>}
          {book.fromEngine && <span style={{ fontSize: F.xs - 1, background: "#E8F5E9", color: "#2E7D32", borderRadius: 20, padding: "2px 8px", fontWeight: 600, flexShrink: 0 }}>✓ Indexed</span>}
        </div>
        <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 6px" }}>{book.subtitle}</p>
        <p style={{ fontSize: F.base, color: C.body, margin: "0 0 8px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.55 }}>{book.description}</p>
        {pct > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: book.color, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: F.xs, color: C.muted, flexShrink: 0 }}>{pct}% read</span>
          </div>
        )}
      </div>
      <span style={{ color: C.faint, fontSize: 20, flexShrink: 0 }}>›</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3b — GLOBAL SEARCH
// ─────────────────────────────────────────────────────────────────────────────

