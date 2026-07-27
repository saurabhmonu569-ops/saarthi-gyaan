/**
 * SAARTHI — per-feature daily quota (item #12)
 * ================================================================
 * Extracted out of App.jsx (audit 2026-07-25, QA/testability item) so this
 * pure logic can be unit-tested without importing the whole App component
 * tree. Behaviour UNCHANGED from before the extraction.
 *
 * Har feature ki apni alag daily-limit pool hai (Chat/PDF apna, Search-
 * Nishkarsh apna 5/din, Vedic-Ask apna 6/din) — pehle sab ek hi shared
 * "SAARTHI_AI_QUOTA" pool se kharch hote the, isliye Vedic-Ask "0 left"
 * dikhata tha jab woh quota Chat/PDF se pehle hi khatam ho chuka ho.
 * Owner (tier.js) aur apni-API-key waalon ke liye hamesha unlimited.
 *
 * UPDATE (2026-07-27, item #2 — SERVER-SIDE ENFORCEMENT): featureQuotaLeft/
 * featureQuotaUse (neeche, unchanged) ab sirf OPTIMISTIC UI display ke liye
 * hain (QuotaPill jaisa synchronous render turant kar sake) — asli GATE ab
 * serverQuotaConsume() hai, jo Worker ke naye /quota/consume endpoint ko
 * verified-session ke saath call karta hai (Worker localStorage par bharosa
 * nahi karta, apna KV-backed IST-daily counter rakhta hai — dekhein
 * deploy/cloudflare-worker.js). Local functions clear/incognito se bypass ho
 * sakti hain (jaisa pehle tha) — par ab woh sirf DISPLAY galat karega, asli
 * limit nahi todega, kyunki server hamesha apna counter check karta hai.
 */
import { isPaidUser } from "@/services/tier";

export const SEARCH_QUOTA_LIMIT = 5;
export const VEDIC_QUOTA_LIMIT  = 6;

export function featureQuotaLeft(feature, limit, profile) {
  try {
    if (localStorage.getItem("SAARTHI_RUNTIME_KEY")) return Infinity;
    if (isPaidUser(profile)) return Infinity;
    const key = `SAARTHI_QUOTA_${feature}`;
    const today = new Date().toISOString().slice(0, 10);
    const q = JSON.parse(localStorage.getItem(key) || "{}");
    if (q.date !== today) return limit;
    return Math.max(0, limit - (q.used || 0));
  } catch { return limit; }
}

export function featureQuotaUse(feature, limit, profile) {
  try {
    if (localStorage.getItem("SAARTHI_RUNTIME_KEY")) return Infinity;
    if (isPaidUser(profile)) return Infinity;
    const key = `SAARTHI_QUOTA_${feature}`;
    const today = new Date().toISOString().slice(0, 10);
    const q = JSON.parse(localStorage.getItem(key) || "{}");
    const used = (q.date === today ? (q.used || 0) : 0) + 1;
    localStorage.setItem(key, JSON.stringify({ date: today, used }));
    return Math.max(0, limit - used);
  } catch { return limit; }
}

// ── ITEM #2 — SERVER-VERIFIED QUOTA CONSUME ────────────────────────────────
// gemini.js jaisa hi sessionToken-read pattern (context ke bina, localStorage
// se seedha) — quota.js ek plain module hai, AuthContext ke bina bhi kaam
// karna chahiye.
const AI_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
function getSessionToken() {
  try {
    const raw = localStorage.getItem("SAARTHI_USER_PROFILE");
    if (!raw) return "";
    const p = JSON.parse(raw);
    return p?.sessionToken || "";
  } catch { return ""; }
}

/**
 * Worker ke /quota/consume ko call karta hai — feature ka ek "attempt" wahan
 * check-aur-consume hota hai, ATOMIC (1 round-trip, race-safe). Return:
 *   { allowed: boolean, remaining, limit }  — server se mila asli jawab
 *   null                                    — proxy configured nahi (local
 *                                              dev) ya network fail; caller
 *                                              apne local (localStorage)
 *                                              fallback check par gira de.
 * Owner/paid ke liye bhi yeh call hoti hai (halki, KV touch nahi karti — Worker
 * turant { allowed:true, remaining:"unlimited" } de deta hai).
 */
export async function serverQuotaConsume(feature) {
  if (!AI_PROXY_URL) return null; // local dev, koi proxy nahi — enforce nahi kar sakte
  try {
    const tok = getSessionToken();
    const res = await fetch(`${AI_PROXY_URL}/quota/consume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { "X-Saarthi-Session": tok } : {}),
      },
      body: JSON.stringify({ feature }),
    });
    const data = await res.json().catch(() => null);
    if (!data || typeof data.allowed !== "boolean") return null;
    return data;
  } catch {
    return null; // network fail — caller fail-open to local check (see above)
  }
}

/** Server se mila sach localStorage mirror mein likh deta hai, taaki
 * featureQuotaLeft() (synchronous UI display, jaise QuotaPill) turant sahi
 * dikhaye — bina server ko dobara poochhe. remaining="unlimited" ho toh
 * kuch nahi likhte (Infinity already localStorage ke bina hi handle hota hai). */
export function syncLocalQuotaFromServer(feature, limit, remaining) {
  try {
    if (typeof remaining !== "number" || typeof limit !== "number") return;
    const key = `SAARTHI_QUOTA_${feature}`;
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(key, JSON.stringify({ date: today, used: Math.max(0, limit - remaining) }));
  } catch {}
}
