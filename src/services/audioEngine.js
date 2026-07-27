/**
 * SAARTHI — Shared audio engine (TTS singleton) + tiny localStorage helper.
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Used across
 * ChatView, AmritView, AudioView, VedicTimeView etc. for text-to-speech
 * playback — this is a module-level singleton (not a React hook) so it
 * MUST live in one shared file, not be duplicated per view. Pure move —
 * no behavior change from the original inline code.
 */

// localStorage helpers for reading progress & bookmarks
export const LS = {
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
// HAS_EL is also read by App.jsx views (ChatView/AmritView) to show an
// "ElevenLabs active" badge — must be exported, not just used internally.
export const HAS_EL = Boolean(EL_KEY && EL_KEY !== "your_elevenlabs_key_here");

export const AudioEngine = {
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
