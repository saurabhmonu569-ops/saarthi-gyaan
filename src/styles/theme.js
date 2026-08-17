/**
 * SAARTHI — Shared design tokens.
 * Extracted from App.jsx (item #4 refactor, 2026-07-27) so every split-out
 * view file can import the same colors/type-scale without re-declaring them.
 * Pure data — no behavior change from the original inline definitions.
 */

import { PDF_PAROSO } from "@/featureFlags";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
export const C = {
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

// Kin granthon ki ASLI PDF web par parosi jaati hai.
//
// ⚠️ 17 Aug 2026 se ye Set KHAALI hai. PDF `data/books-pdf/` me chali gayi
// hain — repo me hain, mit-i nahi, par build me nahi jaati. Wajah kanooni
// hai aur poori tarah `src/featureFlags.js` ke PDF_PAROSO par likhi hai.
//
// Neeche ki soochi jaan-boojhkar rakhi hai (hataayi nahi): ye batati hai
// ki kis granth ki PDF hamare paas HAI. Anumati milne par PDF_PAROSO ko
// `true` karna kaafi hai — soochi dobara banane ki zaroorat nahi.
//
// BooksView aur GlobalSearchView dono is Set se poochhte hain, isliye
// khaali hote hi wo apne aap "sirf paath" wale raaste par chale jaate
// hain — wahi raasta jo Mahabharat aur Yogasutra par pehle se chal raha
// tha (unki PDF kabhi thi hi nahi).
const PDF_HAMARE_PAAS = [
  "agni_purana", "atharvaveda_1", "bhagavad_gita_shankar", "bhavishya_purana",
  "garuda_purana_1", "narasimha_purana", "rigveda_1", "samaveda",
  "shiva_purana_1", "shiva_purana_2", "vishnu_purana_1", "yajurveda",
  // Batch 2 — sabhi 11 (badi 3 ko 08_compress_pdf.py se chhota karke host kiya)
  "rashi_muhurt_vigyan", "chanakya_neeti", "ekadashi_mahatmya", "ishadi_upanishad",
  "guru_granth_sahib", "kathopanishad", "ramcharitmanas", "lal_kitab",
  "mantra_maha_sagar", "yoga_vasishtha", "nitya_karm_pooja",
];

export const HAS_PDF = new Set(PDF_PAROSO ? PDF_HAMARE_PAAS : []);

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
// Tiro Devanagari Hindi: granth-jaisa serif jo DEVANAGARI + Latin dono mein
// sundar hai. (Georgia mein Devanagari tha hi nahi — Hindi system font mein
// gir jaati thi, wahi "developer UI" feel ki asli jadh thi.)
export const serif = { fontFamily: "'Tiro Devanagari Hindi', 'Georgia', 'Palatino Linotype', serif" };
export const F = {
  xs:   11, sm: 12.5, base: 14.5, md: 15.5, lg: 17, xl: 20, xxl: 26, h1: 30,
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
export const ts = () => new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
