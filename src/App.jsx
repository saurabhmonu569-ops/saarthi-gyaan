/**
 * SAARTHI v4.1 — Polished · Warm · Human · Spiritual
 *
 * Fixes in this version:
 * - System prompt completely hidden (lives only in gemini.js API call)
 * - Premium typography and spacing
 * - Proper book navigation with bookmarks + continue reading
 * - ElevenLabs-ready audio architecture with graceful browser TTS fallback
 * - Smoother mobile experience
 * - Beautiful onboarding
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useKnowledge } from "@/hooks/useKnowledge";
import { useBookProgress } from "@/context/AppContext";
import { parsePdf } from "@/services/pdfParser";
import { convertDocxToPdf, convertImagesToPdf, isDocxFile, isImageFile } from "@/services/fileConverter";
import { polishSacredText, explainSearchTerm, askAboutVedicTime, hasApiKey } from "@/services/gemini";
import { BOOKS, DAILY_WISDOMS, AUDIO_LESSONS } from "@/data";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useT, useUiLang } from "@/i18n";
import { computePanchang, getUserLocation } from "@/services/panchang";
import { tithiName, NAKSHATRAS, YOGAS, KARANAS, VAARS, RITUS, HINDU_MONTHS, muhurtaLabel, VEDIC_LESSONS } from "@/data/vedicData";
import { useAuth, GOOGLE_CLIENT_ID, loadGoogleScript } from "@/context/AuthContext";
import { isPushSupported, pushPermission, subscribeToPush, unsubscribeFromPush, isPushEnabledLocally } from "@/services/pushNotifications";
import { isPaidUser } from "@/services/tier";
import { detectHintedBook } from "@/knowledge/bookHints";
import { featureQuotaLeft, featureQuotaUse, SEARCH_QUOTA_LIMIT, VEDIC_QUOTA_LIMIT, serverQuotaConsume, syncLocalQuotaFromServer } from "@/services/quota";
import { semanticSearch, preloadSemanticSearch } from "@/knowledge/semanticSearch";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  cream:    "#FDFCF8",
  white:    "#FFFFFF",
  ink:      "#18120E",
  body:     "#3A3028",
  muted:    "#867A6F",
  faint:    "#C4B8AC",
  border:   "#EDE7DF",
  borderMd: "#D6CDBF",
  saffron:  "#C8551A",
  saffronL: "#E06220",
  gold:     "#B8891A",
  goldBg:   "#FBF5E4",
  goldBdr:  "#E8C96A",
  red:      "#DC2626",
  green:    "#15803D",
  shadow:   "0 1px 3px rgba(24,18,14,0.06), 0 4px 12px rgba(24,18,14,0.04)",
  shadowMd: "0 2px 8px rgba(24,18,14,0.08), 0 8px 24px rgba(24,18,14,0.06)",
  shadowLg: "0 4px 16px rgba(24,18,14,0.1), 0 16px 40px rgba(24,18,14,0.08)",
};

// Kin books ki ASLI PDF public/books/ mein maujood hai (in 13 ke alawa nayi
// books sirf text-reader se khulti hain — unki PDFs host par nahi/nahi ho saktin)
const HAS_PDF = new Set([
  "agni_purana", "atharvaveda_1", "bhagavad_gita_shankar", "bhavishya_purana",
  "garuda_purana_1", "narasimha_purana", "rigveda_1", "samaveda",
  "shiva_purana_1", "shiva_purana_2", "valmiki_ramayana", "vishnu_purana_1", "yajurveda",
  // Batch 2 — sabhi 11 (badi 3 ko 08_compress_pdf.py se chhota karke host kiya)
  "rashi_muhurt_vigyan", "chanakya_neeti", "ekadashi_mahatmya", "ishadi_upanishad",
  "guru_granth_sahib", "kathopanishad", "nitya_devta_archana", "lal_kitab",
  "mantra_maha_sagar", "mantra_shakti", "nitya_karm_pooja",
]);

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
// Tiro Devanagari Hindi: granth-jaisa serif jo DEVANAGARI + Latin dono mein
// sundar hai. (Georgia mein Devanagari tha hi nahi — Hindi system font mein
// gir jaati thi, wahi "developer UI" feel ki asli jadh thi.)
const serif = { fontFamily: "'Tiro Devanagari Hindi', 'Georgia', 'Palatino Linotype', serif" };
const F = {
  xs:   11, sm: 12.5, base: 14.5, md: 15.5, lg: 17, xl: 20, xxl: 26, h1: 30,
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const ts = () => new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });

// localStorage helpers for reading progress & bookmarks
const LS = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── AUDIO ENGINE ─────────────────────────────────────────────────────────────
/**
 * ElevenLabs-ready audio engine.
 * When VITE_ELEVENLABS_API_KEY is set, uses ElevenLabs TTS.
 * Falls back gracefully to browser Web Speech API.
 *
 * To enable ElevenLabs:
 *   1. Get a key at https://elevenlabs.io
 *   2. Add VITE_ELEVENLABS_API_KEY=your_key to .env
 *   3. Optionally set VITE_ELEVENLABS_VOICE_ID=voice_id (default: Rachel)
 */
const EL_KEY     = import.meta.env.VITE_ELEVENLABS_API_KEY || "";
const EL_VOICE   = import.meta.env.VITE_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const HAS_EL     = Boolean(EL_KEY && EL_KEY !== "your_elevenlabs_key_here");

const AudioEngine = {
  _current:      null,
  _sessionId:    0,    // incremented on every speak() call to cancel stale sessions
  _paused:       false,
  _stopCallback: null, // registered by whichever component is currently playing
                       // called by stop() so UI state always stays in sync

  hasHindiVoice() {
    try {
      const v = window.speechSynthesis?.getVoices() || [];
      if (!v.length) return null;                       // voices abhi load nahi — unknown
      return v.some(x => (x.lang || "").toLowerCase().startsWith("hi"));
    } catch { return null; }
  },

  // Pre-generated MP3 bajao (edge-tts se bana) — har browser par ek jaisi
  // natural awaaz, TTS engine ki koi zaroorat nahi. Amrit cards iske liye
  // pehle MP3 dhundhte hain, na mile toh speak() (browser TTS) fallback.
  playUrl(url, { onStart, onEnd, onError } = {}) {
    this.stop();
    const sessionId = ++this._sessionId;
    const audio = new Audio(url);
    this._current = audio;
    audio.onplay  = () => { if (this._sessionId === sessionId) onStart?.(); };
    audio.onended = () => { if (this._sessionId === sessionId) { this._current = null; onEnd?.(); } };
    audio.onerror = () => { if (this._sessionId === sessionId) { this._current = null; onError?.(); onEnd?.(); } };
    audio.play().catch(() => { if (this._sessionId === sessionId) { this._current = null; onError?.(); onEnd?.(); } });
  },

  async speak(text, { onStart, onEnd, onError, onProgress, rate = 0.95, pitch = 0.97, langHint = null } = {}) {
    this.stop();
    const sessionId = ++this._sessionId;
    const clean = text.replace(/[*#`_>[\]|~]/g, "").replace(/\s+/g, " ").trim();
    if (!clean) { onEnd?.(); return; }

    if (HAS_EL) {
      // ── ElevenLabs path ──────────────────────────────────────────────────
      try {
        onStart?.();
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
          method: "POST",
          headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: clean,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.65, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true },
          }),
        });
        if (!res.ok) throw new Error("ElevenLabs error " + res.status);
        if (this._sessionId !== sessionId) { onEnd?.(); return; } // cancelled
        const blob  = await res.blob();
        const url   = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this._current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); if (this._sessionId === sessionId) onEnd?.(); };
        audio.onerror = () => { if (this._sessionId === sessionId) { onError?.(); onEnd?.(); } };
        audio.play();
      } catch (e) {
        console.warn("[Saarthi Audio] ElevenLabs failed, falling back to browser TTS:", e.message);
        this._browserSpeak(clean, sessionId, { onStart, onEnd, onError, onProgress, rate, pitch, langHint });
      }
      return;
    }

    // ── Browser Web Speech API path ──────────────────────────────────────
    this._browserSpeak(clean, sessionId, { onStart, onEnd, onError, rate, pitch, langHint });
  },

  _browserSpeak(text, sessionId, { onStart, onEnd, onError, onProgress, rate, pitch, langHint }) {
    if (!window.speechSynthesis) { onError?.("No TTS support"); return; }

    // Capture `this` explicitly — avoids context-loss in callbacks
    const self = this;

    const doSpeak = (voices) => {
      // Guard: if a newer session started, abort
      if (self._sessionId !== sessionId) { onEnd?.(); return; }

      // Voice selection — prefer warm female voices, wide browser compatibility
      const picked = voices.find(v => /(natural|neural|online)/i.test(v.name) && v.lang === "en-IN") // Edge natural voices (best quality)
                  || voices.find(v => /(natural|neural|online)/i.test(v.name) && v.lang.startsWith("en"))
                  || voices.find(v => /google uk english female/i.test(v.name))                     // Chrome desktop (smooth network voice)
                  || voices.find(v => /google us english/i.test(v.name))                            // Chrome desktop fallback
                  || voices.find(v => /samantha|victoria|karen|moira|veena/i.test(v.name))          // macOS (NOTE: Zira hataya — robotic SAPI voice)
                  || voices.find(v => /microsoft.*aria|microsoft.*jenny|microsoft.*natasha/i.test(v.name)) // Windows
                  || voices.find(v => v.lang === "en-IN" && /female/i.test(v.name))               // Android en-IN female
                  || voices.find(v => v.lang === "en-IN")                                          // any en-IN
                  || voices.find(v => v.lang === "en-GB" && /female/i.test(v.name))
                  || voices.find(v => v.lang === "en-GB")
                  || voices.find(v => v.lang.startsWith("en") && v.localService && /female/i.test(v.name))
                  || voices.find(v => v.lang.startsWith("en") && v.localService)
                  || voices.find(v => v.lang.startsWith("en"))
                  || voices[0];

      // Detect language: langHint (user ka chuna hua tab) sabse pehle,
      // warna Devanagari detection. Hinglish text + \u0939\u093F\u0902\u0926\u0940 tab \u2192 Hindi voice
      // (Indian accent), robotic English accent nahi.
      const devaCount = (text.match(/[\u0900-\u097F]/g) || []).length;
      const isHindi   = langHint ? langHint === "hi" : devaCount > text.length * 0.15;
      const ttsLang   = isHindi ? "hi-IN" : "en-IN";

      // For Hindi text, prefer Hindi voice if available
      let finalVoice = picked;
      if (isHindi) {
        const hindiVoice = voices.find(v => v.lang === "hi-IN" && /(natural|neural|online)/i.test(v.name)) // Edge: Swara/Madhur Natural
                        || voices.find(v => /google.*(hindi|\u0939\u093F\u0928\u094D\u0926\u0940)/i.test(v.name))     // Chrome: Google \u0939\u093F\u0928\u094D\u0926\u0940
                        || voices.find(v => v.lang === "hi-IN" && /female/i.test(v.name))
                        || voices.find(v => v.lang === "hi-IN")
                        || voices.find(v => v.lang.startsWith("hi"));
        if (hindiVoice) finalVoice = hindiVoice;
      }

      // Split into sentences
      const sentences = text.match(/[^.!?।\n]+[.!?।\n]*/g)?.filter(s => s.trim().length > 1) || [text];
      let i = 0;
      self._current = { type: "browser" };
      onStart?.();

      const total = sentences.length;
      const next = () => {
        if (self._sessionId !== sessionId || !self._current) { return; } // stopped
        if (i >= sentences.length) { self._current = null; onProgress?.(1); onEnd?.(); return; }
        const u   = new SpeechSynthesisUtterance(sentences[i++].trim());
        u.rate    = rate;
        u.pitch   = pitch;
        // Use the chosen voice's own lang — an hi-IN lang with an en voice
        // (or vice-versa) produces SILENCE on many Chrome/Windows setups.
        u.lang    = (finalVoice && finalVoice.lang) || ttsLang;
        if (finalVoice) u.voice = finalVoice;
        u.onend   = () => { onProgress?.(i / total); setTimeout(next, 80); };
        u.onerror = ev => {
          if (ev.error === "interrupted" || ev.error === "cancelled") return;
          console.warn("[Saarthi TTS]", ev.error);
          // AUDIT FIX: Edge/Windows ka TTS toota ho (synthesis-failed) toh app
          // chupchaap fail hoti thi — user ko wajah hi nahi dikhti thi.
          // 2 baar lagatar fail = ek baar saaf-saaf batao (session mein ek hi baar).
          if (ev.error === "synthesis-failed") {
            self._sfCount = (self._sfCount || 0) + 1;
            if (self._sfCount >= 2 && !self._sfWarned) {
              self._sfWarned = true;
              try {
                alert(
                  "🔇 Awaaz nahi aa pa rahi — aapke browser ka speech engine kaam nahi kar raha.\n\n" +
                  "✅ Aasan hal: yahi app GOOGLE CHROME mein kholein — wahan awaaz theek chalti hai.\n\n" +
                  "Edge/Windows theek karne ke liye: Windows Settings → Time & Language → Speech → " +
                  "Add voices → Hindi install karke PC restart karein."
                );
              } catch {}
            }
          }
          onProgress?.(i / total);
          setTimeout(next, 150); // skip and continue
        };
        window.speechSynthesis.speak(u);
      };

      // CHROME STUCK-PAUSED BUG FIX: agar engine kabhi pause mein atka reh
      // gaya (Roko ke baad), toh nayi utterances chupchaap queue hoti hain
      // aur kabhi nahi bolti. resume() pehle — engine ko unstick karo.
      try { window.speechSynthesis.resume(); } catch {}
      window.speechSynthesis.cancel(); // clear queue before starting
      setTimeout(next, 80);           // small delay after cancel
    };

    // getVoices() is synchronous once loaded
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak(voices);
    } else {
      // First call on cold start — wait for voiceschanged event
      const onLoaded = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onLoaded);
        doSpeak(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener("voiceschanged", onLoaded);
      // Some browsers fire synchronously on second getVoices() call
      window.speechSynthesis.getVoices();
      // Safety timeout: if voiceschanged never fires, use empty voices list
      setTimeout(() => {
        if (self._sessionId === sessionId && self._current === null) {
          window.speechSynthesis.removeEventListener("voiceschanged", onLoaded);
          doSpeak(window.speechSynthesis.getVoices() || []);
        }
      }, 2000);
    }
  },

  stop() {
    const prev = this._current;
    this._current = null;
    this._sessionId++;          // invalidate any in-progress speak
    this._paused = false;
    // Reset UI state in whatever component owns the audio — before browser call
    // so React state is correct even if browser TTS fires onend asynchronously
    const cb = this._stopCallback;
    this._stopCallback = null;
    cb?.();
    if (prev?.type === "browser") {
      // resume() pehle, phir cancel() — paused state mein cancel karne se
      // Chrome ka engine hamesha ke liye atak jaata hai (stuck-paused bug)
      try { window.speechSynthesis.resume(); } catch {}
      try { window.speechSynthesis.cancel(); } catch {}
    } else if (prev instanceof Audio) {
      try { prev.pause(); prev.src = ""; } catch {}
    }
  },

  pause() {
    if (!this._current || this._paused) return;
    this._paused = true;
    if (this._current?.type === "browser") {
      try { window.speechSynthesis.pause(); } catch {}
    } else if (this._current instanceof Audio) {
      try { this._current.pause(); } catch {}
    }
  },

  resume() {
    if (!this._current || !this._paused) return;
    this._paused = false;
    if (this._current?.type === "browser") {
      try { window.speechSynthesis.resume(); } catch {}
    } else if (this._current instanceof Audio) {
      try { this._current.play(); } catch {}
    }
  },

  get playing() { return Boolean(this._current) && !this._paused; },
  get paused()  { return Boolean(this._current) &&  this._paused; },
};

// ─── SMALL SHARED COMPONENTS ──────────────────────────────────────────────────

function SaarthiOrb({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `linear-gradient(135deg, ${C.saffronL}, ${C.gold})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.44, boxShadow: `0 2px 8px rgba(200,85,26,0.3)`,
    }}>🕉️</div>
  );
}

function StatusDot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

function Btn({ children, onClick, disabled, full, variant = "primary", size = "md", style: sx = {} }) {
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

function ThinkingBubble({ label }) {
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
const _DEVA_RE = /[\u0900-\u097F]/;

function _isJunkLatinToken(tok) {
  const t = tok.replace(/[.,!?;:'"()\[\]\-\u2013—|]/g, "");
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
    const devaN = (s.match(/[\u0900-\u097F]/g) || []).length;
    let toks = s.split(/\s+/);
    if (devaN > 0) {
      // This corpus is Devanagari scripture — ANY Latin inside a Devanagari
      // line is OCR noise. Drop all Latin tokens, keep verse punctuation.
      toks = toks.filter(t =>
        (_DEVA_RE.test(t) && !/[a-zA-Z]/.test(t)) ||
        /^[\d।॥()\[\]{}\-\u2013—.,;:!?'"]+$/.test(t)
      );
      // Fragment-mush check: a "line" of single-akshara shrapnel
      // (e.g. "ऊ स स क ऊ नऊ") is unrecoverable OCR debris — drop it.
      const devaToks = toks.filter(t => _DEVA_RE.test(t))
                           .map(t => t.replace(/[^\u0900-\u097F]/g, ""));
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
    const deva = (s.match(/[\u0900-\u097F]/g) || []).length;
    const tot  = s.replace(/\s/g, "").length;
    if (!tot) return false;
    if (deva / tot > 0.15) return true;               // has Devanagari = keep
    if (tot < 25) return true;                        // short line = keep
    if (/^[\d\s।॥()\[\]\-]+$/.test(s)) return true;    // verse num = keep
    const junk = (s.match(/[^a-zA-Z\u0900-\u097F\s.,!?;:\-'"\/\d()\[\]]/g) || []).length;
    return junk / tot < 0.12;
  }).join("\n").replace(/\n{3,}/g, "\n\n");
}

function cleanForDisplay(raw) {
  return cleanOcrText(raw);
}

function Prose({ text = "", size = F.base, scripture = false }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CHAT
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_STARTERS = [
  "I feel lost and don't know my direction",
  "I'm overwhelmed with stress lately",
  "Tell me about the Bhagavad Gita",
  "How do I deal with anger?",
  "I'm struggling with a big decision",
  "What does it mean to find purpose?",
];

function ChatMessage({ msg, onRetry }) {
  const t = useT();
  const [copied,  setCopied]  = useState(false);
  const [playing, setPlaying] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content || "").catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const listen = () => {
    if (playing) { AudioEngine.stop(); setPlaying(false); return; }
    AudioEngine._stopCallback = () => setPlaying(false);
    AudioEngine.speak(msg.content || "", {
      onStart: () => setPlaying(true),
      onEnd:   () => { AudioEngine._stopCallback = null; setPlaying(false); },
    });
  };

  // User bubble
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18, animation: "fadeUp 0.22s ease" }}>
        <div style={{
          background: `linear-gradient(140deg, ${C.saffronL}, ${C.gold})`,
          color: C.white, borderRadius: "22px 22px 5px 22px",
          padding: "12px 18px", maxWidth: "78%", fontSize: F.base,
          lineHeight: 1.68, fontWeight: 430,
          overflowWrap: "break-word", wordBreak: "break-word",
          boxShadow: `0 2px 14px rgba(200,85,26,0.22)`,
        }}>{msg.content}</div>
      </div>
    );
  }

  const isErr = msg.error;
  return (
    <div style={{ display: "flex", gap: 11, marginBottom: 24, animation: "fadeUp 0.35s ease" }}>
      <SaarthiOrb size={33} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: isErr ? "#FEF2F2" : C.white,
          border: `1px solid ${isErr ? "#FCA5A5" : C.border}`,
          borderRadius: "5px 20px 20px 20px",
          padding: "14px 18px 12px",
          boxShadow: C.shadow,
        }}>
          {isErr ? (
            <>
              <p style={{ color: C.red, fontSize: F.base, lineHeight: 1.65, margin: "0 0 10px" }}>{msg.content}</p>
              {onRetry && <Btn variant="soft" size="sm" onClick={onRetry}>{t('retryBtn')}</Btn>}
            </>
          ) : (
            <>
              <Prose text={msg.content} />
              {msg.fallback && (
                <span style={{ display: "inline-block", marginTop: 10, fontSize: F.xs, color: C.muted, background: "#F5F2EC", borderRadius: 20, padding: "2px 10px", border: `1px solid ${C.border}` }}>
                  ⚡ Offline response
                </span>
              )}
            </>
          )}
        </div>

        {!isErr && (
          <div style={{ display: "flex", gap: 14, paddingLeft: 2, marginTop: 7, alignItems: "center" }}>
            <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: C.faint, fontSize: F.xs + 1, padding: 0, transition: "color 0.18s" }}
              onMouseEnter={e => e.target.style.color = C.muted} onMouseLeave={e => e.target.style.color = C.faint}>
              {copied ? t('copiedBtn') : t('copyBtn')}
            </button>
            <button onClick={listen} style={{ background: "none", border: "none", cursor: "pointer", color: playing ? C.saffron : C.faint, fontSize: F.xs + 1, padding: 0, transition: "color 0.18s" }}>
              {playing ? t('stopBtn') : t('listenBtn')}
            </button>
            <span style={{ fontSize: F.xs, color: C.faint, marginLeft: "auto" }}>{msg.time}</span>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── DEMO KEY ENTRY ───────────────────────────────────────────────────────────
// Allows user to paste Gemini key directly in app without editing .env
function DemoKeyEntry() {
  const [open,   setOpen]   = React.useState(false);
  const [key,    setKey]    = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [done,   setDone]   = React.useState(false);

  const save = () => {
    const trimmed = key.trim();
    if (!trimmed || trimmed.length < 10) {
      alert("Key bahut chhoti lag rahi hai. Dobara copy karo.");
      return;
    }
    // OAuth tokens LOOK like keys but do NOT work with the API — reject
    // them here with a clear message instead of silently failing later.
    if (trimmed.startsWith("AQ.") || trimmed.startsWith("ya29.")) {
      alert("❌ Yeh API key NAHI hai — yeh Google ka OAuth token hai (AQ./ya29.). Yeh kaam NAHI karega.\n\n✅ Groq ki FREE key lo (gsk_ se shuru hoti hai):\nconsole.groq.com/keys");
      return;
    }
    // Valid key formats: gsk_ (Groq — recommended), AIzaSy (Gemini)
    const isValid = trimmed.startsWith("AIza") || trimmed.startsWith("gsk_");
    if (!isValid) {
      alert("Key sahi format mein nahi hai.\n\nValid formats:\n• gsk_... (Groq - FREE)\n• AIzaSy... (Google Gemini)\n\nGroq key: console.groq.com/keys");
      return;
    }
    setSaving(true);
    // Store in localStorage so the key SURVIVES browser restarts.
    // (.env is still the preferred permanent home for the key.)
    localStorage.setItem("SAARTHI_RUNTIME_KEY", trimmed);
    setTimeout(() => {
      setSaving(false);
      setDone(true);
      // Force page reload so Vite picks up the key
      setTimeout(() => window.location.reload(), 800);
    }, 600);
  };

  // Check localStorage for runtime key
  React.useEffect(() => {
    let rk = "";
    try { rk = localStorage.getItem("SAARTHI_RUNTIME_KEY") || sessionStorage.getItem("SAARTHI_RUNTIME_KEY") || ""; } catch {}
    if (rk) setDone(true);
  }, []);

  if (done) return (
    <div style={{ padding:"8px 18px", background:"#ECFDF5", borderBottom:"1px solid #6EE7B7", flexShrink:0 }}>
      <p style={{ fontSize:F.sm, color:"#065F46", margin:0, fontWeight:600 }}>
        ✅ Key set — reloading app for real AI...
      </p>
    </div>
  );

  return (
    <div style={{ padding:"11px 18px 10px", background:"#FEF3C7", borderBottom:"2px solid #F59E0B", flexShrink:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <p style={{ fontSize:F.sm, color:"#78350F", margin:0, fontWeight:700 }}>
          ⚡ Demo Mode — Real AI ke liye FREE Groq key chahiye (gsk_...)
        </p>
        <button onClick={() => setOpen(!open)}
          style={{ border:`1px solid #F59E0B`, background:"white", borderRadius:8, padding:"3px 10px",
                   fontSize:F.xs+1, color:"#92400E", cursor:"pointer", fontWeight:700, flexShrink:0 }}>
          {open ? "Close ✕" : "Key Enter Karo →"}
        </button>
      </div>

      {!open && (
        <p style={{ fontSize:F.xs+1, color:"#92400E", margin:0, lineHeight:1.4 }}>
          Free key milegi: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
            style={{ color:C.saffron, fontWeight:700 }}>console.groq.com/keys</a>
          {" "}→ Sign in → "Create API Key" → Copy → paste here
        </p>
      )}

      {open && (
        <div style={{ marginTop:8 }}>
          <p style={{ fontSize:F.xs+1, color:"#92400E", margin:"0 0 8px", lineHeight:1.7 }}>
            <strong>Step 1:</strong> Jao → <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
              style={{ color:C.saffron, fontWeight:700 }}>console.groq.com/keys</a><br/>
            <strong>Step 2:</strong> List mein <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>...XBg</code> wali row dikhegi<br/>
            <strong>Step 3:</strong> Us row ke right side mein <strong>📋 copy icon</strong> directly dabaao<br/>
            <strong style={{color:"#DC2626"}}>⚠️ Popup mat kholo — popup se AQ. token aata hai jo kaam nahi karta</strong><br/>
            <strong>Step 4:</strong> Jo key copy ho woh <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>AIzaSy...</code> se shuru hogi — woh paste karo
          </p>
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="AIzaSy... (paste your Gemini key here)"
              style={{ flex:1, padding:"9px 12px", borderRadius:10, border:"1.5px solid #F59E0B",
                       fontSize:F.sm, outline:"none", fontFamily:"monospace", background:"white" }}
            />
            <button onClick={save} disabled={saving || !key.trim()}
              style={{ padding:"9px 16px", borderRadius:10, border:"none", cursor:saving?"wait":"pointer",
                       background:key.trim() ? C.saffron : C.border, color:"white",
                       fontSize:F.sm, fontWeight:700, flexShrink:0, transition:"all 0.2s" }}>
              {saving ? "Saving…" : "Activate ✓"}
            </button>
          </div>
          <p style={{ fontSize:F.xs, color:"#92400E", margin:"6px 0 0", opacity:0.8 }}>
            ⚠️ For permanent fix: paste key in <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>.env</code> file → restart <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>npm run dev</code>
          </p>
        </div>
      )}
    </div>
  );
}

function ChatView() {
  const t = useT();
  const { ready: knowledgeReady, crossBookSearch, hybridSearch, getBookChunks, getChunk } = useKnowledge();
  const [sacredChunks, setSacredChunks] = useState([]);

  // FIX (2026-07-26): real neural semantic search ab bhi Ask ke liye warm
  // hona shuru ho jaata hai jab user Chat tab par aata hai — pehla asli
  // sawaal aane tak model+vectors (background mein) load ho chuke hote
  // hain, taaki pehla jawab bhi tez ho. Fail-soft — is call ka result
  // istemal nahi hota, sirf warmup ke liye hai.
  useEffect(() => {
    preloadSemanticSearch();
  }, []);

  // Build a stable retrieval function — called before every AI send
  // Merges keyword + cross-book + semantic results, deduplicates by chunk ID, sorts by score
  const retrieveContext = useCallback(async (query) => {
    if (!knowledgeReady) return [];
    try {
      // 1. Cross-book: top 3 per book
      const crossResults = crossBookSearch(query, null, 3);
      const crossFlat = crossResults.flatMap(r => r.results);

      // 2. Keyword: direct inverted-index search, top 12
      const kwResults = hybridSearch(query, null, {}, 12);

      // 2.5 REAL semantic search (2026-07-26 fix — see src/knowledge/
      // semanticSearch.js for full context): keyword search sirf exact/
      // substring text match karta hai — "family mein ego kaise kam
      // karein" jaisa paraphrased sawaal miss ho sakta hai agar corpus
      // "ahankar" shabd use karta ho, "ego" nahi. Yeh asli meaning se
      // match karta hai. FAIL-SOFT: model abhi load ho raha ho ya fail
      // ho jaaye toh khaali array — keyword+cross-book upar se hamesha
      // kaam karte rehte hain, yeh sirf ADDITIONAL signal hai.
      let semResults = [];
      try {
        const semHits = await semanticSearch(query, 12);
        semResults = semHits
          .map(h => {
            const chunk = getChunk(h.id);
            return chunk ? { chunk, score: h.score, match_type: "semantic" } : null;
          })
          .filter(Boolean);
      } catch { /* soft-fail — keyword+cross-book results still cover us */ }

      // 3. Merge by chunk ID, prefer higher score
      const byId = new Map();
      for (const r of [...crossFlat, ...kwResults, ...semResults]) {
        const existing = byId.get(r.chunk.id);
        if (!existing || r.score > existing.score) byId.set(r.chunk.id, r);
      }

      // 3.5 Agar user ne kisi book ka naam liya hai, USI book ke passages pehle
      // (2026-07-25: hint list ab src/knowledge/bookHints.js mein hai — apne
      // aap ek testable pure function, App.jsx ke bahar unit-test ho sakta hai)
      const hintedBook = detectHintedBook(query);

      // 3.6 AUTOPSY FIX (2026-07-24): "Atharvaveda ka modern use kya hai?"
      // jaise sawaal 0 candidate laate the — keyword-search sirf Devanagari
      // substring match karta hai, aur "Atharvaveda" jaisa Roman naam kisi
      // Devanagari chunk mein literally kabhi nahi milta (TRANSLIT dict mein
      // ab in Veda/Purana naamon ki entry jod di gayi hai, par phir bhi
      // CONCEPTUAL/paraphrased sawaal (jaise "modern use") us granth ke
      // shabdon se seedha match nahi karega). Isliye jab user ne khud granth
      // ka naam liya ho (hintedBook), us granth se REAL ansh milna GUARANTEE
      // karo — pehle usi granth ke andar keyword-search try karo, phir bhi
      // kam mile toh granth ka ek spread (shuru/beech/ant) le lo. Isse AI
      // kabhi "koi ullekh nahi mila" bol kar anjaan books cite nahi karega —
      // hamesha us granth ka असली text milega jawab dene ke liye.
      if (hintedBook) {
        const already = [...byId.values()].filter(r => r.chunk.book === hintedBook).length;
        if (already < 3) {
          const withinBook = hybridSearch(query, null, { book: hintedBook }, 6);
          for (const r of withinBook) {
            const existing = byId.get(r.chunk.id);
            if (!existing || r.score > existing.score) byId.set(r.chunk.id, r);
          }
          const nowHave = [...byId.values()].filter(r => r.chunk.book === hintedBook).length;
          if (nowHave < 3) {
            const allBookChunks = (getBookChunks(hintedBook) || [])
              .filter(c => (c.text || "").trim().length > 60);
            const step = Math.max(1, Math.floor(allBookChunks.length / 6));
            for (let i = 0; i < allBookChunks.length; i += step) {
              const c = allBookChunks[i];
              if (!byId.has(c.id)) byId.set(c.id, { chunk: c, score: 0.05, match_type: "book-overview" });
            }
          }
        }
      }

      // 4. Sort by score descending, take top 8
      // 5. CLEAN each passage before it reaches the AI — raw OCR junk in the
      //    prompt directly hurts answer quality. Trim to keep the prompt lean.
      const sorted = [...byId.values()]
        .sort((a, b) => {
          if (hintedBook) {
            const ab = a.chunk.book === hintedBook, bb = b.chunk.book === hintedBook;
            if (ab !== bb) return ab ? -1 : 1;   // named book first
          }
          return b.score - a.score;
        });
      // VIVIDHTA-CAP (user complaint: "har jawab same book se aata hai" —
      // dobara cross-check ke baad aur sakht kiya gaya): ek book ke max 2
      // ansh, ab top-8 mein se — kam se kam 4 alag granth aayenge, taaki
      // GENERIC (bina naam liye) sawaalon mein zyada vividhta rahe.
      //
      // BUG FIX (2026-07-24): jab user khud kisi granth ka naam le (e.g.
      // "Mantra Maha Sagar se mantra bataiye"), purana cap (3 vs 2) tha —
      // 8 mein se sirf 3 hinted-book se, baaki 5 alag-alag anjaan granthon
      // se — AI ka jawab un anjaan granthon ko bhi "Aadhaar" mein cite kar
      // deta tha (galat/bharamak). Ab hinted-book ka cap bahut dheela (6)
      // — woh hi granth zyaadatar context bharega; doosre books sirf tab
      // aayenge jab hinted-book ke paas khud itne matching ansh na hoon.
      // SCORE-AWARE DIVERSITY FLOOR (2026-07-26 fix): purana cap sirf "max 2
      // per book, top-8 tak bharo" tha — bhale hi 3rd/4th book ka score bahut
      // kamzor/anrelevant ho, phir bhi 8 tak pahunchne ke liye force-include
      // ho jaata tha. Isi wajah se ek badi, broad-topic wali kitaab (jaise
      // Guru Granth Sahib) almost HAR generic sawaal ke Aadhaar mein aa jaati
      // thi, chahe topic se seedha lena-dena na ho — semantic search sahi
      // passage dhoondh leta hai, par yeh cap use bhi dilute kar deta tha.
      // Ab (sirf generic/non-hinted sawaalon ke liye): kam se kam 3 acche
      // (top-score) results mil chuke hon, uske baad koi bhi naya passage
      // jo top-score ke 35% se kamzor ho, use diversity ke liye zabardasti
      // shaamil mat karo — kam passages sahi, galat/anrelevant citation nahi.
      // (hintedBook wale case ko chhua nahi — uska apna guaranteed-grounding
      // logic hai, upar dekhen.)
      const topScore = sorted.length ? sorted[0].score : 0;
      const MIN_RELATIVE_SCORE = 0.35;
      const perBookCount = new Map();
      const diverse = [];
      for (const r of sorted) {
        const b = r.chunk.book;
        const c = perBookCount.get(b) || 0;
        const cap = hintedBook ? (b === hintedBook ? 6 : 1) : 2;
        if (c >= cap) continue;
        if (!hintedBook && diverse.length >= 3 && r.score < topScore * MIN_RELATIVE_SCORE) continue;
        perBookCount.set(b, c + 1);
        diverse.push(r);
        if (diverse.length >= 8) break;
      }
      const merged = diverse
        .map((r, i) => ({
          ...r,
          // PRAMAAN-FIX: top-3 ansh MOTE (800) taaki AI seedha uddharan de sake,
          // baaki 3 patle (300) — kul tokens lagbhag wahi (TPM surakshit)
          chunk: { ...r.chunk, text: cleanOcrText(r.chunk.text || "").slice(0, i < 3 ? 800 : 300) },
        }))
        .filter(r => r.chunk.text.trim().length > 40); // drop passages that were pure junk

      setSacredChunks(merged);
      return merged;
    } catch { return []; }
  }, [knowledgeReady, crossBookSearch, hybridSearch]);

  const { messages, isLoading, loadPhase, countdown, apiStatus, sendUserMessage, clearMessages, retryLast } = useChat({
    mode: "chat",
    sacredChunks,      // injected — updates before each send
  });
  const [text,      setText]      = useState("");
  const [micOn,     setMicOn]     = useState(false);
  const taRef  = useRef(null);
  const endRef = useRef(null);
  const recRef = useRef(null);
  const fresh  = messages.length === 1;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  const autoSize = () => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 130) + "px";
  };

  const send = useCallback(async () => {
    const q = text.trim(); if (!q || isLoading) return;
    setText(""); if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.focus(); }
    // Retrieve sacred context for this query before sending
    const freshChunks = await retrieveContext(q);
    sendUserMessage(q, freshChunks || []);
  }, [text, isLoading, sendUserMessage, retrieveContext]);

  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const toggleMic = () => {
    if (micOn) { recRef.current?.stop(); setMicOn(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome on Android or desktop."); return; }
    const r = new SR(); r.lang = "hi-IN"; r.continuous = false; r.interimResults = false;
    r.onresult = e => { setText(e.results[0][0].transcript); setTimeout(autoSize, 10); };
    r.onend = () => setMicOn(false); r.onerror = () => setMicOn(false);
    r.start(); recRef.current = r; setMicOn(true);
  };

  const statusMeta = {
    ready:        { color: C.green,   label: t('statusConnected') },
    demo:         { color: "#D97706", label: t('statusDemo') },
    rate_limited: { color: "#F97316", label: t('statusFallback') },
    error:        { color: C.red,     label: t('statusError') },
  }[apiStatus] || { color: C.muted, label: "—" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.cream }}>

      {/* Header */}
      <div style={{ padding: "12px 18px 11px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
        <SaarthiOrb size={38} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: F.md, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: -0.2 }}>Saarthi</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <StatusDot color={statusMeta.color} />
            <span style={{ fontSize: F.xs + 1, color: C.muted }}>{statusMeta.label}</span>
          </div>
        </div>
        {messages.length > 1 && (
          <button onClick={clearMessages} disabled={isLoading}
            style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 10, padding: "5px 12px", color: C.muted, fontSize: F.sm, cursor: "pointer" }}>
            {t('clearBtn')}
          </button>
        )}
      </div>

      {/* Demo notice with inline key entry */}
      {apiStatus === "demo" && (
        <DemoKeyEntry />
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 8px" }}>

        {/* Welcome + starters */}
        {fresh && (
          <div style={{ marginBottom: 26, animation: "fadeIn 0.4s ease" }}>
            <div style={{ display: "flex", gap: 11, marginBottom: 14 }}>
              <SaarthiOrb size={33} />
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: "5px 20px 20px 20px", padding: "15px 18px", boxShadow: C.shadow, flex: 1 }}>
                <p style={{ color: C.body, fontSize: F.base, lineHeight: 1.78, margin: "0 0 8px" }}>
                  {t('chatWelcomeGreetingPre')}<strong style={{ color: C.ink }}>Saarthi</strong>{t('chatWelcomeGreetingPost')}
                </p>
                <p style={{ color: C.muted, fontSize: F.base, lineHeight: 1.75, margin: 0 }}>
                  {t('chatWelcomeDesc')}
                </p>
              </div>
            </div>
            <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 10px", paddingLeft: 44 }}>{t('chatStartersLabel')}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 44 }}>
              {CHAT_STARTERS.map(c => (
                <button key={c} onClick={async () => { const fc = await retrieveContext(c); sendUserMessage(c, fc || []); }}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontSize: F.sm, cursor: "pointer", transition: "all 0.18s", boxShadow: C.shadow, lineHeight: 1.4 }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.goldBg; e.currentTarget.style.borderColor = C.goldBdr; e.currentTarget.style.color = C.ink; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.body; }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => <ChatMessage key={m.id} msg={m} onRetry={m.error ? retryLast : null} />)}

        {/* Thinking indicator */}
        {isLoading && (
          <div style={{ display: "flex", gap: 11, marginBottom: 22, animation: "fadeUp 0.2s ease" }}>
            <SaarthiOrb size={33} />
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: "5px 20px 20px 20px", padding: "14px 18px", boxShadow: C.shadow }}>
              <ThinkingBubble label={loadPhase} />
              {countdown > 0 && <p style={{ fontSize: F.xs, color: C.muted, margin: "6px 0 0" }}>({countdown}s)</p>}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.white, padding: "11px 14px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-end", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: "10px 13px", transition: "border-color 0.2s" }}
          onFocus={e => e.currentTarget.style.borderColor = C.saffron}
          onBlur={e  => e.currentTarget.style.borderColor = C.border}>
          <textarea ref={taRef} value={text}
            onChange={e => { setText(e.target.value); autoSize(); }}
            onKeyDown={onKey}
            placeholder={t('chatInputPlaceholder')}
            rows={1}
            style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", color: C.ink, fontSize: F.base, lineHeight: 1.65, minHeight: 42, maxHeight: 130, padding: "2px 0", fontFamily: "inherit" }}
          />
          <button onClick={toggleMic} aria-label={micOn ? "Stop voice input" : "Start voice input"} aria-pressed={micOn}
            style={{ width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0, background: micOn ? "#FEE2E2" : "transparent", color: micOn ? C.red : C.faint, fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s" }}>
            🎙️
          </button>
          <button onClick={send} disabled={!text.trim() || isLoading} aria-label="Send message"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0, cursor: text.trim() && !isLoading ? "pointer" : "not-allowed", background: text.trim() && !isLoading ? C.saffron : C.border, color: C.white, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", boxShadow: text.trim() && !isLoading ? `0 2px 10px rgba(200,85,26,0.35)` : "none" }}>
            ↑
          </button>
        </div>
        <p style={{ fontSize: F.xs, color: C.faint, textAlign: "center", margin: "6px 0 0" }}>
          {t('chatFooterHint')}{HAS_EL ? " · ElevenLabs voice active" : ""}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — BOOKS with bookmarks + continue reading
// ─────────────────────────────────────────────────────────────────────────────

// useBookProgress — imported from AppContext (shared across all views, CRITICAL-2 fix)

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


// ── Curated metadata for the 13 uploaded books — PROPER names, never OCR ────
const BOOK_META = {
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

function BooksView() {
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

function GlobalSearchView({ onNav }) {
  const t = useT();
  const { uiLang } = useUiLang();
  const { profile } = useAuth();
  const { ready, hybridSearch, crossBookSearch } = useKnowledge();
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
          <a href={`/books/${chunk.book}.pdf#page=${(chunk.page || 0) + 1}`} target="_blank" rel="noopener noreferrer"
             onClick={e => e.stopPropagation()}
             style={{ fontSize: F.xs, color: C.saffron, fontWeight: 600, textDecoration: "none" }}
             title="Asli kitab ka yeh page kholein"> · 📄 p.{chunk.page}</a>
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

// SECTION 3 — AUDIO
// ─────────────────────────────────────────────────────────────────────────────


// ── AAJ KA AMRIT: roz har granth ka ek asli paath (Hindi + English) ─────────
let _amritCache = undefined;
async function loadAmrit() {
  if (_amritCache !== undefined) return _amritCache;
  try {
    const r = await fetch("/knowledge/amrit.json");
    _amritCache = r.ok ? (await r.json()) : null;
  } catch { _amritCache = null; }
  return _amritCache;
}

// MP3 manifest — kaunse paath ki natural-awaaz file bani hai (06_amrit_audio.py)
let _amritAudioCache;
async function loadAmritAudio() {
  if (_amritAudioCache !== undefined) return _amritAudioCache;
  try {
    const r = await fetch("/audio/amrit/manifest.json");
    _amritAudioCache = r.ok ? (await r.json()) : null;
  } catch { _amritAudioCache = null; }
  return _amritAudioCache;
}
const dayOfYear = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

function AmritCard({ bid, lesson, idx = 0, playingId, pausedId, onPlay }) {
  const meta = BOOK_META[bid] || {};
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("hi");
  const body = lang === "hi" ? lesson.body_hi : lesson.body_en;
  const conc = lang === "hi" ? lesson.conclusion_hi : lesson.conclusion_en;
  const isPlaying = playingId === bid;
  const isPaused  = pausedId === bid;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", boxShadow: C.shadow }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <span style={{ fontSize: 24 }}>{meta.icon || "📖"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: F.xs, color: C.saffron, fontWeight: 700 }}>{meta.title || bid}</p>
          <p style={{ margin: 0, fontSize: F.base, fontWeight: 700, color: C.ink }}>{lang === "hi" ? lesson.title_hi : lesson.title_en}</p>
        </div>
        <span style={{ color: C.faint, fontSize: F.sm }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["hi", "हिंदी"], ["en", "English"]].map(([l, lab]) => (
              <button key={l} onClick={() => setLang(l)}
                style={{ border: `1px solid ${lang === l ? C.saffron : C.border}`, background: lang === l ? C.goldBg : "transparent", color: lang === l ? C.saffron : C.muted, borderRadius: 14, padding: "3px 12px", fontSize: F.xs + 1, fontWeight: 700, cursor: "pointer" }}>{lab}</button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => onPlay(bid, lesson, lang, idx)}
              style={{ border: "none", background: isPlaying ? C.saffron : C.goldBg, color: isPlaying ? "#fff" : C.saffron, borderRadius: 14, padding: "3px 14px", fontSize: F.xs + 1, fontWeight: 700, cursor: "pointer" }}>
              {isPlaying ? "⏸ Roko" : isPaused ? "▶ Jaari rakhein" : "▶ Sunein"}
            </button>
          </div>
          <p style={{ ...serif, fontSize: F.md, color: C.body, lineHeight: 1.95, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>{body}</p>
          {conc && <p style={{ ...serif, fontSize: F.md, color: C.ink, fontWeight: 600, margin: "0 0 8px" }}>🕉️ {conc}</p>}
          <p style={{ fontSize: F.xs, color: C.faint, margin: 0 }}>— {lesson.source}</p>
        </div>
      )}
    </div>
  );
}

function AmritView() {
  const t = useT();
  const [amrit, setAmrit]         = useState(undefined);
  const [audioMap, setAudioMap]   = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [pausedId,  setPausedId]  = useState(null);
  useEffect(() => { loadAmrit().then(setAmrit); loadAmritAudio().then(setAudioMap); }, []);
  // Component unmount ya tab-switch par audio background mein bajta na reh
  // jaaye — safety cleanup.
  useEffect(() => () => AudioEngine.stop(), []);

  // FIX (#5 — "resume from last position"): pehle button hamesha stop() karta
  // tha, matlab dobara Sunein dabane par shuruaat se hi bajta tha. AudioEngine
  // mein pause()/resume() pehle se maujood the (speechSynthesis + <audio> dono
  // support karte hain) — bas UI se judhe nahi the. Ab: chalte hue = pause,
  // ruke hue (isi lesson ka) = wahi se resume, naya lesson = fresh shuru.
  const onPlay = (bid, lesson, lang, idx = 0) => {
    if (playingId === bid) {                 // abhi bajj raha — pause karo, cancel nahi
      AudioEngine.pause();
      setPlayingId(null);
      setPausedId(bid);
      return;
    }
    if (pausedId === bid) {                   // isi lesson par ruka tha — wahi se aage badhao
      AudioEngine.resume();
      setPlayingId(bid);
      setPausedId(null);
      return;
    }
    // Naya lesson — purana chahe chal raha ho ya ruka ho, poora band karo
    AudioEngine.stop();
    setPausedId(null);

    // PEHLI PASAND: pre-generated natural MP3 (Hindi) — har browser par
    // ek jaisi sundar awaaz, TTS engine ke nakhron se aazaadi.
    if (lang === "hi" && audioMap && audioMap[`${bid}_${idx}`]) {
      AudioEngine.playUrl(`/audio/amrit/${bid}_${idx}.mp3`, {
        onStart: () => setPlayingId(bid),
        onEnd:   () => { setPlayingId(null); setPausedId(null); },
        onError: () => {
          // MP3 load fail (offline?) → browser TTS fallback
          const t = (lesson.body_hi || "") + ". " + (lesson.conclusion_hi || "");
          AudioEngine.speak(t, { langHint: "hi", onStart: () => setPlayingId(bid), onEnd: () => { setPlayingId(null); setPausedId(null); } });
        },
      });
      return;
    }

    // FALLBACK: browser TTS (English tab, ya MP3 abhi bane nahi)
    let text = (lang === "hi" ? lesson.body_hi : lesson.body_en) + ". " +
               ((lang === "hi" ? lesson.conclusion_hi : lesson.conclusion_en) || "");
    // System mein Hindi awaaz na ho toh English version sunao (silence se behtar)
    if (lang === "hi" && AudioEngine.hasHindiVoice() === false) {
      text = (lesson.body_en || "") + ". " + (lesson.conclusion_en || "");
      try {
        if (!localStorage.getItem("SAARTHI_HINDI_VOICE_TIP")) {
          localStorage.setItem("SAARTHI_HINDI_VOICE_TIP", "1");
          alert("ℹ️ Aapke system mein Hindi awaaz install nahi hai, isliye English mein suna rahe hain.\n\nHindi awaaz ke liye: Windows Settings → Time & Language → Speech → Manage voices → Add voices → Hindi.\nYa Microsoft Edge browser use karein — usme sabse natural Hindi awaazein hoti hain.");
        }
      } catch {}
    }
    AudioEngine.speak(text, { langHint: lang, onStart: () => setPlayingId(bid), onEnd: () => { setPlayingId(null); setPausedId(null); } });
  };
  if (amrit === undefined) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>{t('amritLoading')}</div>;
  if (!amrit || !amrit.lessons || !Object.keys(amrit.lessons).length) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "22px 18px" }}>
        <h2 style={{ ...serif, fontSize: F.xxl, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>{t('amritSectionTitle')}</h2>
        <div style={{ background: C.goldBg, border: `1px solid ${C.goldBdr}`, borderRadius: 16, padding: "16px 18px", marginTop: 14 }}>
          <p style={{ fontSize: F.base, color: C.ink, fontWeight: 700, margin: "0 0 8px" }}>Amrit abhi taiyaar nahi hua</p>
          <p style={{ fontSize: F.sm, color: C.body, lineHeight: 1.7, margin: 0 }}>
            Ek baar yeh command chalayein (terminal mein, ~15 min):<br />
            <code style={{ background: "#fff", padding: "2px 8px", borderRadius: 6 }}>python scripts\04_amrit_generate.py</code><br />
            Yeh aapke 13 granthon ke asli anshon se roz ke paath bana kar hamesha ke liye save kar dega. 🙏
          </p>
        </div>
      </div>
    );
  }
  const day = dayOfYear();
  const order = Object.keys(BOOK_META).filter(b => amrit.lessons[b]?.length);
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 18px 40px" }}>
      <h2 style={{ ...serif, fontSize: F.xxl, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{t('amritSectionTitle')}</h2>
      <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 16px" }}>{t('amritViewSubtitle')}</p>
      <div style={{ display: "grid", gap: 10 }}>
        {order.map(bid => {
          const arr = amrit.lessons[bid];
          const li  = day % arr.length;
          const lesson = arr[li];
          return <AmritCard key={bid} bid={bid} lesson={lesson} idx={li} playingId={playingId} pausedId={pausedId} onPlay={onPlay} />;
        })}
      </div>
    </div>
  );
}

function AudioView() {
  const [active,   setActive]   = useState(null); // index of current lesson
  const [playing,  setPlaying]  = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(0);

  const startLesson = (i) => {
    AudioEngine.stop();
    setActive(i); setLoading(true); setPlaying(false); setPaused(false); setProgress(0);
    AudioEngine._stopCallback = () => { setPlaying(false); setPaused(false); setLoading(false); };
    AudioEngine.speak(AUDIO_LESSONS[i].text, {
      onStart:    () => { setLoading(false); setPlaying(true); },
      onProgress: (p) => setProgress(p),
      onEnd:      () => { AudioEngine._stopCallback = null; setPlaying(false); setPaused(false); setLoading(false); setProgress(1); },
      onError:    () => { AudioEngine._stopCallback = null; setPlaying(false); setPaused(false); setLoading(false); },
    });
  };

  const play   = (i) => {
    if (active === i && playing) { AudioEngine.pause();  setPlaying(false); setPaused(true);  return; }
    if (active === i && paused)  { AudioEngine.resume(); setPlaying(true);  setPaused(false); return; }
    startLesson(i);
  };
  const pause  = () => { AudioEngine.pause();  setPlaying(false); setPaused(true); };
  const resume = () => { AudioEngine.resume(); setPlaying(true);  setPaused(false); };
  const stop   = () => { AudioEngine.stop();   setPlaying(false); setPaused(false); setLoading(false); setProgress(0); };
  const goNext = () => { if (active < AUDIO_LESSONS.length - 1) startLesson(active + 1); };
  const goPrev = () => { if (active > 0) startLesson(active - 1); };
  const cur    = active !== null ? AUDIO_LESSONS[active] : null;

  // If a lesson is open, show full lesson view (like ChapterReader)
  if (active !== null && cur) return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background: C.cream }}>
      {/* Header */}
      <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${C.border}`, background:C.white, display:"flex", flexDirection:"column", gap:7, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <button onClick={() => { stop(); setActive(null); }}
            style={{ border:`1px solid ${C.border}`, background:"none", borderRadius:10, padding:"5px 11px", cursor:"pointer", color:C.muted, fontSize:F.sm, flexShrink:0 }}>
            ← Back
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:F.xs, color:C.muted, margin:0 }}>{cur.book} · {cur.duration}</p>
            <p style={{ fontSize:F.base, fontWeight:700, color:C.ink, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {active+1}. {cur.title}
            </p>
          </div>
        </div>
        {/* Controls */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={goPrev} disabled={active===0}
            style={{ padding:"5px 12px", borderRadius:10, border:`1px solid ${C.border}`, background:"none", color:active===0?C.faint:C.muted, cursor:active===0?"default":"pointer", fontSize:F.sm }}>
            ← Prev
          </button>
          <div style={{ flex:1 }} />
          {playing
            ? <button onClick={pause}  style={{ padding:"6px 18px", borderRadius:18, border:`1px solid ${C.saffron}`, background:C.goldBg, color:C.saffron, cursor:"pointer", fontWeight:700, fontSize:F.sm }}>⏸ Pause</button>
            : <button onClick={() => paused ? resume() : startLesson(active)}
                style={{ padding:"6px 18px", borderRadius:18, border:"none", background:C.saffron, color:C.white, cursor:loading?"wait":"pointer", fontWeight:700, fontSize:F.sm }}>
                {loading ? "…" : paused ? "▶ Resume" : "▶ Play"}
              </button>
          }
          <button onClick={() => { stop(); }} style={{ padding:"6px 14px", borderRadius:18, border:`1px solid ${C.border}`, background:"none", color:C.muted, cursor:"pointer", fontSize:F.sm }}>⏹ Stop</button>
          <div style={{ flex:1 }} />
          <button onClick={goNext} disabled={active===AUDIO_LESSONS.length-1}
            style={{ padding:"5px 12px", borderRadius:10, border:`1px solid ${C.border}`, background:"none", color:active===AUDIO_LESSONS.length-1?C.faint:C.muted, cursor:active===AUDIO_LESSONS.length-1?"default":"pointer", fontSize:F.sm }}>
            Next →
          </button>
        </div>
        {/* Progress bar */}
        <div style={{ height:3, background:C.border, borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${Math.round(progress*100)}%`, background:`linear-gradient(90deg, ${C.saffron}, ${C.gold})`, borderRadius:2, transition:"width 0.3s linear" }} />
        </div>
      </div>

      {/* Wave animation when playing */}
      {playing && (
        <div style={{ padding:"8px 18px", background:C.goldBg, borderBottom:`1px solid ${C.goldBdr}50`, display:"flex", gap:10, alignItems:"center", flexShrink:0 }}>
          <div style={{ display:"flex", gap:2.5, height:18, alignItems:"center" }}>
            {Array.from({length:16},(_,i)=>(
              <div key={i} style={{ width:3, borderRadius:2, background:C.saffron, minHeight:3, transformOrigin:"bottom", animation:`wave ${0.5+i%3*0.13}s ease-in-out ${i*0.04}s infinite` }} />
            ))}
          </div>
          <span style={{ fontSize:F.sm, color:C.saffron, fontWeight:600 }}>Sunna jari hai…</span>
        </div>
      )}

      {/* Lesson content — scrollable */}
      <div style={{ flex:1, overflowY:"auto", padding:"28px 22px 48px" }}>
        <div style={{ maxWidth:660, margin:"0 auto" }}>
          <div style={{ fontSize:36, marginBottom:12, textAlign:"center" }}>{cur.icon}</div>
          <h1 style={{ ...serif, fontSize:F.xxl, fontWeight:400, color:C.ink, margin:"0 0 6px", lineHeight:1.25, textAlign:"center" }}>{cur.title}</h1>
          <p style={{ fontSize:F.sm, color:C.muted, margin:"0 0 28px", paddingBottom:20, borderBottom:`1px solid ${C.border}`, textAlign:"center" }}>
            {cur.book} · {cur.duration}
          </p>
          <Prose text={cur.text} size={16} />
          {/* Next lesson nudge */}
          {active < AUDIO_LESSONS.length - 1 && (
            <button onClick={goNext}
              style={{ marginTop:32, display:"flex", alignItems:"center", gap:12, padding:"14px 18px", borderRadius:16, border:`1px solid ${C.border}`, background:C.white, cursor:"pointer", width:"100%", textAlign:"left" }}>
              <span style={{ fontSize:24 }}>▶</span>
              <div>
                <p style={{ fontSize:F.xs+1, color:C.saffron, fontWeight:700, margin:"0 0 2px" }}>Agla Lesson</p>
                <p style={{ fontSize:F.sm, color:C.body, margin:0 }}>{AUDIO_LESSONS[active+1].title}</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.cream }}>
      <div style={{ padding: "20px 18px 14px", background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontSize: F.xl + 2, fontWeight: 800, color: C.ink, margin: "0 0 4px", letterSpacing: -0.4 }}>🎧 Audio Lessons</h1>
        <p style={{ fontSize: F.base, color: C.muted, margin: 0 }}>
          Yeh 6 chhote paath (lessons) hain — har ek, ek badi seekh ko 10-20 minute mein samjhata hai
          {HAS_EL && <span style={{ marginLeft: 8, fontSize: F.xs, background: C.goldBg, color: C.gold, border: `1px solid ${C.goldBdr}`, borderRadius: 20, padding: "2px 9px", fontWeight: 700 }}>ElevenLabs ✓</span>}
        </p>
      </div>

      {/* Now playing card */}
      {cur && (
        <div style={{ margin: "14px 18px 4px", padding: "16px 18px", borderRadius: 18, background: C.goldBg, border: `1px solid ${C.goldBdr}60`, boxShadow: C.shadowMd, animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {loading ? (
              <div style={{ display: "flex", gap: 4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.saffron, animation: `typingDot 1.1s ease-in-out ${i*0.18}s infinite` }} />)}
              </div>
            ) : playing ? (
              <div style={{ display: "flex", gap: 2.5, height: 20, alignItems: "center" }}>
                {Array.from({length: 14}, (_, i) => (
                  <div key={i} style={{ width: 3, borderRadius: 2, background: C.saffron, minHeight: 3, transformOrigin: "bottom", animation: `wave ${0.5+i%3*0.13}s ease-in-out ${i*0.04}s infinite` }} />
                ))}
              </div>
            ) : <span style={{ fontSize: 16, color: C.saffron }}>⏸</span>}
            <span style={{ fontSize: F.sm, color: C.saffron, fontWeight: 700 }}>
              {loading ? "Preparing…" : playing ? "Now playing" : "Paused"}
            </span>
          </div>
          <p style={{ fontSize: F.md, fontWeight: 700, color: C.ink, margin: "0 0 3px" }}>{cur.title}</p>
          <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 8px" }}>{cur.book} · {cur.duration}</p>
          {/* Progress bar */}
          <div style={{ height: 3, background: C.border, borderRadius: 2, margin: "0 0 12px", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${Math.round(progress * 100)}%`,
                          background: `linear-gradient(90deg,${C.saffron},${C.gold})`,
                          transition: "width 0.4s linear" }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {playing
              ? <Btn variant="soft"  size="sm" onClick={pause}>⏸ Pause</Btn>
              : <Btn variant="soft"  size="sm" onClick={resume} disabled={!paused}>▶ Resume</Btn>}
            <Btn variant="ghost" size="sm" onClick={() => { stop(); setActive(null); }}>⏹ Stop</Btn>
          </div>
        </div>
      )}

      {/* Lesson list — like book chapter list */}
      <div style={{ padding:"14px 18px 32px", display:"grid", gap:8 }}>
        {AUDIO_LESSONS.map((l, i) => (
          <button key={l.id} onClick={() => startLesson(i)}
            style={{ display:"flex", alignItems:"center", gap:13, padding:"14px 15px", borderRadius:14,
                     border:`1px solid ${C.border}`, background:C.white, cursor:"pointer",
                     textAlign:"left", width:"100%", transition:"all 0.18s", boxShadow:C.shadow }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${l.color}12`, border:`2px solid ${l.color}20`,
                         display:"flex", alignItems:"center", justifyContent:"center", fontSize:F.sm,
                         fontWeight:700, color:l.color, flexShrink:0 }}>
              {i+1}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:F.base, fontWeight:600, color:C.ink, margin:"0 0 2px" }}>{l.title}</p>
              <p style={{ fontSize:F.xs+1, color:C.muted, margin:0 }}>{l.book} · {l.duration}</p>
            </div>
            <span style={{ color:C.faint, fontSize:18, flexShrink:0 }}>▶</span>
          </button>
        ))}
      </div>

      {/* ElevenLabs setup note */}
      {!HAS_EL && (
        <div style={{ margin: "0 18px 24px", padding: "14px 16px", borderRadius: 14, background: C.white, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 4px", fontWeight: 700 }}>✨ Upgrade to ElevenLabs voice</p>
          <p style={{ fontSize: F.xs + 1, color: C.muted, margin: "0 0 8px", lineHeight: 1.55 }}>
            Add <code style={{ background: C.goldBg, padding: "1px 5px", borderRadius: 4, fontSize: F.xs }}>VITE_ELEVENLABS_API_KEY</code> to your .env for a premium, natural voice experience.
          </p>
          <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs + 1, color: C.saffron, fontWeight: 700, textDecoration: "none" }}>Get ElevenLabs free →</a>
        </div>
      )}
    </div>
  );
}

function AudioLessonCard({ lesson: l, isActive, isPlaying, isPaused, isLoading, onPlay }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", gap: 13, alignItems: "center", padding: "15px 15px", borderRadius: 16, border: `1px solid ${isActive ? l.color+"50" : hov ? C.borderMd : C.border}`, background: isActive ? `${l.color}08` : hov ? "#FDFAF6" : C.white, transition: "all 0.18s", boxShadow: isActive || hov ? C.shadowMd : C.shadow }}>
      <div style={{ width: 50, height: 50, borderRadius: 15, background: `${l.color}12`, border: `2px solid ${l.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{l.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: "0 0 3px", lineHeight: 1.3 }}>{l.title}</p>
        <p style={{ fontSize: F.xs + 1, color: C.muted, margin: "0 0 4px" }}>{l.book} · {l.duration}</p>
        <p style={{ fontSize: F.sm, color: C.body, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.55 }}>{l.desc}</p>
        {isPlaying && (
          <div style={{ display: "flex", gap: 2, marginTop: 7, height: 12, alignItems: "center" }}>
            {Array.from({length: 10}, (_, i) => <div key={i} style={{ width: 2.5, borderRadius: 2, background: l.color, minHeight: 2, transformOrigin: "bottom", animation: `wave ${0.5+i%3*0.12}s ease-in-out ${i*0.04}s infinite` }} />)}
          </div>
        )}
      </div>
      <button onClick={onPlay}
        style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", background: isActive ? l.color : "#F0EDE8", color: isActive ? C.white : C.muted, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", boxShadow: isActive ? `0 3px 12px ${l.color}44` : "none" }}>
        {isLoading ? "…" : isPlaying ? "⏸" : isPaused ? "▶" : "▶"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — PDF UPLOAD (Real PDF.js parsing + real AI document Q&A)
// ─────────────────────────────────────────────────────────────────────────────

// FEATURE (#12 — free-tier PDF fixed format): pehle yeh khud-ba-khud fire
// hota tha (upload hote hi, bina poochhe) — user-feedback ke baad ab yeh
// baaki PDF_CHIPS jaisa hi ek opt-in, click-karo-tab-chale chip hai (bas
// pehle number par, thoda alag rang se "featured/suggested" dikhta hai),
// taaki AI-quota sirf tab kharch ho jab user khud chunay.
//
// FIX (2026-07-24, round 2): user ne saaf kiya — ek hi bade combined
// command mein saransh+points+MCQ maangna AI ke liye bahut bhaari hai
// (jawab truncate/adhura ho jaata hai, khaaskar 500+ page books par).
// Ab teen ALAG chhote chip hain — har click apna ALAG, chhota AI-sawaal
// bhejta hai, apne ALAG chat-bubble mein aata hai (yehi "3 block" hai —
// koi ek jawab ke andar ## headings ki zaroorat nahi). Free = 5/5, Paid
// (owner demo) = 50/50, teen-teen alag chip dono jagah.
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

function UploadView() {
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
function GlobalLangToggle() {
  const t = useT();
  const { uiLang, setUiLang } = useUiLang();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 18px 0" }}>
      <AuthBar />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: F.xs, color: C.muted, fontWeight: 600, letterSpacing: "0.03em" }}>{t('langToggleLabel')}</span>
        <div style={{ display: "flex", gap: 3, background: C.white, border: `1.5px solid ${C.goldBdr}`, borderRadius: 20, padding: 3, boxShadow: C.shadow }}>
          {[["hi", "हिंदी"], ["en", "English"]].map(([code, label]) => (
            <button key={code} onClick={() => setUiLang(code)} aria-pressed={uiLang === code}
              style={{
                border: "none", borderRadius: 17, padding: "6px 15px", cursor: "pointer",
                fontSize: F.sm, fontWeight: 700, transition: "all 0.18s",
                background: uiLang === code ? C.saffron : "transparent",
                color: uiLang === code ? C.white : C.muted,
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — item #15, Google Sign-In + Name/DOB (SMS-OTP ki jagah, user ka
// final faisla — free hai, koi DLT/SMS-provider registration nahi chahiye)
// ─────────────────────────────────────────────────────────────────────────────

function AuthBar() {
  const { uiLang } = useUiLang();
  const { isSignedIn, firstName, profile, signOut } = useAuth();
  const en = uiLang === "en";
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isSignedIn) return <GoogleSignInButton compact />;

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setMenuOpen(o => !o)} aria-haspopup="true" aria-expanded={menuOpen} aria-label={`${firstName} — ${en ? "account menu" : "खाता मेनू"}`}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 5px", borderRadius: 20,
                 border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", boxShadow: C.shadow }}>
        {profile?.picture
          ? <img src={profile.picture} alt="" referrerPolicy="no-referrer" style={{ width: 24, height: 24, borderRadius: "50%" }} />
          : <span style={{ width: 24, height: 24, borderRadius: "50%", background: C.goldBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.gold }}>{firstName?.[0] || "🙏"}</span>}
        <span style={{ fontSize: F.xs + 1, fontWeight: 700, color: C.ink }}>{firstName} {en ? "" : "जी"}</span>
      </button>
      {menuOpen && (
        <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 60, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowMd, minWidth: 160, overflow: "hidden" }}>
          <button onClick={() => { setMenuOpen(false); signOut(); }}
            style={{ width: "100%", padding: "10px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontSize: F.sm, color: C.red, fontWeight: 600 }}>
            {en ? "Sign out" : "साइन आउट करें"}
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleSignInButton({ compact }) {
  const { uiLang } = useUiLang();
  const { handleCredential } = useAuth();
  const btnRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const en = uiLang === "en";

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) { setFailed(true); return; }
    let cancelled = false;
    loadGoogleScript().then(() => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
      });
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "outline", size: compact ? "medium" : "large",
          text: "signin_with", shape: "pill", locale: en ? "en" : "hi",
        });
      }
      setReady(true);
    }).catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [handleCredential, compact, en]);

  if (failed) {
    // Client ID abhi set nahi — developer ko saaf sandesh, user ko crash nahi
    return compact ? null : (
      <p style={{ fontSize: F.xs, color: C.faint, textAlign: "center" }}>
        {en ? "Google Sign-In setup pending." : "Google Sign-In सेटअप बाकी है।"}
      </p>
    );
  }
  return <div ref={btnRef} style={{ display: "inline-block", opacity: ready ? 1 : 0, minWidth: compact ? 120 : 220, minHeight: 40 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS — item #15, asli push notification. Sirf ek chhota toggle:
// on karne par browser permission maang kar Cloudflare Worker ko subscribe
// bhej deta hai (deploy/cloudflare-worker.js ka naya /push/subscribe route +
// scheduled() cron din mein 2-3 baar bhejta hai — is button ka kaam sirf
// "subscribe" karna hai, bhejna Worker karta hai).
function ReminderToggle() {
  const { uiLang } = useUiLang();
  const { profile } = useAuth();
  const en = uiLang === "en";
  const supported = isPushSupported();
  const [enabled, setEnabled] = useState(isPushEnabledLocally());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!supported) return null; // purane browser/iOS Safari home-screen-add ke bina — chup rahega

  const toggle = async () => {
    setErr(""); setBusy(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        const res = await subscribeToPush(profile);
        if (res.ok) { setEnabled(true); }
        else if (res.reason === "denied") {
          setErr(en ? "Notification permission denied — browser settings mein allow karein."
                     : "Notification permission मना कर दी गई — browser settings में allow करें।");
        } else if (res.reason === "not_configured") {
          setErr(en ? "Reminders aren't set up on the server yet." : "Reminders अभी server पर सेटअप नहीं हैं।");
        } else {
          setErr(en ? "Couldn't turn on reminders — please try again." : "Reminders चालू नहीं हो पाए — कृपया दोबारा कोशिश करें।");
        }
      }
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "15px 16px", marginTop: 12, borderRadius: 16, border: `1.5px solid ${C.border}`, background: C.white, boxShadow: C.shadow }}>
      <span style={{ fontSize: 26 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: F.base, fontWeight: 700, color: C.ink }}>
          {en ? "Daily reminders" : "रोज़ाना याद-दिलाना"}
        </p>
        <p style={{ margin: 0, fontSize: F.xs + 1, color: C.muted }}>
          {en ? "Gentle nudges to read Amrit + ask a question" : "अमृत पढ़ने और सवाल पूछने की हल्की याद-दिलाना"}
        </p>
        {err && <p style={{ margin: "4px 0 0", fontSize: F.xs, color: C.red }}>{err}</p>}
      </div>
      <button onClick={toggle} disabled={busy} role="switch" aria-checked={enabled}
        aria-label={en ? "Daily reminders" : "रोज़ाना याद-दिलाना"}
        style={{ width: 46, height: 26, borderRadius: 20, border: "none", cursor: busy ? "default" : "pointer",
                 background: enabled ? C.saffron : C.border, position: "relative", flexShrink: 0, transition: "background 0.18s" }}>
        <span style={{ position: "absolute", top: 3, left: enabled ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
                       background: C.white, boxShadow: C.shadow, transition: "left 0.18s" }} />
      </button>
    </div>
  );
}

// UX FIX (audit 2026-07-25): Chat/Search/Vedic teeno jagah quota alag-alag
// wording/style mein dikhta tha ("Aaj ke X AI-sawaal bache" / "Free
// Nishkarsh left today" / "Today's free questions left") — ab ek hi
// reusable "pill" component, teeno jagah consistent look + wording.
function QuotaPill({ left, uiLang, labelHi, labelEn }) {
  const en = uiLang === "en";
  const isLow = left !== Infinity && left <= 1;
  const label = en ? (labelEn || "Free left today") : (labelHi || "आज बचे मुफ़्त");
  const value = left === Infinity ? "∞" : left;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 11px",
      borderRadius: 20, fontSize: F.xs, fontWeight: 700,
      background: left === Infinity ? C.goldBg : (isLow ? "#FEE2E2" : C.cream),
      border: `1px solid ${left === Infinity ? C.goldBdr : (isLow ? C.red + "55" : C.border)}`,
      color: left === Infinity ? C.gold : (isLow ? C.red : C.muted),
    }}>
      {label}: {value}
    </span>
  );
}

function DobCollectionModal() {
  const { uiLang } = useUiLang();
  const { pendingGoogleUser, completeProfile, dismissPending } = useAuth();
  const [dob, setDob] = useState("");
  const en = uiLang === "en";
  if (!pendingGoogleUser) return null;

  const canSubmit = /^\d{4}-\d{2}-\d{2}$/.test(dob);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(24,18,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.white, borderRadius: 20, padding: 26, maxWidth: 360, width: "100%", boxShadow: C.shadowLg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {pendingGoogleUser.picture
            ? <img src={pendingGoogleUser.picture} alt="" referrerPolicy="no-referrer" style={{ width: 44, height: 44, borderRadius: "50%" }} />
            : <span style={{ fontSize: 32 }}>🙏</span>}
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: C.ink, fontSize: F.base }}>{pendingGoogleUser.name}</p>
            <p style={{ margin: 0, fontSize: F.xs, color: C.muted }}>{pendingGoogleUser.email}</p>
          </div>
        </div>
        <p style={{ fontSize: F.sm, color: C.body, margin: "0 0 14px", lineHeight: 1.6 }}>
          {en ? "Welcome to SAARTHI 🙏 Please share your date of birth — this helps us personalize your experience (like birthday wishes)."
              : "SAARTHI में आपका स्वागत है 🙏 कृपया अपनी जन्मतिथि बताएं — इससे आपका अनुभव व्यक्तिगत बनाने में मदद मिलेगी (जैसे जन्मदिन की शुभकामनाएं)।"}
        </p>
        <input type="date" value={dob} onChange={e => setDob(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.borderMd}`, fontSize: F.base, marginBottom: 16, outline: "none" }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={dismissPending}
            style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.white, color: C.muted, fontWeight: 600, cursor: "pointer" }}>
            {en ? "Later" : "बाद में"}
          </button>
          <button onClick={() => completeProfile(dob)} disabled={!canSubmit}
            style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", cursor: canSubmit ? "pointer" : "default",
                     background: canSubmit ? C.saffron : C.faint, color: C.white, fontWeight: 700 }}>
            {en ? "Continue" : "जारी रखें"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VEDIC TIME — item #14, Vikramaditya Vedic Clock ka SAARTHI version
// 100% client-side live panchang (src/services/panchang.js) — koi hardcoded
// date/tithi nahi. Teen andar-ki-taraf screens: Aaj (dashboard), Sikhein
// (8 chhote paath), Poochein (AI se sawaal, panchang context ke saath).
// ─────────────────────────────────────────────────────────────────────────────

// Item #12 quota logic ab src/services/quota.js mein hai (2026-07-25:
// App.jsx se nikala, taaki unit-test ho sake bina poora App import kiye).

function fmtTime(d, uiLang) {
  if (!d) return "—";
  try { return d.toLocaleTimeString(uiLang === "en" ? "en-IN" : "hi-IN", { hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

function buildPanchangSummaryText(p, uiLang) {
  if (!p) return "";
  const tn = tithiName(p.tithi.inPaksha, p.tithi.paksha);
  const lines = [
    `Date/Time: ${p.date.toLocaleString(uiLang === "en" ? "en-IN" : "hi-IN")}`,
    `Tithi: ${tn.hi} / ${tn.en} (${p.tithi.paksha === "shukla" ? "Shukla Paksha" : "Krishna Paksha"})`,
    `Nakshatra: ${NAKSHATRAS[p.nakshatra.index].hi} / ${NAKSHATRAS[p.nakshatra.index].en} (Pada ${p.nakshatra.pada})`,
    `Yoga: ${YOGAS[p.yoga.index].hi} / ${YOGAS[p.yoga.index].en}`,
    `Karana: ${KARANAS[p.karana.key].hi} / ${KARANAS[p.karana.key].en}`,
    `Vaar (weekday): ${VAARS[p.vaar.index].hi} / ${VAARS[p.vaar.index].en}`,
    `Ritu (season): ${RITUS[p.ritu.index].hi} / ${RITUS[p.ritu.index].en}`,
    `Hindu Month (approx): ${HINDU_MONTHS[p.hinduMonth.key].hi} / ${HINDU_MONTHS[p.hinduMonth.key].en}`,
    `Vikram Samvat (approx): ${p.vikramSamvat.value}`,
    `Muhurta: ${muhurtaLabel(p.muhurta.index, "en")} (index ${p.muhurta.index != null ? p.muhurta.index + 1 : "—"} of 30, ~48 min each, Brahma Muhurta = last one before sunrise)`,
    `Sunrise: ${fmtTime(p.sunrise, "en")}, Sunset: ${fmtTime(p.sunset, "en")}`,
  ];
  return lines.join("\n");
}

function VedicTimeView() {
  const { uiLang } = useUiLang();
  const t = useT();
  const [screen, setScreen] = useState("today"); // today | learn | ask
  const [loc, setLoc]       = useState(null);
  const [now, setNow]       = useState(new Date());
  const [prefillQ, setPrefillQ] = useState("");

  useEffect(() => {
    let alive = true;
    getUserLocation().then(l => { if (alive) setLoc(l); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const panchang = loc ? computePanchang(now, loc.lat, loc.lon) : computePanchang(now);

  const goAsk = (q) => { setPrefillQ(q); setScreen("ask"); };

  const TABS3 = [
    { id: "today", label: uiLang === "en" ? "Today"  : "आज" },
    { id: "learn", label: uiLang === "en" ? "Learn"   : "सीखें" },
    { id: "ask",   label: uiLang === "en" ? "Ask"     : "पूछें" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.cream }}>
      <div style={{ padding: "18px 22px 14px", background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: F.xs + 1, color: C.gold, margin: "0 0 4px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          🕉️ {uiLang === "en" ? "Vedic Time" : "वैदिक समय"}
        </p>
        <h1 style={{ ...serif, fontSize: F.h1 - 2, fontWeight: 500, color: C.ink, margin: "0 0 6px" }}>
          {uiLang === "en" ? "Vikramaditya Vedic Clock" : "विक्रमादित्य वैदिक घड़ी"}
        </h1>
        <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
          {uiLang === "en"
            ? "Understand today's Panchang in simple language."
            : "आज के पंचांग को सरल भाषा में समझें।"}
        </p>
        <div style={{ display: "flex", gap: 6, background: C.cream, padding: 4, borderRadius: 14, border: `1px solid ${C.border}` }}>
          {TABS3.map(tb => (
            <button key={tb.id} onClick={() => setScreen(tb.id)}
              style={{ flex: 1, padding: "9px 6px", borderRadius: 10, border: "none", cursor: "pointer",
                       background: screen === tb.id ? C.white : "transparent",
                       boxShadow: screen === tb.id ? C.shadow : "none",
                       color: screen === tb.id ? C.saffron : C.muted,
                       fontWeight: screen === tb.id ? 700 : 500, fontSize: F.sm, transition: "all 0.18s" }}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {screen === "today" && <VedicTodayPanel panchang={panchang} uiLang={uiLang} loc={loc} onAsk={goAsk} />}
      {screen === "learn" && <VedicLearnPanel uiLang={uiLang} onAsk={goAsk} />}
      {screen === "ask"   && <VedicAskPanel uiLang={uiLang} panchang={panchang} prefill={prefillQ} onConsumePrefill={() => setPrefillQ("")} />}
    </div>
  );
}

function VedicRow({ icon, label, value, sub, uiLang }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px",
                  borderRadius: 14, border: `1px solid ${C.border}`, background: C.white, marginBottom: 8 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: F.xs + 1, color: C.muted, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, fontSize: F.base, color: C.ink, fontWeight: 700 }}>{value}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: F.xs, color: C.faint }}>{sub}</p>}
      </div>
    </div>
  );
}

function VedicTodayPanel({ panchang, uiLang, loc, onAsk }) {
  const p = panchang;
  const tn = tithiName(p.tithi.inPaksha, p.tithi.paksha);
  const nak = NAKSHATRAS[p.nakshatra.index];
  const yog = YOGAS[p.yoga.index];
  const kar = KARANAS[p.karana.key];
  const vaar = VAARS[p.vaar.index];
  const ritu = RITUS[p.ritu.index];
  const month = HINDU_MONTHS[p.hinduMonth.key];
  const approxTag = uiLang === "en" ? " (approx.)" : " (अनुमानित)";
  const en = uiLang === "en";

  const rows = [
    { icon: "🕐", label: en ? "Current Time" : "वर्तमान समय", value: fmtTime(p.date, uiLang) },
    { icon: "🌅", label: en ? "Sunrise" : "सूर्योदय", value: fmtTime(p.sunrise, uiLang) },
    { icon: "🌇", label: en ? "Sunset" : "सूर्यास्त", value: fmtTime(p.sunset, uiLang) },
    { icon: "🪔", label: en ? "Muhurta" : "मुहूर्त", value: muhurtaLabel(p.muhurta.index, uiLang) },
    { icon: "🌙", label: en ? "Tithi" : "तिथि", value: en ? tn.en : tn.hi, sub: en ? `${p.tithi.paksha === "shukla" ? "Shukla" : "Krishna"} Paksha` : `${p.tithi.paksha === "shukla" ? "शुक्ल" : "कृष्ण"} पक्ष` },
    { icon: "⭐", label: en ? "Nakshatra" : "नक्षत्र", value: `${en ? nak.en : nak.hi} · ${en ? "Pada" : "पद"} ${p.nakshatra.pada}` },
    { icon: "☯️", label: en ? "Yoga" : "योग", value: en ? yog.en : yog.hi },
    { icon: "◑", label: en ? "Karana" : "करण", value: en ? kar.en : kar.hi },
    { icon: "📅", label: en ? "Vaar (Weekday)" : "वार", value: en ? vaar.en : vaar.hi },
    { icon: "🍃", label: en ? "Ritu (Season)" : "ऋतु", value: en ? ritu.en : ritu.hi },
    { icon: "🌸", label: en ? "Hindu Month" : "हिंदू मास", value: (en ? month.en : month.hi) + approxTag },
    { icon: "🪷", label: en ? "Vikram Samvat" : "विक्रम संवत", value: p.vikramSamvat.value + approxTag },
  ];

  return (
    <div style={{ padding: 18 }}>
      {loc?.isDefault && (
        <p style={{ fontSize: F.xs, color: C.faint, margin: "0 0 12px", lineHeight: 1.6, padding: "8px 12px", background: C.goldBg, borderRadius: 10 }}>
          {en
            ? "📍 Location permission not given — showing Ujjain (traditional reference) time. Allow location for your city's exact sunrise/muhurta."
            : "📍 लोकेशन अनुमति नहीं मिली — उज्जैन (पारंपरिक संदर्भ) का समय दिखाया जा रहा है। अपने शहर का सटीक सूर्योदय/मुहूर्त देखने के लिए लोकेशन अनुमति दें।"}
        </p>
      )}
      {rows.map(r => <VedicRow key={r.label} {...r} uiLang={uiLang} />)}

      <div style={{ marginTop: 6, padding: "14px 16px", borderRadius: 14, background: C.goldBg, border: `1px solid ${C.goldBdr}50` }}>
        <p style={{ margin: 0, fontSize: F.xs, color: C.muted, lineHeight: 1.7 }}>
          {en
            ? "This is a live astronomical calculation done in your browser (Sun/Moon position, Lahiri ayanamsa) — not a fixed lookup table. Accuracy is close to standard Panchang apps but may differ by a few minutes near tithi/nakshatra boundaries."
            : "यह आपके ब्राउज़र में लाइव खगोलीय गणना (सूर्य/चंद्र स्थिति, लाहिड़ी अयनांश) से बना है — कोई तय टेबल नहीं। सामान्य पंचांग ऐप्स जितनी सटीकता है, पर तिथि/नक्षत्र बदलने के ठीक समय पर कुछ मिनट का अंतर हो सकता है।"}
        </p>
      </div>

      <button onClick={() => onAsk(en ? "What does today's panchang mean for me?" : "आज के पंचांग का मेरे लिए क्या मतलब है?")}
        style={{ width: "100%", marginTop: 14, padding: "13px", borderRadius: 14, border: "none", cursor: "pointer",
                 background: `linear-gradient(140deg, ${C.saffronL}, ${C.gold})`, color: C.white, fontWeight: 700, fontSize: F.base }}>
        {en ? "🙏 Ask SAARTHI to explain" : "🙏 SAARTHI से समझें"}
      </button>
    </div>
  );
}

function VedicLearnPanel({ uiLang, onAsk }) {
  const en = uiLang === "en";
  const [openId, setOpenId] = useState(null);
  return (
    <div style={{ padding: 18 }}>
      {VEDIC_LESSONS.map(lesson => {
        const open = openId === lesson.id;
        return (
          <div key={lesson.id} style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.white, marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => setOpenId(open ? null : lesson.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 15px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 22 }}>{lesson.icon}</span>
              <span style={{ flex: 1, fontSize: F.base, fontWeight: 700, color: C.ink }}>{lesson.title[uiLang] || lesson.title.hi}</span>
              <span style={{ color: C.faint, fontSize: 16, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>›</span>
            </button>
            {open && (
              <div style={{ padding: "0 15px 16px" }}>
                <p style={{ margin: "0 0 12px", fontSize: F.sm, color: C.body, lineHeight: 1.75 }}>
                  {lesson.body[uiLang] || lesson.body.hi}
                </p>
                <button onClick={() => onAsk(lesson.title[uiLang] || lesson.title.hi)}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.goldBdr}`, background: C.goldBg, color: C.gold, fontWeight: 700, fontSize: F.xs + 1, cursor: "pointer" }}>
                  {en ? "Ask SAARTHI ›" : "SAARTHI से पूछें ›"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VedicAskPanel({ uiLang, panchang, prefill, onConsumePrefill }) {
  const en = uiLang === "en";
  const { profile } = useAuth();
  const [q, setQ]           = useState(prefill || "");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState("");
  const [left, setLeft]     = useState(featureQuotaLeft("vedic", VEDIC_QUOTA_LIMIT, profile));
  const askedRef = useRef(false);

  useEffect(() => {
    if (prefill && prefill !== q) setQ(prefill);
  }, [prefill]); // eslint-disable-line

  // 6 suggestions (2026-07-24 fix: user ne 4 already + 2 more maange, taaki
  // computed panchang fields (yoga/karana/month/ritu) bhi cover ho jaayein)
  const SUGGESTIONS = en
    ? ["What is today's Nakshatra?", "Is now a good time to meditate?", "What is Brahma Muhurta?", "What is today's Tithi?", "What Yoga and Karana is it today?", "Which Hindu month and Ritu (season) is it?"]
    : ["आज कौन-सा नक्षत्र है?", "क्या अभी ध्यान का अच्छा समय है?", "ब्रह्म मुहूर्त क्या है?", "आज कौन-सी तिथि है?", "आज कौन-सा योग और करण है?", "आज हिंदू महीना और ऋतु कौन-सी है?"];

  const ask = async (question) => {
    const query = (question || q || "").trim();
    if (!query || busy) return;
    if (!hasApiKey()) { setErr(en ? "AI abhi setup nahi hai." : "AI अभी सेटअप नहीं है।"); return; }
    // ITEM #2 (server-side): asli gate Worker se — localStorage sirf fallback.
    const preQ = await serverQuotaConsume("vedic");
    if (preQ) {
      if (!preQ.allowed) {
        setErr(en ? "Today's free AI limit is over — please try again tomorrow." : "आज की मुफ़्त AI सीमा खत्म हो गई — कृपया कल फिर से कोशिश करें।");
        return;
      }
      syncLocalQuotaFromServer("vedic", preQ.limit, preQ.remaining);
    } else if (featureQuotaLeft("vedic", VEDIC_QUOTA_LIMIT, profile) <= 0) {
      setErr(en ? "Today's free AI limit is over — please try again tomorrow." : "आज की मुफ़्त AI सीमा खत्म हो गई — कृपया कल फिर से कोशिश करें।");
      return;
    }
    setBusy(true); setErr(""); setAnswer("");
    try {
      const summary = buildPanchangSummaryText(panchang, uiLang);
      const out = await askAboutVedicTime(query, summary);
      setAnswer(out);
      // Server ne (preQ truthy hone par) upar hi consume kar diya — display
      // ke liye ab bhi local helper hi call karte hain taaki `left` state
      // turant, synchronously update ho (preQ.remaining bhi wahi value hai).
      setLeft(preQ ? (typeof preQ.remaining === "number" ? preQ.remaining : Infinity) : featureQuotaUse("vedic", VEDIC_QUOTA_LIMIT, profile));
    } catch (e) {
      setErr(en ? "Kuch problem aa gayi — dobara try karein." : "कुछ समस्या आ गई — कृपया दोबारा कोशिश करें।");
    } finally {
      setBusy(false);
      onConsumePrefill?.();
    }
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ margin: "0 0 12px" }}>
        <QuotaPill left={left} uiLang={uiLang} labelHi="आज बचे मुफ़्त सवाल" labelEn="Today's free questions left" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQ(s); ask(s); }}
            style={{ padding: "7px 12px", borderRadius: 18, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontSize: F.xs + 1, cursor: "pointer" }}>
            {s}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") ask(); }}
          placeholder={en ? "Ask about today's Vedic time…" : "आज के वैदिक समय के बारे में पूछें…"}
          style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.borderMd}`, fontSize: F.base, outline: "none" }} />
        <button onClick={() => ask()} disabled={busy}
          style={{ padding: "0 18px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer",
                   background: busy ? C.faint : C.saffron, color: C.white, fontWeight: 700 }}>
          {busy ? "…" : (en ? "Ask" : "पूछें")}
        </button>
      </div>
      {err && <p style={{ color: C.red, fontSize: F.sm, marginBottom: 12 }}>{err}</p>}
      {answer && (
        <div style={{ padding: "16px", borderRadius: 14, background: C.white, border: `1px solid ${C.border}`, whiteSpace: "pre-wrap", fontSize: F.base, color: C.body, lineHeight: 1.8 }}>
          {answer}
        </div>
      )}
    </div>
  );
}

function HomeView({ onNav }) {
  const t = useT();
  const { uiLang } = useUiLang();
  const hour    = new Date().getHours();
  const wisdom   = DAILY_WISDOMS[new Date().getDate() % DAILY_WISDOMS.length];
  // Engine books for "Continue Reading" section (enriches static BOOKS with real indexed ones)
  const { ready: kReady, getBooks: getEngineBooks } = useKnowledge();
  // item #15: signed-in user ka naam + janamdin ka in-app badhai banner
  // (real push notification nahi — koi backend/service-worker infra nahi,
  // sirf app kholne par dikhta hai; future upgrade ke liye note kiya gaya)
  const { isSignedIn, firstName, profile } = useAuth();
  const isBirthday = (() => {
    if (!profile?.dob) return false;
    const dob = new Date(profile.dob + "T00:00:00");
    const now = new Date();
    return dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate();
  })();

  // Mood-based greeting — time-aware, keyed into STRINGS so it follows the
  // global UI-language toggle
  const HERO_SLOTS = [
    { from:  5, to: 11, key: "greetMorning" },
    { from: 12, to: 16, key: "greetAfternoon" },
    { from: 17, to: 20, key: "greetEvening" },
    { from: 21, to: 23, key: "greetNight" },
    { from:  0, to:  4, key: "greetLateNight" },
  ];
  const slot = HERO_SLOTS.find(s => hour >= s.from && hour <= s.to) || HERO_SLOTS[0];
  const [wPlaying, setWPlaying] = useState(false);
  const { lastChapter } = useBookProgress();

  const listenWisdom = () => {
    if (wPlaying) { AudioEngine.stop(); setWPlaying(false); return; }
    AudioEngine._stopCallback = () => setWPlaying(false);
    AudioEngine.speak(`${wisdom.text}. From ${wisdom.src}.`, {
      onEnd: () => { AudioEngine._stopCallback = null; setWPlaying(false); },
    });
    setWPlaying(true);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.cream }}>

      {/* Global UI-language toggle — controls the whole app's chrome text.
          Kept visually separate from the date line + AmritCard's own
          per-lesson Hindi/English toggle (neither is touched by this). */}
      <GlobalLangToggle />

      {/* Hero — Daily Spiritual Dashboard */}
      <div style={{ padding: "18px 22px 24px", background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: F.xs + 1, color: C.muted, margin: "0 0 4px", fontWeight: 500, letterSpacing: "0.04em" }}>
          {isSignedIn ? `Namaste, ${firstName}${uiLang === "en" ? "" : " जी"} 🙏` : "Namaste 🙏"} · {new Date().toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 style={{ ...serif, fontSize: F.h1, fontWeight: 500, color: C.ink, margin: "0 0 6px", letterSpacing: -0.3, lineHeight: 1.15 }}>{t(slot.key)}</h1>
        <p style={{ fontSize: F.base, color: C.muted, margin: "0 0 22px", lineHeight: 1.65 }}>{t(slot.key + "Sub")}</p>

        {isBirthday && (
          <div style={{ marginBottom: 18, padding: "14px 18px", borderRadius: 16, background: `linear-gradient(135deg, ${C.saffronL}, ${C.gold})`, color: C.white, boxShadow: C.shadowMd }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: F.base }}>
              {uiLang === "en" ? `🎂 Happy Birthday, ${firstName}!` : `🎂 जन्मदिन की हार्दिक शुभकामनाएं, ${firstName} जी!`}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: F.sm, opacity: 0.92 }}>
              {uiLang === "en" ? "May this year bring peace, wisdom, and light to your journey. 🙏" : "यह वर्ष आपके जीवन में शांति, ज्ञान और प्रकाश लेकर आए। 🙏"}
            </p>
          </div>
        )}

        {/* Daily Wisdom */}
        <div style={{ background: C.goldBg, borderRadius: 20, padding: "20px 22px", border: `1px solid ${C.goldBdr}50`, boxShadow: C.shadow, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -14, right: -8, fontSize: 72, opacity: 0.07, pointerEvents: "none" }}>{wisdom.icon}</div>
          <p style={{ fontSize: F.xs + 1, fontWeight: 700, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>{t('todaysWisdomLabel')}</p>
          {wisdom.full && <p style={{ ...serif, fontSize: F.lg, color: C.ink, lineHeight: 2, margin: "0 0 9px" }}>{wisdom.full}</p>}
          {wisdom.hi && <p style={{ ...serif, fontSize: F.md, color: C.body, lineHeight: 1.85, margin: "0 0 9px" }}>{wisdom.hi}</p>}
          <p style={{ ...serif, fontSize: F.sm, color: C.muted, fontStyle: "italic", lineHeight: 1.7, margin: "0 0 9px" }}>"{wisdom.text}"</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: F.sm, fontWeight: 600, color: C.gold, margin: 0 }}>— {wisdom.src}</p>
            <button onClick={listenWisdom}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 20, border: `1px solid ${wPlaying ? C.saffron : C.borderMd}`, background: wPlaying ? C.white : "transparent", color: wPlaying ? C.saffron : C.muted, cursor: "pointer", fontSize: F.sm, fontWeight: 600, transition: "all 0.2s" }}>
              {wPlaying ? t('stopBtn') : t('listenBtn')}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 18px 0" }}>

        {/* Continue conversation card — shows last user message from persisted chat */}
        {(() => {
          try {
            const hist     = JSON.parse(localStorage.getItem("saarthi_chat_history") || "[]");
            const lastUser = [...hist].reverse().find(m => m.role === "user");
            const snippet  = lastUser?.content?.trim().slice(0, 60);
            if (!snippet) return null;
            return (
              <button onClick={() => onNav("chat")}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 15px",
                         marginBottom:18, borderRadius:14, width:"100%", cursor:"pointer",
                         textAlign:"left", border:`1px solid rgba(200,85,26,0.22)`,
                         background:"rgba(200,85,26,0.04)", transition:"all 0.18s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="rgba(200,85,26,0.45)"}
                onMouseLeave={e => e.currentTarget.style.borderColor="rgba(200,85,26,0.22)"}>
                <div style={{ width:38, height:38, borderRadius:11, background:"rgba(200,85,26,0.1)",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:18, flexShrink:0 }}>💬</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:F.xs+1, color:C.saffron, fontWeight:700, margin:"0 0 2px" }}>
                    {t('continueConversation')}
                  </p>
                  <p style={{ fontSize:F.sm, color:C.body, margin:0, overflow:"hidden",
                              textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    "{snippet}{lastUser.content.length > 60 ? "…" : ""}"
                  </p>
                </div>
                <span style={{ color:C.faint, fontSize:18, flexShrink:0 }}>›</span>
              </button>
            );
          } catch { return null; }
        })()}

        {/* Quick actions */}
        <p style={{ fontSize: F.xs + 1, fontWeight: 700, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 11px" }}>{t('startHereLabel')}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
          {[
            { ic:"💬", t:t('qcAskTitle'),   d:t('qcAskDesc'),   pg:"chat",   ac:C.saffron, bg:"#FEF3EC" },
            { ic:"📚", t:t('qcBooksTitle'),    d:t('qcBooksDesc'),  pg:"books",  ac:"#2563EB", bg:"#EFF6FF" },
            { ic:"🎧", t:t('qcListenTitle'),        d:t('qcListenDesc'),     pg:"audio",  ac:"#15803D", bg:"#F0FDF4" },
            { ic:"📄", t:t('qcPdfTitle'),      d:t('qcPdfDesc'),     pg:"upload", ac:"#7C3AED", bg:"#F5F3FF" },
          ].map(a => <QuickCard key={a.t} {...a} onClick={() => onNav(a.pg)} />)}
        </div>

        {/* (Continue-reading grid removed — Books tab is the single home of all granths) */}


        {/* (Static "Sacred books" list removed — Read Books tab shows the real 13 granths) */}

        {/* Audio */}
        <p style={{ fontSize: F.xs + 1, fontWeight: 700, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 11px" }}>{t('amritSectionTitle')}</p>
        {/* BUG FIX: "listen" naam ka tab exist nahi karta — AmritView "audio"
            tab par hai. Galat naam se blank page khulta tha. */}
        <button onClick={() => onNav("audio")}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "15px 16px", borderRadius: 16, border: `1.5px solid ${C.goldBdr}`, background: C.goldBg, cursor: "pointer", textAlign: "left", boxShadow: C.shadow }}>
          <span style={{ fontSize: 26 }}>🪔</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: F.base, fontWeight: 700, color: C.ink }}>{t('amritCardTitle')}</p>
            <p style={{ margin: 0, fontSize: F.xs + 1, color: C.muted }}>{t('amritCardSub')}</p>
          </div>
        </button>

        {/* Vedic Time — item #14, Vikramaditya Vedic Clock */}
        <button onClick={() => onNav("vedic")}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "15px 16px", marginTop: 12, borderRadius: 16, border: `1.5px solid ${C.border}`, background: C.white, cursor: "pointer", textAlign: "left", boxShadow: C.shadow }}>
          <span style={{ fontSize: 26 }}>🕉️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: F.base, fontWeight: 700, color: C.ink }}>{t('vedicTimeCardTitle')}</p>
            <p style={{ margin: 0, fontSize: F.xs + 1, color: C.muted }}>{t('vedicTimeCardSub')}</p>
          </div>
        </button>

        {/* Reminders — item #15, asli push notification (din mein 2-3 baar) */}
        <ReminderToggle />

        {/* Disclaimer — IP-salah ke 7 sutron ka nichod (Educational/AI/No-advice/Copyright/Fees/Respect).
            Shows ONLY the language matching the global UI toggle (was previously both languages at once). */}
        <div style={{ margin: "26px 0 10px", padding: "14px 16px", borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: F.xs, color: C.faint, lineHeight: 1.7, margin: 0, textAlign: "center" }}>
            {t('disclaimerText')}
          </p>
          <p style={{ fontSize: F.xs, color: C.faint, margin: "8px 0 0", textAlign: "center" }}>
            © 2026 SAARTHI GYAAN
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickCard({ ic, t, d, ac, bg, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "16px 14px", borderRadius: 18, border: `1px solid ${hov ? ac+"40" : C.border}`, background: hov ? bg : C.white, cursor: "pointer", textAlign: "left", transition: "all 0.2s", transform: hov ? "translateY(-2px)" : "none", boxShadow: hov ? C.shadowMd : C.shadow }}>
      <span style={{ fontSize: 28, display: "block", marginBottom: 10 }}>{ic}</span>
      <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: "0 0 3px" }}>{t}</p>
      <p style={{ fontSize: F.xs + 1, color: C.muted, margin: 0, lineHeight: 1.45 }}>{d}</p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH — Beautiful onboarding
// ─────────────────────────────────────────────────────────────────────────────

function Splash({ onStart }) {
  const t = useT();
  const { uiLang } = useUiLang();
  const { isSignedIn } = useAuth();
  const en = uiLang === "en";
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(170deg, #FDFCF8 0%, #FDF5E4 55%, #FDFCF8 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center" }}>

      <div style={{ animation: "fadeUp 0.5s ease", width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ width: 88, height: 88, borderRadius: 28, background: `linear-gradient(140deg, ${C.saffronL}, ${C.gold})`, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, boxShadow: `0 8px 32px rgba(200,85,26,0.32), 0 2px 8px rgba(200,85,26,0.18)` }}>🕉️</div>

        <h1 style={{ fontSize: F.h1 + 6, fontWeight: 800, color: C.ink, margin: "0 0 6px", letterSpacing: -0.8, lineHeight: 1.05 }}>Saarthi</h1>
        <p style={{ ...serif, fontSize: F.lg, color: C.muted, margin: "0 0 10px", fontStyle: "italic" }}>सारथी</p>
        <p style={{ fontSize: F.base, color: C.body, margin: "0 auto 32px", lineHeight: 1.7, maxWidth: 300 }}>
          {t('splashTagline')}
        </p>

        {/* Feature tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28, animation: "fadeUp 0.5s ease 0.1s both" }}>
          {[
            ["💬", "Life Guidance",    "Talk through any challenge"],
            ["📚", "Sacred Books",     "Gita · Ramayana · Vedas"],
            ["🎧", "Audio Wisdom",     "Calm, natural narration"],
            ["📄", "PDF Chat",         "Chat with your documents"],
          ].map(([ic, t, d]) => (
            <div key={t} style={{ padding: "16px 14px", borderRadius: 18, background: C.white, border: `1px solid ${C.border}`, textAlign: "left", boxShadow: C.shadow }}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 9 }}>{ic}</span>
              <p style={{ fontSize: F.base, fontWeight: 700, color: C.ink, margin: "0 0 3px" }}>{t}</p>
              <p style={{ fontSize: F.xs + 1, color: C.muted, margin: 0, lineHeight: 1.5 }}>{d}</p>
            </div>
          ))}
        </div>

        {/* CTA — item #15: ab yahan pehle Google Sign-In hona ANIVARYA hai,
            uske baad hi "Begin Your Journey" wala kadam aata hai. Koi bhi
            granth/chat/search/PDF sign-in ke bina nahi khulta. */}
        <div style={{ animation: "fadeUp 0.5s ease 0.2s both" }}>
          {!isSignedIn ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
                <GoogleSignInButton />
              </div>
              <p style={{ fontSize: F.xs + 1, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
                {en ? "Please sign in with Google to continue — this keeps your progress and questions safe."
                    : "आगे बढ़ने के लिए कृपया Google से sign in करें — इससे आपकी प्रगति और सवाल सुरक्षित रहते हैं।"}
              </p>
            </>
          ) : (
            <>
              <button onClick={onStart}
                style={{ width: "100%", padding: "16px", borderRadius: 18, border: "none", cursor: "pointer", background: `linear-gradient(140deg, ${C.saffronL}, ${C.gold})`, color: C.white, fontSize: F.md + 1, fontWeight: 700, boxShadow: `0 6px 24px rgba(200,85,26,0.38)`, transition: "all 0.22s", letterSpacing: 0.1 }}
                onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = `0 10px 32px rgba(200,85,26,0.48)`; }}
                onMouseLeave={e => { e.target.style.transform = ""; e.target.style.boxShadow = `0 6px 24px rgba(200,85,26,0.38)`; }}>
                {t('splashCta')}
              </button>
              <p style={{ fontSize: F.xs + 1, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
                {t('splashHint')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────


const TABS = [
  { id:"home",   icon:"◯",  label:"Home",   sub:"होम"    },
  { id:"chat",   icon:"◌",  label:"Ask",    sub:"पूछें"  },
  { id:"books",  icon:"☰",  label:"Books",  sub:"ग्रंथ" },
  { id:"search", icon:"⊙",  label:"Search", sub:"खोज"   },
  { id:"audio",  icon:"◎",  label:"Listen", sub:"सुनें"  },
  { id:"upload", icon:"⊕",  label:"Upload", sub:"PDF"    },
];

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html { height: 100%; height: -webkit-fill-available; -webkit-text-size-adjust: 100%; }
  body { height: 100%; margin: 0; padding: 0; overflow-x: hidden; background: #FDFCF8; -webkit-font-smoothing: antialiased; }
  html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
  #root { height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
  input, textarea, select, button { font-family: inherit; }
  textarea { scrollbar-width: none; } textarea::-webkit-scrollbar { display: none; }
  ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: rgba(184,137,26,0.25); border-radius: 3px; }
  @keyframes fadeUp    { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
  @keyframes typingDot { 0%,80%,100% { transform:scale(0) } 40% { transform:scale(1) } }
  @keyframes wave      { 0%,100% { transform:scaleY(0.3) } 50% { transform:scaleY(1.8) } }
  @keyframes shimmer   { 0% { background-position:-200% center } 100% { background-position:200% center } }
  @keyframes spin      { to { transform: rotate(360deg) } }
`;

const NAV_LABEL_KEYS = {
  home: "navHome", chat: "navAsk", books: "navBooks",
  search: "navSearch", audio: "navListen", upload: "navUpload",
};

export default function App() {
  const t = useT();
  const { isSignedIn } = useAuth();
  // Feature: skip splash on return visits — first-time users always see it
  const [started, setStarted] = useState(() => {
    try { return localStorage.getItem("saarthi_booted") === "1"; } catch { return false; }
  });
  const [tab,     setTab]     = useState("home");

  // Stop all audio whenever the user navigates to a different tab
  const navigate = (newTab) => {
    if (newTab !== tab) AudioEngine.stop();
    setTab(newTab);
  };

  const boot = () => {
    // Unlock browser audio + preload voice list before anything plays
    try {
      // Silent utterance unlocks the audio context on iOS/Safari
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0.001;
      window.speechSynthesis.speak(u);
      // Trigger voice list load — Chrome loads lazily on first call
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) {
        // Wait for voices to load then discard — just warms the cache
        window.speechSynthesis.addEventListener("voiceschanged", () => {
          window.speechSynthesis.getVoices();
        }, { once: true });
      }
    } catch {}
    try { localStorage.setItem("saarthi_booted", "1"); } catch {}
    setStarted(true);
  };

  // item #15: sign-in ANIVARYA — jab tak Google Sign-In (+ DOB) poora nahi
  // hota, Splash hi dikhta rahega, chahe pehle "saarthi_booted" localStorage
  // mein set ho chuka ho (purane returning users bhi ab yahan rukenge).
  if (!started || !isSignedIn) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <DobCollectionModal />
      <Splash onStart={boot} />
    </>
  );

  // CRITICAL-1 FIX: Every view is always mounted. Tab switching only toggles
  // visibility + pointerEvents — never unmounts. Chat messages, PDF state, and
  // reading position survive navigation.
  const viewPane = (id) => ({
    position:      "absolute",
    inset:         0,
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
    visibility:    tab === id ? "visible" : "hidden",
    pointerEvents: tab === id ? "auto"    : "none",
  });

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <DobCollectionModal />
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column",
                    overflow: "hidden", maxWidth: 680, width: "100%", margin: "0 auto", background: C.cream }}>

        {/* Page content — position:relative is the stacking context for absolute children */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

          {/* Persistent Home button — visible on every non-home tab */}
          {tab !== "home" && (
            <button
              onClick={() => navigate("home")}
              aria-label="Go to Home"
              style={{
                position: "absolute", top: 12, right: 14, zIndex: 50,
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 20,
                background: C.white, border: `1px solid ${C.border}`,
                color: C.muted, fontSize: F.xs + 1, fontWeight: 600,
                cursor: "pointer", boxShadow: C.shadow,
                transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.goldBg; e.currentTarget.style.color = C.saffron; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.muted; }}>
              ◯ {t('backToHome')}
            </button>
          )}

          <div style={viewPane("home")}>
            <ErrorBoundary name="Home">
              <HomeView onNav={navigate} />
            </ErrorBoundary>
          </div>

          <div style={viewPane("chat")}>
            <ErrorBoundary name="Chat">
              <ChatView />
            </ErrorBoundary>
          </div>

          <div style={viewPane("books")}>
            <ErrorBoundary name="Books">
              <BooksView />
            </ErrorBoundary>
          </div>

          <div style={viewPane("search")}>
            <ErrorBoundary name="Search">
              <GlobalSearchView onNav={navigate} />
            </ErrorBoundary>
          </div>

          <div style={viewPane("audio")}>
            <ErrorBoundary name="Audio">
              <AmritView />
            </ErrorBoundary>
          </div>

          <div style={viewPane("upload")}>
            <ErrorBoundary name="PDF Chat">
              <UploadView />
            </ErrorBoundary>
          </div>

          <div style={viewPane("vedic")}>
            <ErrorBoundary name="Vedic Time">
              <VedicTimeView />
            </ErrorBoundary>
          </div>

        </div>

        {/* Bottom navigation */}
        <nav style={{ display: "flex", borderTop: `1px solid ${C.border}`,
                      background: C.white, flexShrink: 0,
                      paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}>
          {TABS.map(tabItem => {
            const on = tab === tabItem.id;
            return (
              <button key={tabItem.id} onClick={() => navigate(tabItem.id)} aria-current={on ? "page" : undefined}
                style={{ flex: 1, display: "flex", flexDirection: "column",
                         alignItems: "center", gap: 3, padding: "10px 4px 9px",
                         border: "none", background: "none", cursor: "pointer",
                         position: "relative", transition: "all 0.18s" }}>
                {on && <div style={{ position: "absolute", top: 0, left: "50%",
                                     transform: "translateX(-50%)", width: 24,
                                     height: 2.5, borderRadius: 2, background: C.saffron }} />}
                <span style={{ fontSize: 17, color: on ? C.saffron : C.faint,
                               transition: "all 0.18s",
                               transform: on ? "scale(1.1)" : "scale(1)" }}>{tabItem.icon}</span>
                <span style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
                  <span style={{ fontSize: F.xs, fontWeight: on ? 700 : 400,
                                 color: on ? C.saffron : C.muted,
                                 lineHeight: 1.2, transition: "color 0.18s" }}>{t(NAV_LABEL_KEYS[tabItem.id]) || tabItem.label}</span>
                  <span style={{ fontSize: 8, color: on ? C.saffron : C.faint,
                                 lineHeight: 1.1, letterSpacing: "0.01em" }}>{tabItem.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
