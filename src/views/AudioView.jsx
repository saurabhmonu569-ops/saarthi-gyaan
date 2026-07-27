/**
 * SAARTHI — Amrit lessons + Audio lessons (AmritCard, AmritView, AudioView, AudioLessonCard). NOTE: AudioView/AudioLessonCard are currently not rendered anywhere in the app (confirmed via usage search during this refactor) — kept as-is, not deleted, since deletion wasn't requested.
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useEffect } from "react";
import { AUDIO_LESSONS } from "@/data";
import { useT } from "@/i18n";
import { C, F, serif } from "@/styles/theme";
import { Btn, Prose } from "@/components/ui/Primitives";
import { AudioEngine, HAS_EL } from "@/services/audioEngine";
import { BOOK_META } from "@/data/bookMeta";

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

export function AmritView() {
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
