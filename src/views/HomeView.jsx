/**
 * SAARTHI — Home view (HomeView, QuickCard)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState } from "react";
import { useBookProgress } from "@/context/AppContext";
import { BOOKS, DAILY_WISDOMS } from "@/data";
import { useT, useUiLang } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { C, F, serif } from "@/styles/theme";
import { AudioEngine } from "@/services/audioEngine";
import { GlobalLangToggle, ReminderToggle } from "@/views/AuthWidgets";

export function HomeView({ onNav }) {
  const t = useT();
  const { uiLang } = useUiLang();
  const hour    = new Date().getHours();
  const wisdom   = DAILY_WISDOMS[new Date().getDate() % DAILY_WISDOMS.length];
  // HATAYA (P2, 2026-08-10): yahan `const { ready: kReady, getBooks:
  // getEngineBooks } = useKnowledge();` tha — "Continue Reading section ko
  // enrich karne ke liye". Woh enrichment kabhi likhi hi nahi gayi: poori
  // file mein kReady aur getEngineBooks ek baar bhi istemal nahi hote the.
  //
  // Par ye MARI HUI line nahi thi. HomeView app ka LANDING page hai, aur
  // useKnowledge() mount hote hi poora corpus utaarna shuru kar deta tha —
  // books 165 MB + keyword index 93 MB. Yaani HAR pehla visitor 258 MB
  // utaarta tha ek aisi cheez ke liye jo screen par thi hi nahi.
  //
  // Ab Read aur Search tab khud maangte hain jab user wahan jaata hai
  // (useKnowledge ka ensureFullKnowledge), aur Ask ko kuch nahi chahiye —
  // uski retrieval Worker par hai.
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

