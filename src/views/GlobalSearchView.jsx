/**
 * SAARTHI — Global semantic search view (GlobalSearchView, SearchResultCard)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useKnowledge } from "@/hooks/useKnowledge";
import { explainSearchTerm, hasApiKey } from "@/services/gemini";
import { useT, useUiLang } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { featureQuotaLeft, featureQuotaUse, SEARCH_QUOTA_LIMIT, serverQuotaConsume, syncLocalQuotaFromServer } from "@/services/quota";
import { C, F, HAS_PDF } from "@/styles/theme";
import { Prose, cleanOcrText } from "@/components/ui/Primitives";
import { QuotaPill } from "@/views/AuthWidgets";

export function GlobalSearchView({ onNav, active = false }) {
  const t = useT();
  const { uiLang } = useUiLang();
  const { profile } = useAuth();
  const { ready, hybridSearch, crossBookSearch } = useKnowledge({ load: active });
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]); // SearchResult[]
  const [mode,    setMode]    = useState("cross"); // "cross" | "single"
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  // ✨ Saral Arth: on-demand simple explanation of the searched term
  const [arth, setArth]           = useState(null);
  const [arthBusy, setArthBusy]   = useState(false);
  const [showSources, setShowSources] = useState(false);
  const arthForRef = useRef("");
  useEffect(() => { setArth(null); setShowSources(false); }, [query]);
  // Search thamte hi NISHKARSH apne aap banta hai — user ko button nahi dabana
  useEffect(() => {
    const q = query.trim();
    if (!q || results.length === 0 || !hasApiKey()) return;
    if (arth || arthBusy || arthForRef.current === q) return;
    const t = setTimeout(() => { arthForRef.current = q; runArth(); }, 700);
    return () => clearTimeout(t);
  }, [query, results, arth, arthBusy]);
  const runArth = async () => {
    if (!hasApiKey()) { alert("Saral Arth ke liye API key chahiye (Groq gsk_ key)."); return; }
    // Item #12: raw search (doSearch) hamesha free/unlimited hai — sirf yeh
    // AI-generated "Nishkarsh" (Saral Arth) apni alag quota se kharch hota
    // hai: 5/din free, owner/paid ke liye unlimited.
    // ITEM #2 (server-side): asli gate ab Worker se — localStorage sirf
    // fallback (proxy configured na ho, jaise local dev, tab hi use hota hai).
    const preQ = await serverQuotaConsume("search");
    if (preQ) {
      if (!preQ.allowed) {
        setArth(t('searchConclusionQuotaOver') || "Aaj ka mufta AI-kota poora ho gaya — kal fir try karein. Khoj (search) bina rukawat chalti rahegi.");
        return;
      }
      syncLocalQuotaFromServer("search", preQ.limit, preQ.remaining);
    } else if (featureQuotaLeft("search", SEARCH_QUOTA_LIMIT, profile) <= 0) {
      setArth(t('searchConclusionQuotaOver') || "Aaj ka mufta AI-kota poora ho gaya — kal fir try karein. Khoj (search) bina rukawat chalti rahegi.");
      return;
    }
    setArthBusy(true);
    try {
      // BUG FIX (#3 cross-check): pehle yahan sirf results.slice(0,3) tha —
      // KOI per-book diversity cap nahi thi, isliye agar top-3 raw score wale
      // sabhi ek hi granth ke ho, toh Nishkarsh sirf USI ek granth se banta
      // tha. Ask (ChatView) mein VIVIDHTA-CAP pehle se hai, yahan nahi thi —
      // yahi asli wajah thi "hamesha same book" wali shikayat ka (kam se kam
      // is Search-Nishkarsh wale hisse mein). Ab wahi 2-per-book cap yahan
      // bhi — top passages se hi kam se kam 2-3 alag granth milenge.
      const perBookCount = new Map();
      const diverseResults = [];
      for (const r of results) {
        const b = r.chunk.book;
        const c = perBookCount.get(b) || 0;
        if (c >= 1) continue; // Search mein sirf 3 passages hote hain — 1/book zyada vividh
        perBookCount.set(b, c + 1);
        diverseResults.push(r);
        if (diverseResults.length >= 3) break;
      }
      // Agar 3 alag granth na milein (kam matches), baaki top results se bhar do
      if (diverseResults.length < 3) {
        for (const r of results) {
          if (diverseResults.includes(r)) continue;
          diverseResults.push(r);
          if (diverseResults.length >= 3) break;
        }
      }
      // PRAMAAN-FIX: granth ka naam+page saath bhejo taaki nishkarsh cite kar sake
      const passages = diverseResults.map(r => ({
        label: `${r.chunk.book_title || r.chunk.book}${r.chunk.page != null ? ` (p.${r.chunk.page})` : ""}`,
        text:  r.chunk.text,
      }));
      setArth(await explainSearchTerm(query, passages));
      // Server ne (preQ truthy hone par) upar hi consume kar diya tha —
      // sirf fallback path (proxy na ho) mein local counter badhao.
      if (!preQ) featureQuotaUse("search", SEARCH_QUOTA_LIMIT, profile);
    } catch (e) {
      alert("AI abhi jawab nahi de paya — thodi der baad try karein.");
    } finally { setArthBusy(false); }
  };

  const doSearch = useCallback(async (q) => {
    if (!q.trim() || !ready) { setResults([]); return; }
    setLoading(true);
    try {
      // 1. Cross-book: top 4 per book across all traditions
      const cross = crossBookSearch(q, null, 4);
      const crossFlat = cross.flatMap(b =>
        b.results.map(r => ({ ...r, bookTitle: b.title }))
      );
      // 2. Keyword: inverted-index, top 20
      const kwFlat = hybridSearch(q, null, {}, 20)
        .map(r => ({ ...r, bookTitle: r.chunk.book_title }));
      // 3. Deduplicate by chunk ID, higher score wins
      const byId = new Map();
      for (const r of [...crossFlat, ...kwFlat]) {
        const ex = byId.get(r.chunk.id);
        if (!ex || r.score > ex.score) byId.set(r.chunk.id, r);
      }
      // 4. Sort by score, cap at 30
      // Fewer, better results — 10 max keeps the page scannable
      const merged = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 10);
      setResults(merged);
    } catch (e) {
      console.error("[Search]", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [ready, crossBookSearch, hybridSearch]);

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 380);
  };

  // Group results by book
  const grouped = {};
  for (const r of results) {
    const key = r.chunk.book_title;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.cream }}>
      {/* Header */}
      <div style={{ padding: "16px 18px 12px", background: C.white, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <h1 style={{ fontSize: F.xl + 2, fontWeight: 800, color: C.ink, margin: "0 0 4px", letterSpacing: -0.4 }}>{t('searchTitle')}</h1>
        <p style={{ fontSize: F.base, color: C.muted, margin: "0 0 4px" }}>
          {t('searchSubtitle')}
        </p>
        <p style={{ fontSize: F.xs+1, color: C.faint, margin: "0 0 12px" }}>
          {ready ? t('searchReady') : t('searchLoading')}
        </p>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
          <input
            value={query}
            onChange={handleInput}
            placeholder={t('searchPlaceholder')}
            autoFocus
            style={{ width: "100%", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: "11px 14px 11px 40px", fontSize: F.base, color: C.ink, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = C.saffron}
            onBlur={e  => e.target.style.borderColor = C.border}
          />
          {loading && (
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 3 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.saffron, animation: `typingDot 1s ease ${i*0.15}s infinite` }} />)}
            </div>
          )}
        </div>
        {!ready && (
          <p style={{ fontSize: F.xs + 1, color: C.muted, margin: "8px 0 0", background: "#FFFBEB", padding: "6px 10px", borderRadius: 8, border: "1px solid #FDE68A" }}>
            ⏳ Knowledge engine loading… keyword search activates once ready.
          </p>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 32px" }}>
        {query.trim() && results.length > 0 && (
          <div style={{ background: C.white, border: `1.5px solid ${C.goldBdr}`, borderRadius: 16, padding: "16px 18px", marginBottom: 14, boxShadow: C.shadow }}>
            <p style={{ fontSize: F.xs, color: C.saffron, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px" }}>{t('searchConclusionLabel')}</p>
            <div style={{ margin: "0 0 8px" }}>
              <QuotaPill left={featureQuotaLeft("search", SEARCH_QUOTA_LIMIT, profile)} uiLang={uiLang}
                labelHi="आज बचे मुफ़्त निष्कर्ष" labelEn="Free Nishkarsh left today" />
            </div>
            {arthBusy && !arth && (
              <p style={{ fontSize: F.base, color: C.muted, margin: 0 }}>{t('searchConclusionLoading')}</p>
            )}
            {arth && <Prose text={arth} size={F.base} />}
            {!arth && !arthBusy && (
              <p style={{ fontSize: F.sm, color: C.faint, margin: 0 }}>{t('searchConclusionNoKey')}</p>
            )}
          </div>
        )}
        {query.trim() && results.length > 0 && (
          <button onClick={() => setShowSources(v => !v)}
            style={{ display: "block", width: "100%", textAlign: "center", border: `1px dashed ${C.border}`, background: "transparent", borderRadius: 12, padding: "9px", cursor: "pointer", color: C.muted, fontSize: F.sm, fontWeight: 600, marginBottom: 14 }}>
            {showSources ? t('searchSourcesHide') : t('searchSourcesShow').replace('{n}', results.length)}
          </button>
        )}
        {!query.trim() && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🕉️</p>
            <p style={{ fontSize: F.md, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{t('searchEmptyTitle')}</p>
            <p style={{ fontSize: F.base, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
              {t('searchEmptyDesc')}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {["Dharma", "Karma", "Moksha", "Fear", "Anger", "Love", "Death", "Mind", "Ego"].map(s => (
                <button key={s} onClick={() => { setQuery(s); doSearch(s); }}
                  style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontSize: F.sm, cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {query.trim() && results.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📖</p>
            <p style={{ color: C.muted, fontSize: F.base }}>{t('searchNoResults').replace('{q}', query)}</p>
            <p style={{ color: C.faint, fontSize: F.sm, marginTop: 8 }}>
              {ready ? t('searchNoResultsHintReady') : t('searchNoResultsHintLoading')}
            </p>
          </div>
        )}

        {showSources && Object.entries(grouped).map(([bookTitle, bookResults]) => (
          <div key={bookTitle} style={{ marginBottom: 24 }}>
            <p style={{ fontSize: F.xs + 1, fontWeight: 700, color: C.saffron, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 10px", paddingLeft: 2 }}>
              📚 {bookTitle}
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {bookResults.map(r => (
                <SearchResultCard key={r.chunk.id} result={r} query={query} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchResultCard({ result, query }) {
  const { chunk, score, match_type } = result;
  const [expanded, setExpanded] = useState(false);

  // Highlight query terms in text
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const highlightText = (text) => {
    if (!keywords.length) return text;
    const parts = text.split(new RegExp(`(${keywords.join("|")})`, "gi"));
    return parts.map((p, i) =>
      keywords.some(k => p.toLowerCase() === k)
        ? <mark key={i} style={{ background: "#FEF9C3", borderRadius: 2, padding: "0 2px" }}>{p}</mark>
        : p
    );
  };

  const cleaned = cleanOcrText(chunk.text);
  const preview = cleaned.slice(0, expanded ? 600 : 180);

  return (
    <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px 16px", boxShadow: C.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div>
          {chunk.chapter && (
            <span style={{ fontSize: F.xs, color: C.saffron, fontWeight: 700 }}>
              Ch.{chunk.chapter}{chunk.chapter_title ? ` · ${chunk.chapter_title}` : ""}
            </span>
          )}
          {chunk.verse && <span style={{ fontSize: F.xs, color: C.muted }}> · Verse {chunk.verse}</span>}
          {/* ⚠️ 17 Aug: ye PDF-link HAS_PDF ke peeche hai. PDF ab web par
              parosi nahi jaati (kanooni wajah — featureFlags.js ka
              PDF_PAROSO dekhein), aur us haal me HAS_PDF khaali hota hai.
              Bina is pehre ke ye link 404 par le jaata — aur toota link
              us bharose ko kaatta hai jo poori app kamane ki koshish
              karti hai. */}
          {HAS_PDF.has(chunk.book) && (
            <a href={`/books/${chunk.book}.pdf#page=${(chunk.page || 0) + 1}`} target="_blank" rel="noopener noreferrer"
               onClick={e => e.stopPropagation()}
               style={{ fontSize: F.xs, color: C.saffron, fontWeight: 600, textDecoration: "none" }}
               title="Asli kitab ka yeh page kholein"> · 📄 p.{chunk.page}</a>
          )}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
        </div>
      </div>
      <p style={{ fontSize: F.base, color: C.body, lineHeight: 1.75, margin: 0 }}>
        {highlightText(preview)}{!expanded && cleaned.length > 180 ? "…" : ""}
      </p>
      {cleaned.length > 180 && (
        <button onClick={() => setExpanded(!expanded)}
          style={{ border: "none", background: "none", color: C.saffron, fontSize: F.xs + 1, cursor: "pointer", fontWeight: 600, padding: "6px 0 0", display: "block" }}>
          {expanded ? "Show less ▲" : "Read more ▼"}
        </button>
      )}
    </div>
  );
}
