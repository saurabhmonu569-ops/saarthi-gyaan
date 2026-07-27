/**
 * SAARTHI — Shared design tokens.
 * Extracted from App.jsx (item #4 refactor, 2026-07-27) so every split-out
 * view file can import the same colors/type-scale without re-declaring them.
 * Pure data — no behavior change from the original inline definitions.
 */

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

// Kin books ki ASLI PDF public/books/ mein maujood hai (in 13 ke alawa nayi
// books sirf text-reader se khulti hain — unki PDFs host par nahi/nahi ho saktin)
export const HAS_PDF = new Set([
  "agni_purana", "atharvaveda_1", "bhagavad_gita_shankar", "bhavishya_purana",
  "garuda_purana_1", "narasimha_purana", "rigveda_1", "samaveda",
  "shiva_purana_1", "shiva_purana_2", "valmiki_ramayana", "vishnu_purana_1", "yajurveda",
  // Batch 2 — sabhi 11 (badi 3 ko 08_compress_pdf.py se chhota karke host kiya)
  "rashi_muhurt_vigyan", "chanakya_neeti", "ekadashi_mahatmya", "ishadi_upanishad",
  "guru_granth_sahib", "kathopanishad", "nitya_devta_archana", "lal_kitab",
  "mantra_maha_sagar", "mantra_shakti", "nitya_karm_pooja",
]);

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
