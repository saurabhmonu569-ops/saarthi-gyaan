/**
 * SAARTHI — Shared small presentational primitives.
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). These are the
 * leaf-level, closure-free components used across ChatView/BooksView/
 * VedicTimeView/etc. Pure move — no behavior change from the originals.
 */
import { useState } from "react";
import { C, F, serif } from "@/styles/theme";

export function SaarthiOrb({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${C.saffronL}, ${C.gold})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.44, boxShadow: `0 2px 8px rgba(200,85,26,0.3)`,
    }}>🕉️</div>
  );
}

export function StatusDot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

export function Btn({ children, onClick, disabled, full, variant = "primary", size = "md", style: sx = {} }) {
  const [hov, setHov] = useState(false);
  const sizes = { sm: { padding: "7px 15px", fontSize: F.sm }, md: { padding: "10px 22px", fontSize: F.base }, lg: { padding: "14px 28px", fontSize: F.md } };
  const variants = {
    primary: { background: hov ? "#A8441A" : C.saffron, color: C.white, boxShadow: hov ? `0 4px 16px rgba(200,85,26,0.4)` : `0 2px 8px rgba(200,85,26,0.28)`, transform: hov ? "translateY(-1px)" : "none" },
    soft:    { background: hov ? C.goldBg : "#FDF8F0", color: C.saffron, border: `1px solid ${C.goldBdr}60` },
    ghost:   { background: hov ? C.goldBg : "transparent", color: C.muted, border: `1px solid ${C.border}` },
    danger:  { background: hov ? "#FEF2F2" : "transparent", color: C.red, border: `1px solid #FCA5A5` },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...sizes[size], ...variants[variant], border: "none", borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, transition: "all 0.18s", display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.45 : 1, width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined, ...sx }}>
      {children}
    </button>
  );
}

export function ThinkingBubble({ label }) {
  const labels = { thinking: "Thinking…", writing: "Writing…", retrying: "Finding the right words…", fallback: "Preparing response…" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.saffron, animation: `typingDot 1.1s ease-in-out ${i*0.18}s infinite` }} />)}
      <span style={{ fontSize: F.sm, color: C.muted }}>{labels[label] || "Thinking…"}</span>
    </div>
  );
}

// ─── MARKDOWN PROSE ──────────────────────────────────────────────────────────
// Remove garbage OCR lines before display
// ── OCR display cleaner v2 ────────────────────────────────────────────────────
// The OCR pipeline leaves Latin gibberish INSIDE Devanagari lines
// ("rrr moe erg ऊ स >स..."). The old cleaner only dropped whole lines, so
// any line containing Devanagari kept all its junk. v2 cleans token-by-token:
// in Devanagari-dominant lines, stray Latin tokens are OCR noise — remove
// them; elsewhere, drop obviously-garbage tokens (no vowels, aaaa runs).
const _DEVA_RE = /[ऀ-ॿ]/;

function _isJunkLatinToken(tok) {
  const t = tok.replace(/[.,!?;:'"()\[\]\-–—|]/g, "");
  if (!t || !/[a-zA-Z]/.test(t)) return false;      // not a Latin word token
  if (/(.)\1\1\1/.test(t)) return true;              // aaaa / ssss runs
  if (t.length >= 2 && !/[aeiouAEIOU]/.test(t)) return true; // no vowels = OCR noise
  if (t.length > 16) return true;                    // absurdly long token
  return false;
}

export function cleanOcrText(raw) {
  if (!raw) return "";
  return raw.split("\n").map(line => {
    const s = line.trim();
    if (!s) return "";
    const devaN = (s.match(/[ऀ-ॿ]/g) || []).length;
    let toks = s.split(/\s+/);
    if (devaN > 0) {
      // This corpus is Devanagari scripture — ANY Latin inside a Devanagari
      // line is OCR noise. Drop all Latin tokens, keep verse punctuation.
      toks = toks.filter(t =>
        (_DEVA_RE.test(t) && !/[a-zA-Z]/.test(t)) ||
        /^[\d।॥()\[\]{}\-–—.,;:!?'"]+$/.test(t)
      );
      // Fragment-mush check: a "line" of single-akshara shrapnel
      // (e.g. "ऊ स स क ऊ नऊ") is unrecoverable OCR debris — drop it.
      const devaToks = toks.filter(t => _DEVA_RE.test(t))
                           .map(t => t.replace(/[^ऀ-ॿ]/g, ""));
      if (devaToks.length >= 3) {
        const tiny    = devaToks.filter(t => t.length <= 2).length;
        const hasWord = devaToks.some(t => t.length >= 4);
        if (!hasWord && tiny / devaToks.length > 0.6) return "";
      }
    } else {
      toks = toks.filter(t => !_isJunkLatinToken(t));
    }
    return toks.join(" ");
  }).filter(line => {
    // Line-level pass: drop lines that are still mostly garbage
    const s = line.trim();
    if (!s) return true;                              // keep paragraph breaks
    const deva = (s.match(/[ऀ-ॿ]/g) || []).length;
    const tot  = s.replace(/\s/g, "").length;
    if (!tot) return false;
    if (deva / tot > 0.15) return true;               // has Devanagari = keep
    if (tot < 25) return true;                        // short line = keep
    if (/^[\d\s।॥()\[\]\-]+$/.test(s)) return true;    // verse num = keep
    const junk = (s.match(/[^a-zA-Zऀ-ॿ\s.,!?;:\-'"\/\d()\[\]]/g) || []).length;
    return junk / tot < 0.12;
  }).join("\n").replace(/\n{3,}/g, "\n\n");
}

function cleanForDisplay(raw) {
  return cleanOcrText(raw);
}

export function Prose({ text = "", size = F.base, scripture = false }) {
  // scripture=true → granth-jaisa serif + zyada saans (reader ke liye)
  const bodyFont = scripture ? { ...serif, lineHeight: 1.95 } : { lineHeight: 1.82 };
  const lines = cleanForDisplay(text).split("\n");
  const out   = [];
  let list    = [];

  function flush() {
    if (!list.length) return;
    out.push(
      <ul key={`ul${out.length}`} style={{ margin: "8px 0 10px", paddingLeft: 0, listStyle: "none" }}>
        {list.map((it, i) => (
          <li key={i} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
            <span style={{ color: C.saffron, fontSize: 9, marginTop: 6, flexShrink: 0 }}>◆</span>
            <span style={{ color: C.body, fontSize: size, lineHeight: 1.78 }} dangerouslySetInnerHTML={{ __html: it }} />
          </li>
        ))}
      </ul>
    );
    list = [];
  }

  // escapeHtml: neutralise any HTML in AI output before we inject our own markup.
  // This prevents XSS from a malicious model response containing <script> or event attrs.
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inl(raw) {
    const safe = escapeHtml(raw); // sanitize first, then add our controlled markup
    return safe
      .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${C.ink};font-weight:700">$1</strong>`)
      .replace(/\*(.*?)\*/g,     `<em style="color:${C.body}">$1</em>`)
      .replace(/`(.*?)`/g,       `<code style="background:${C.goldBg};padding:1px 6px;border-radius:4px;font-size:13px;color:${C.saffron}">$1</code>`);
  }

  lines.forEach((raw, i) => {
    if (raw.startsWith("- ") || raw.startsWith("• ")) { list.push(inl(raw.slice(2))); return; }
    flush();

    if (raw.startsWith("> ")) {
      out.push(<blockquote key={i} style={{ borderLeft: `3px solid ${C.saffron}`, paddingLeft: 16, margin: "14px 0", background: C.goldBg, borderRadius: "0 10px 10px 0", padding: "12px 18px" }}>
        <span style={{ ...serif, color: C.body, fontSize: size - 0.5, fontStyle: "italic", lineHeight: 1.82 }}>{raw.slice(2)}</span>
      </blockquote>);
      return;
    }
    if (raw.startsWith("## ")) { out.push(<p key={i} style={{ fontWeight: 700, color: C.saffron, fontSize: F.xs + 1, letterSpacing: "0.07em", textTransform: "uppercase", margin: "20px 0 6px" }}>{raw.slice(3)}</p>); return; }
    if (/^\*\*[^*]+\*\*$/.test(raw)) { out.push(<p key={i} style={{ fontWeight: 700, color: C.ink, fontSize: size + 0.5, margin: "14px 0 5px" }} dangerouslySetInnerHTML={{ __html: inl(raw) }} />); return; }
    if (raw === "---") { out.push(<hr key={i} style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "18px 0" }} />); return; }
    if (!raw.trim()) { out.push(<div key={i} style={{ height: 8 }} />); return; }
    out.push(<p key={i} style={{ color: C.body, fontSize: size, margin: "3px 0", ...bodyFont }} dangerouslySetInnerHTML={{ __html: inl(raw) }} />);
  });

  flush();
  return <>{out}</>;
}
