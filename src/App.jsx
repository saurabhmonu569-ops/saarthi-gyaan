/**
 * SAARTHI v4.1 — Polished · Warm · Human · Spiritual
 *
 * App shell: boot/auth/nav orchestration only. All view components now live
 * in src/views/* (item #4 refactor, 2026-07-27) — this file wires them
 * together, owns the tab-routing state, and renders Splash + the bottom nav.
 */

import React, { useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useT, useUiLang } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { C, F, serif } from "@/styles/theme";
import { AudioEngine } from "@/services/audioEngine";

import { ChatView } from "@/views/ChatView";
import { BooksView } from "@/views/BooksView";
import { GlobalSearchView } from "@/views/GlobalSearchView";
import { AmritView } from "@/views/AudioView";
import { UploadView } from "@/views/UploadView";
import { VedicTimeView } from "@/views/VedicTimeView";
import { HomeView } from "@/views/HomeView";
import { GoogleSignInButton, DobCollectionModal } from "@/views/AuthWidgets";

export { cleanOcrText } from "@/components/ui/Primitives";

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

  // Kaun-kaun se tab user ab tak khol chuka hai. Read aur Search ka 258 MB
  // ka corpus isi se bandha hai — neeche <BooksView active=…> dekhein.
  const [visited, setVisited] = useState(() => new Set(["home"]));

  // Stop all audio whenever the user navigates to a different tab
  const navigate = (newTab) => {
    if (newTab !== tab) AudioEngine.stop();
    setTab(newTab);
    setVisited(prev => prev.has(newTab) ? prev : new Set(prev).add(newTab));
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

          {/* ⚠️ `visited` — 258 MB kab utre (P2 fix, 2026-08-10)
              SAARE views ek saath mount hote hain aur sirf CSS se chhupte
              hain (viewPane: visibility hidden). Iska matlab BooksView aur
              GlobalSearchView app khulte hi mount ho jaate the — aur unka
              useKnowledge({ load: true }) 258 MB khinchna shuru kar deta,
              chahe user kabhi Read/Search tab par jaaye hi na.

              Ye galti maine PEHLI baar mein kar di thi: maine samjha ki
              `load: true` sirf "jab user wahan jaaye" wala matlab rakhta
              hai. Live console ne pakda —
                  [KnowledgeEngine] Loaded 57339 chunks
              Ask ke sawaal ke saath hi chhap raha tha, jabki Ask ko us data
              ki ab zaroorat hi nahi.

              Ab load tabhi shuru hota hai jab user us tab par PEHLI BAAR
              jaata hai. `visited` — `tab === id` nahi — kyunki wapas aane
              par download dobara shuru nahi hona chahiye; ek baar utar gaya
              to utar gaya. */}
          <div style={viewPane("books")}>
            <ErrorBoundary name="Books">
              <BooksView active={visited.has("books")} />
            </ErrorBoundary>
          </div>

          <div style={viewPane("search")}>
            <ErrorBoundary name="Search">
              <GlobalSearchView onNav={navigate} active={visited.has("search")} />
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
