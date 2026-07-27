/**
 * SAARTHI — Tier / Owner helper
 * ================================================================
 * Abhi tak koi real payment gateway nahi hai (Razorpay/Stripe waghera
 * baad mein aayenge — SAARTHI-Pricing-Proposal.md dekhein). Isliye
 * "paid" tier abhi sirf app-owner (Saurabh) ke liye hai — Google
 * Sign-In se pata chale email match hote hi saari free-limits hat
 * jaati hain, taaki presentation/demo ke waqt "paid experience"
 * dikhaya ja sake. Baaki sab users free-tier par hi rehte hain jab
 * tak asli payment integrate na ho jaaye.
 *
 * Jab real payment ban jaaye, bas isPaidUser() ke andar backend/
 * localStorage se "paid: true" check jod dena — baaki sab code
 * (jo isPaidUser use karta hai) bina badlaav ke kaam karega.
 */

export const OWNER_EMAIL = "saurabhmonu569@gmail.com";

export function isOwnerEmail(email) {
  try { return (email || "").trim().toLowerCase() === OWNER_EMAIL; } catch { return false; }
}

// `profile` = AuthContext ka { email, name, dob } object (ya null/undefined
// agar signed-in nahi hai)
export function isPaidUser(profile) {
  return isOwnerEmail(profile?.email);
}
