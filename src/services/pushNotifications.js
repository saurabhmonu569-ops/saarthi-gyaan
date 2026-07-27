/**
 * SAARTHI — Push Notifications client (item #15: asli daily reminder)
 * ======================================================================
 * Service worker (public/sw.js) register karta hai, user se permission
 * maangta hai, Browser Push Manager se subscribe karta hai, aur subscription
 * ko Cloudflare Worker (jo AI-proxy bhi hai) ko bhejta hai save karne ke
 * liye. Bhejna (actual notification) Worker ke `scheduled()` cron se hota
 * hai, din mein 2-3 baar — is file ka kaam sirf "subscribe" karna hai.
 */
const AI_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();

// Baaki app jaisa hi pattern (gemini.js/useChat.js) — chhota local helper,
// koi React import nahi (yeh module Context ke bahar bhi bulaya ja sakta hai).
function getUiLang() {
  try {
    const v = localStorage.getItem("SAARTHI_UI_LANG");
    return v === "en" ? "en" : "hi";
  } catch { return "hi"; }
}

export function isPushSupported() {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function registerSw() {
  return navigator.serviceWorker.register("/sw.js");
}

/**
 * subscribeToPush(profile) — permission maangta hai, subscribe karta hai,
 * Worker ko bhejta hai. `profile` = { email, name } (Google Sign-In se) —
 * taaki reminders उसी user ke naam se personalize ho sakein.
 * Returns { ok: boolean, reason?: string }
 */
export async function subscribeToPush(profile) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "not_configured" };
  if (!AI_PROXY_URL) return { ok: false, reason: "not_configured" };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const reg = await registerSw();
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const res = await fetch(`${AI_PROXY_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        email: profile?.email || "",
        name:  profile?.name  || "",
        lang:  getUiLang(),
      }),
    });
    if (!res.ok) return { ok: false, reason: "server_error" };
    try { localStorage.setItem("SAARTHI_PUSH_ENABLED", "1"); } catch {}
    return { ok: true };
  } catch (e) {
    console.warn("[Saarthi Push] subscribe failed:", e);
    return { ok: false, reason: "exception" };
  }
}

export async function unsubscribeFromPush() {
  try {
    if (!isPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      if (AI_PROXY_URL) {
        fetch(`${AI_PROXY_URL}/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
    }
    try { localStorage.removeItem("SAARTHI_PUSH_ENABLED"); } catch {}
  } catch (e) {
    console.warn("[Saarthi Push] unsubscribe failed:", e);
  }
}

export function isPushEnabledLocally() {
  try { return localStorage.getItem("SAARTHI_PUSH_ENABLED") === "1"; } catch { return false; }
}
