/**
 * SAARTHI — AuthContext (item #15: Login system)
 * =================================================
 * User ka final decision: SMS/real-OTP NAHI — Google Sign-In (free, koi DLT/
 * SMS-provider registration nahi chahiye) + ek chhoti Name/DOB collection
 * form pehli baar sign-in ke baad.
 *
 * 100% client-side, backend nahi (baaki app jaisa hi pattern):
 *  - Google Identity Services (GSI) script CDN se load hota hai
 *  - Google jo ID-token (JWT) deta hai, usse client-side decode karke
 *    naam/email/photo nikal lete hain (UI ke liye turant, non-security-
 *    critical) — SAATH mein Worker ko asli signature-verification ke
 *    liye bhi bhejte hain (neeche verifySession dekhein).
 *  - Profile (naam, email, DOB, photo, sessionToken) localStorage mein save
 *    hota hai
 *
 * SECURITY FIX (2026-07-26, audit follow-up): pehle poora sign-in 100%
 * client-side tha — koi bhi DevTools se localStorage mein fake profile likh
 * kar khud ko kisi bhi email (jaise owner) jaisa dikha sakta tha. Ab
 * sign-in ke baad Worker ke /auth/verify ko raw Google ID-token bheja jaata
 * hai — Worker Google ke public keys se ASLI signature verify karta hai,
 * aur ek apna HMAC-signed "sessionToken" deta hai jise sirf Worker hi
 * (SESSION_SECRET jaante hue) verify kar sakta hai. Yeh token profile mein
 * save hota hai — future mein jab bhi koi identity-sensitive kaam Worker
 * se karna ho (jaise real payment), Worker isi token se ASLI email verify
 * kar sakta hai, sirf client ke daave par bharosa nahi karna padta.
 * FAIL-OPEN: agar verify na ho paye (Worker abhi deploy nahi, network down,
 * SESSION_SECRET set nahi) — sign-in bilkul pehle jaisa hi kaam karta hai,
 * bas sessionToken khaali reh jaata hai. Kuch bhi block nahi hota.
 *
 * Setup jo USER ko khud karna hoga (ek hi baar):
 *  1. https://console.cloud.google.com/apis/credentials par jaake
 *     "Create Credentials → OAuth Client ID → Web application" banayein
 *  2. "Authorized JavaScript origins" mein daalein: https://saarthi-gyaan.netlify.app
 *  3. Mila hua Client ID .env mein daalein: VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
 *  4. Worker mein bhi (Cloudflare dashboard, /auth/verify ke liye): same
 *     Client ID ko GOOGLE_CLIENT_ID (TEXT) aur ek random SESSION_SECRET
 *     (SECRET) add karein — worker file ke top comment mein poora likha hai.
 */
import { createContext, useContext, useState, useCallback, useEffect } from "react";

const PROFILE_KEY = "SAARTHI_USER_PROFILE";
const GSI_SCRIPT   = "https://accounts.google.com/gsi/client";
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const AI_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");

/**
 * Worker ko raw Google ID-token bhejta hai asli verification ke liye.
 * Kabhi throw nahi karta — network fail ya endpoint abhi deploy na hua ho
 * toh bhi chup-chaap { ok:false } lauta deta hai (fail-open).
 */
async function verifySession(idToken) {
  if (!AI_PROXY_URL || !idToken) return { ok: false };
  try {
    const res = await fetch(`${AI_PROXY_URL}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}
function clearProfile() {
  try { localStorage.removeItem(PROFILE_KEY); } catch {}
}

// JWT ka middle (payload) hissa base64url-decode karta hai — koi library
// nahi chahiye, sirf naam/email/photo padhne ke liye itna kaafi hai.
function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    return JSON.parse(json);
  } catch { return null; }
}

let _gsiLoadPromise = null;
export function loadGoogleScript() {
  if (_gsiLoadPromise) return _gsiLoadPromise;
  _gsiLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(); return; }
    const existing = document.querySelector(`script[src="${GSI_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google script load fail hui")));
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SCRIPT; s.async = true; s.defer = true;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error("Google script load fail hui — internet check karein."));
    document.head.appendChild(s);
  });
  return _gsiLoadPromise;
}

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(() => loadProfile());
  // pendingGoogleUser: Google se mila naam/email/photo, DOB abhi collect nahi hui
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  const handleCredential = useCallback((response) => {
    const payload = decodeJwtPayload(response.credential);
    if (!payload) return;
    const googleUser = {
      name:    payload.name || payload.given_name || "",
      email:   payload.email || "",
      picture: payload.picture || "",
      sub:     payload.sub || "",
    };
    const existing = loadProfile();
    if (existing && existing.sub === googleUser.sub && existing.dob) {
      // Pehle se poora profile hai — seedha sign-in
      setProfile(existing);
      setPendingGoogleUser(null);
    } else {
      // Naya user ya DOB missing — profile-completion form dikhao
      setPendingGoogleUser(googleUser);
    }

    // SECURITY FIX (2026-07-26): background mein Worker se asli verify
    // maangte hain — UI ko block nahi karte, sign-in turant chalta rehta
    // hai. Result aane par jo bhi profile is waqt "sub" match karta hai
    // (already-signed-in ya abhi-abhi complete hua) usme sessionToken
    // patch kar dete hain. Fail-open by design — verifySession() khud
    // kabhi throw nahi karta.
    verifySession(response.credential).then((result) => {
      if (!result?.ok || !result?.sessionToken) return;
      setProfile((prev) => {
        if (prev && prev.sub === googleUser.sub) {
          const patched = { ...prev, sessionToken: result.sessionToken };
          saveProfile(patched);
          return patched;
        }
        return prev;
      });
      setPendingGoogleUser((prev) => {
        if (prev && prev.sub === googleUser.sub) {
          return { ...prev, sessionToken: result.sessionToken };
        }
        return prev;
      });
    });
  }, []);

  const completeProfile = useCallback((dob) => {
    if (!pendingGoogleUser) return;
    const full = { ...pendingGoogleUser, dob, signedInAt: new Date().toISOString() };
    saveProfile(full);
    setProfile(full);
    setPendingGoogleUser(null);
  }, [pendingGoogleUser]);

  const dismissPending = useCallback(() => setPendingGoogleUser(null), []);

  const signOut = useCallback(() => {
    clearProfile();
    setProfile(null);
    setPendingGoogleUser(null);
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
  }, []);

  const value = {
    profile, isSignedIn: !!profile, pendingGoogleUser,
    handleCredential, completeProfile, dismissPending, signOut,
    firstName: profile?.name ? profile.name.trim().split(/\s+/)[0] : "",
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
