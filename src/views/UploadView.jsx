/**
 * SAARTHI — PDF/Docx upload chat view (UploadView)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { parsePdf } from "@/services/pdfParser";
import { convertDocxToPdf, convertImagesToPdf, isDocxFile, isImageFile } from "@/services/fileConverter";
import { useT, useUiLang } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { isPaidUser } from "@/services/tier";
import { C, F } from "@/styles/theme";
import { SaarthiOrb, Btn, ThinkingBubble } from "@/components/ui/Primitives";
import { ChatMessage } from "@/views/ChatView";

const STUDY_PACK_FREE_HI = [
  { label: "सारांश दीजिए",                    prompt: "इस दस्तावेज़ का संक्षिप्त सारांश दीजिए।" },
  { label: "5 मुख्य बिंदु बताइए",              prompt: "इस दस्तावेज़ के 5 सबसे महत्वपूर्ण बिंदु बताइए (बुलेट में)।" },
  { label: "5 MCQ (उत्तर सहित) बनाइए",          prompt: "इस दस्तावेज़ पर आधारित 5 MCQ प्रश्न बनाइए, उत्तर सहित।" },
];
const STUDY_PACK_FREE_EN = [
  { label: "Give Summary",              prompt: "Give a brief summary of this document." },
  { label: "Give 5 Key Points",         prompt: "Give the 5 most important points from this document (bulleted)." },
  { label: "Give 5 MCQs (with answers)", prompt: "Create 5 MCQ questions based on this document, with answers." },
];
const STUDY_PACK_PAID_HI = [
  { label: "✨ पूरा सारांश (Paid)",        prompt: "इस पूरे दस्तावेज़ का विस्तृत सारांश दीजिए।" },
  { label: "✨ 50 मुख्य बिंदु (Paid)",     prompt: "इस दस्तावेज़ के 50 सबसे महत्वपूर्ण बिंदु बताइए (बुलेट में)। दस्तावेज़ छोटा हो तो जितने सार्थक बन सकें उतने दीजिए।" },
  { label: "✨ 50 MCQ (Paid)",            prompt: "इस दस्तावेज़ पर आधारित 50 MCQ प्रश्न बनाइए, उत्तर सहित। दस्तावेज़ छोटा हो तो जितने सार्थक बन सकें उतने दीजिए।" },
];
const STUDY_PACK_PAID_EN = [
  { label: "✨ Full Summary (Paid)",   prompt: "Give a detailed, full summary of this entire document." },
  { label: "✨ 50 Key Points (Paid)",  prompt: "Give the 50 most important points from this document (bulleted). If the document is short, give as many meaningful points as genuinely fit." },
  { label: "✨ 50 MCQs (Paid)",        prompt: "Create 50 MCQ questions based on this document, with answers. If the document is short, give as many meaningful MCQs as genuinely fit." },
];

const PDF_CHIPS_HI = [
  "इस दस्तावेज़ का पूरा सारांश दीजिए",
  "10 सबसे महत्वपूर्ण बातें बताइए",
  "10 MCQ अभ्यास प्रश्न बनाइए (उत्तर सहित)",
  "मुख्य विचारों को सरल भाषा में समझाइए",
  "सभी अध्यायों के विषय बताइए",
];
const PDF_CHIPS_EN = [
  "Summarize this whole document",
  "Give the 10 most important points",
  "Create 10 MCQ practice questions (with answers)",
  "Explain the main ideas in simple language",
  "List the topics of all chapters",
];

export function UploadView() {
  const t = useT();
  const { uiLang } = useUiLang();
  const { profile } = useAuth();
  const isPaid = isPaidUser(profile);
  const PDF_CHIPS = uiLang === "en" ? PDF_CHIPS_EN : PDF_CHIPS_HI;
  const [pdf,        setPdf]        = useState(null);
  const [parseStage, setParseStage] = useState("");
  const [parsePct,   setParsePct]   = useState(0);
  const [drag,       setDrag]       = useState(false);
  const [input,      setInput]      = useState("");
  const [docView,    setDocView]    = useState(false);
  const fileRef      = useRef(null);
  const taRef        = useRef(null);
  const endRef       = useRef(null);
  // Parse token: each upload increments this. The async parse captures its
  // token at start. If a newer upload starts, the old token is stale and
  // its result is silently discarded — preventing concurrent parse races.
  const parseTokenRef = useRef(0);

  const chat = useChat({ mode: "pdf", pdfText: pdf?.context, pdfName: pdf?.filename });
  const { messages, isLoading, loadPhase, sendUserMessage, retryLast, clearMessages } = chat;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  // FEATURE (#10): ab sirf .pdf nahi — .docx (Word) aur .jpg/.jpeg/.png
  // (photo, ek ya kai saath) bhi chalti hain. Docx/photo pehle browser
  // mein hi asli PDF mein badalte hain (fileConverter.js), phir wahi
  // purani parsePdf() pipeline unhe padhti hai — server kahin nahi jaata.
  const processFiles = async fileListLike => {
    const files = Array.from(fileListLike || []).filter(Boolean);
    if (!files.length) return;
    const first = files[0];

    const looksLikePdf = files.length === 1 &&
      (first.type === "application/pdf" || /\.pdf$/i.test(first.name || ""));
    const allImages = files.every(isImageFile);
    const isDocx    = files.length === 1 && isDocxFile(first);

    if (files.length > 1 && !allImages) {
      alert(uiLang === "en"
        ? "You can only select multiple files when they're all photos (for a multi-page scan). Please upload one file at a time otherwise."
        : "Ek saath kai files SIRF tab chunein jab sab photo ho (multi-page scan ke liye). Warna ek baar mein ek hi file upload karein.");
      return;
    }
    if (!looksLikePdf && !allImages && !isDocx) {
      alert(
        (uiLang === "en"
          ? `This file type isn't supported (got: "${first.name}").\n\nSupported: PDF, Word (.docx), and photos (.jpg/.png).`
          : `Yeh file type support nahi hai ("${first.name}").\n\nChalti hain: PDF, Word (.docx), aur photo (.jpg/.png).`)
      );
      return;
    }
    for (const f of files) {
      if (f.size < 100) {
        alert(uiLang === "en"
          ? `"${f.name}" looks empty or broken (almost 0 KB). Please re-export and try again.`
          : `"${f.name}" khaali ya kharaab lag rahi hai (lagbhag 0 KB). Dobara banakar try karein.`);
        return;
      }
      if (f.size > 50 * 1024 * 1024) {
        alert(uiLang === "en"
          ? `"${f.name}" is too large — the limit is 50 MB.`
          : `"${f.name}" bahut badi hai — seema 50 MB hai.`);
        return;
      }
    }

    // Increment token — any in-progress parse with an older token will discard its result
    const myToken = ++parseTokenRef.current;

    setPdf(null);                        // clear previous doc immediately
    setParsePct(0.02); setParseStage("Starting…");

    const setProgress = (stage, pct) => {
      if (parseTokenRef.current === myToken) { setParseStage(stage); setParsePct(pct); }
    };

    try {
      let pdfFile = first;
      if (allImages) {
        pdfFile = await convertImagesToPdf(files, (stage, pct) => setProgress(stage, pct * 0.35));
      } else if (isDocx) {
        pdfFile = await convertDocxToPdf(first, (stage, pct) => setProgress(stage, pct * 0.35));
      }

      const doc = await parsePdf(pdfFile, (stage, pct) => {
        // Convert hua tha toh 35-100% range, warna poora 0-100%
        setProgress(stage, (allImages || isDocx) ? 0.35 + pct * 0.65 : pct);
      });

      // Discard result if a newer upload started while this one was running
      if (parseTokenRef.current !== myToken) return;

      setPdf(doc);
    } catch (err) {
      if (parseTokenRef.current !== myToken) return; // stale — discard error too
      console.error("[Saarthi PDF]", err);
      // BUG FIX: pehle yeh HAMESHA "scanned photo PDF" wala generic message
      // dikhata tha, chahe asli wajah kuch bhi ho (password-lock, corrupt
      // file, ya CDN/internet fail). Ab pdfParser.js ka asli, sahi error
      // dikhaya jaata hai — password/corrupt/scanned sab alag-alag saaf
      // salah dete hain. Network/CDN wali fail par retry-hint bhi jodi.
      const msg = (err && err.message) ? err.message : "";
      const isNetworkIssue = /engine|script|cdn|timed out|internet/i.test(msg);
      alert(
        "❌ " + (msg || "Yeh file nahi padh paya. Dobara try karein.") +
        (isNetworkIssue ? "\n\n🔁 Internet connection check karke dobara try karein." : "")
      );
    } finally {
      if (parseTokenRef.current === myToken) {
        setParsePct(0); setParseStage("");
      }
    }
  };

  // FIX: parsing screen par pehle koi escape nahi tha — CDN slow ho ya PDF
  // atki reh jaaye toh user hamesha ke liye "PDF parsing…" par phansa reh
  // jaata tha, reload karne ke alawa koi chaara nahi tha. Ab Cancel se turant
  // upload screen par wapas ja sakte hain aur dusri file try kar sakte hain.
  const cancelParse = () => {
    parseTokenRef.current++;              // in-flight result/error ab stale maana jayega
    setParsePct(0);
    setParseStage("");
  };

  const send = () => {
    const q = input.trim(); if (!q || isLoading) return;
    setInput(""); if (taRef.current) { taRef.current.style.height = "auto"; }
    sendUserMessage(q);
  };
  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const autoSize = () => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; };
  const phaseLabels = { thinking: "Reading document…", writing: "Writing answer…", retrying: "Preparing response…", fallback: "Generating response…" };

  // ── Upload screen ──────────────────────────────────────────────────────────
  if (!pdf && !parseStage) return (
    <div style={{ flex: 1, overflowY: "auto", background: C.cream }}>
      <div style={{ padding: "20px 18px 14px", background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontSize: F.xl + 2, fontWeight: 800, color: C.ink, margin: "0 0 4px", letterSpacing: -0.4 }}>{t('pdfTitle')}</h1>
        <p style={{ fontSize: F.base, color: C.muted, margin:"0 0 2px" }}>{t('pdfSubtitle')}</p>
        <p style={{ fontSize: F.xs+1, color: C.faint, margin: 0 }}>{t('pdfSubtitle2')}</p>
      </div>
      <div style={{ padding: "18px 18px 24px" }}>
        <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); processFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${drag ? C.saffron : C.borderMd}`, borderRadius: 20, padding: "44px 24px", textAlign: "center", cursor: "pointer", background: drag ? C.goldBg : C.white, transition: "all 0.22s", marginBottom: 18, boxShadow: C.shadow }}>
          <p style={{ fontSize: 50, margin: "0 0 14px" }}>📄</p>
          <p style={{ fontSize: F.md + 1, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>{t('pdfDropTitle')}</p>
          <p style={{ fontSize: F.base, color: C.muted, margin: "0 0 20px" }}>{t('pdfDropOr')}</p>
          <Btn variant="primary" size="md" onClick={() => {}}>{t('pdfChooseBtn')}</Btn>
          <p style={{ fontSize: F.xs, color: C.faint, margin: "10px 0 0" }}>{t('pdfFormatsHint')}</p>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" multiple style={{ display: "none" }} onChange={e => processFiles(e.target.files)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[["💬",t('pdfFeature1Title'),t('pdfFeature1Desc')],["📝",t('pdfFeature2Title'),t('pdfFeature2Desc')],["❓",t('pdfFeature3Title'),t('pdfFeature3Desc')],["🔍",t('pdfFeature4Title'),t('pdfFeature4Desc')]].map(([ic,ft,fd]) => (
            <div key={ft} style={{ padding: "14px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.white, boxShadow: C.shadow }}>
              <span style={{ fontSize: 22, display: "block", marginBottom: 7 }}>{ic}</span>
              <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: "0 0 3px" }}>{ft}</p>
              <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.5 }}>{fd}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Parsing progress screen ────────────────────────────────────────────────
  if (parseStage) return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.cream, padding: "32px 24px", textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: C.goldBg, border: `2px solid ${C.goldBdr}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, marginBottom: 20 }}>📖</div>
      <h2 style={{ fontSize: F.lg, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>{t('pdfParsing')}</h2>
      <p style={{ fontSize: F.base, color: C.muted, margin: "0 0 24px", lineHeight: 1.6 }}>{parseStage}</p>
      <div style={{ width: "100%", maxWidth: 300, height: 6, background: C.border, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${Math.round(parsePct * 100)}%`, background: `linear-gradient(90deg,${C.saffron},${C.gold})`, borderRadius: 6, transition: "width 0.4s ease" }} />
      </div>
      <p style={{ fontSize: F.xs + 1, color: C.faint, margin: "0 0 20px" }}>{Math.round(parsePct * 100)}% complete</p>
      <button onClick={cancelParse}
        style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 12, padding: "8px 18px", cursor: "pointer", color: C.muted, fontSize: F.sm, fontWeight: 600 }}>
        {t('pdfCancelBtn')}
      </button>
    </div>
  );

  // ── Document view (table of contents) ─────────────────────────────────────
  if (docView) return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={() => setDocView(false)} style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 10, padding: "6px 13px", cursor: "pointer", color: C.muted, fontSize: F.sm }}>← Chat</button>
        <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📄 {pdf.filename}</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 32px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[[pdf.pageCount, "Pages"], [pdf.wordCount?.toLocaleString(), "Words"], [`${pdf.readingTime} min`, "Read time"]].map(([v,l]) => (
            <div key={l} style={{ padding: "14px 12px", borderRadius: 14, background: C.white, border: `1px solid ${C.border}`, textAlign: "center", boxShadow: C.shadow }}>
              <p style={{ fontSize: F.xl, fontWeight: 800, color: C.saffron, margin: "0 0 2px" }}>{v}</p>
              <p style={{ fontSize: F.xs + 1, color: C.muted, margin: 0 }}>{l}</p>
            </div>
          ))}
        </div>
        {/* Keywords */}
        {pdf.keywords?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: F.xs + 1, fontWeight: 700, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 10px" }}>Key Topics</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {pdf.keywords.slice(0, 12).map(k => (
                <button key={k} onClick={() => { setDocView(false); sendUserMessage(`Explain "${k}" from this document`); }}
                  style={{ padding: "5px 13px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontSize: F.sm, cursor: "pointer" }}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Sections */}
        {pdf.sections?.length > 0 && (
          <div>
            <p style={{ fontSize: F.xs + 1, fontWeight: 700, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 10px" }}>Sections Detected</p>
            <div style={{ display: "grid", gap: 8 }}>
              {pdf.sections.map((s, i) => (
                <button key={i} onClick={() => { setDocView(false); sendUserMessage(`Summarise the section titled "${s.title}" from this document`); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", textAlign: "left", width: "100%", boxShadow: C.shadow, transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${C.saffron}40`; e.currentTarget.style.background = C.goldBg; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: C.goldBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: F.sm, fontWeight: 700, color: C.saffron, flexShrink: 0 }}>{i+1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: F.base, fontWeight: 600, color: C.ink, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</p>
                    <p style={{ fontSize: F.xs + 1, color: C.muted, margin: 0 }}>{(s.content.match(/\S+/g)||[]).length} words</p>
                  </div>
                  <span style={{ color: C.faint, fontSize: 16 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Chat screen ────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.cream }}>
      {/* PDF header — right mein 96px ki jagah taaki floating ◯Home pill
          "Change/Contents" buttons ke UPAR na chadhe (overlap bug fix) */}
      <div style={{ padding: "11px 96px 11px 16px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>📄</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pdf.filename}</p>
          <p style={{ fontSize: F.xs + 1, color: C.green, margin: 0 }}>
            ✓ {pdf.pageCount}p · {(pdf.wordCount||0).toLocaleString()} words · {pdf.readingTime}min read
          </p>
        </div>
        <button onClick={() => setDocView(true)}
          style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 10, padding: "5px 11px", cursor: "pointer", color: C.muted, fontSize: F.xs + 1, flexShrink: 0 }}>
          {t('pdfContentsBtn')}
        </button>
        <button onClick={() => { setPdf(null); clearMessages?.(); setDocView(false); }}
          style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 10, padding: "5px 11px", cursor: "pointer", color: C.muted, fontSize: F.xs + 1, flexShrink: 0 }}>
          {t('pdfChangeBtn')}
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 8px" }}>
        {messages.map(m => <ChatMessage key={m.id} msg={m} onRetry={m.error ? retryLast : null} />)}
        {isLoading && (
          <div style={{ display: "flex", gap: 11, marginBottom: 22, animation: "fadeUp 0.2s ease" }}>
            <SaarthiOrb size={33} />
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: "5px 20px 20px 20px", padding: "14px 18px", boxShadow: C.shadow }}>
              <ThinkingBubble label={loadPhase} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick chips — study-pack ab teen ALAG chhote chip hain (summary/points/mcq),
          har click apna alag chhota AI-sawaal bhejta hai apne alag bubble mein —
          ek bade combined command se AI truncate/adhura jawab deta tha, isliye split kiya */}
      <div style={{ padding: "8px 16px 0", display: "flex", gap: 7, overflowX: "auto", flexShrink: 0 }}>
        {(uiLang === "en" ? STUDY_PACK_FREE_EN : STUDY_PACK_FREE_HI).map(({ label, prompt }) => (
          <button key={label}
            onClick={() => sendUserMessage(prompt)}
            disabled={isLoading}
            style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${C.saffron}`, background: C.saffron + "18", color: C.saffron, fontWeight: 600, fontSize: F.sm, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, opacity: isLoading ? 0.5 : 1 }}>
            {label}
          </button>
        ))}
        {isPaid && (uiLang === "en" ? STUDY_PACK_PAID_EN : STUDY_PACK_PAID_HI).map(({ label, prompt }) => (
          <button key={label}
            onClick={() => sendUserMessage(prompt)}
            disabled={isLoading}
            style={{ padding: "6px 13px", borderRadius: 20, border: `1.5px solid ${C.gold}`, background: `linear-gradient(140deg, ${C.saffronL}, ${C.gold})`, color: C.white, fontWeight: 700, fontSize: F.sm, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, opacity: isLoading ? 0.5 : 1 }}>
            {label}
          </button>
        ))}
        {PDF_CHIPS.map(chip => (
          <button key={chip} onClick={() => sendUserMessage(chip)} disabled={isLoading}
            style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontSize: F.sm, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, opacity: isLoading ? 0.5 : 1 }}>
            {chip}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.white, padding: "10px 14px 13px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-end", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 20, padding: "10px 13px", transition: "border-color 0.2s" }}
          onFocus={e => e.currentTarget.style.borderColor = C.saffron}
          onBlur={e  => e.currentTarget.style.borderColor = C.border}>
          <textarea ref={taRef} value={input}
            onChange={e => { setInput(e.target.value); autoSize(); }}
            onKeyDown={onKey} placeholder={t('pdfInputPlaceholder')} rows={1}
            style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", color: C.ink, fontSize: F.base, lineHeight: 1.62, minHeight: 40, maxHeight: 120, padding: "2px 0", fontFamily: "inherit" }} />
          <button onClick={send} disabled={!input.trim() || isLoading} aria-label="Send message"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: input.trim() && !isLoading ? "pointer" : "not-allowed", background: input.trim() && !isLoading ? C.saffron : C.border, color: C.white, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — HOME
// ─────────────────────────────────────────────────────────────────────────────

// ── Global UI-language pill — click "हिंदी" or "English" to switch the whole
// app's chrome text instantly. Visually distinct from (and independent of)
// the per-lesson Hindi/English toggle inside AmritCard, and from the date
// line above — neither of those is affected by this control.
