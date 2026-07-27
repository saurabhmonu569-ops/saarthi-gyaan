/**
 * SAARTHI — Auth/reminder/quota widgets (GlobalLangToggle, AuthBar, GoogleSignInButton, ReminderToggle, QuotaPill, DobCollectionModal)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useRef, useEffect } from "react";
import { useT, useUiLang } from "@/i18n";
import { useAuth, GOOGLE_CLIENT_ID, loadGoogleScript } from "@/context/AuthContext";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, isPushEnabledLocally } from "@/services/pushNotifications";
import { C, F } from "@/styles/theme";

export function GlobalLangToggle() {
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

export function GoogleSignInButton({ compact }) {
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
export function ReminderToggle() {
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
export function QuotaPill({ left, uiLang, labelHi, labelEn }) {
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

export function DobCollectionModal() {
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

