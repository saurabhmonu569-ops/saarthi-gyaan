import { describe, it, expect } from "vitest";
import { escapeHtml, inlineMarkup } from "./markdown.js";

/**
 * ⚠️ YE SURAKSHA KA TEST HAI — ise halke me mat lena.
 *
 * `Prose` AI ka jawab `dangerouslySetInnerHTML` se dikhata hai. Agar
 * escaping toot jaye, to model ka (ya user ke sawaal se aaya hua, ya OCR
 * se nikla hua) `<script>` seedhe browser me chalega.
 *
 * 18 Agast 2026 ke audit me ye kram SAHI mila aur paanch hamle chala kar
 * jaancha gaya — par uska koi test nahi tha. Yaani suraksha ek refactor
 * door thi: koi `inlineMarkup` me ek line upar-neeche karta aur XSS
 * CHUP-CHAAP khul jaata. Pata tab chalta jab kisi ne fayda utha liya hota.
 *
 * Neeche wahi paanch hamle hain jo us din chalaye gaye the.
 */

const RANG = { ink: "#18120E", body: "#4A3F35", goldBg: "#FDF6E3", saffron: "#B8891A" };

/** Hamare apne <strong>/<em>/<code> ke alawa koi ASLI tag bacha? */
const asliTag = (html) =>
  (html.match(/<[a-z][a-z0-9]*/gi) || []).filter(t => !/^<(strong|em|code)$/i.test(t));

describe("escapeHtml", () => {
  it("paanchon khatarnak akshar badalta hai", () => {
    expect(escapeHtml('<>&"\'')).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  // ⚠️ `&` SABSE PEHLE hona chahiye. Baad me karne par hamara apna "&lt;"
  // dobara badal kar "&amp;lt;" ban jaata aur user ko "&lt;" dikhta.
  it("& sabse pehle badalta hai — dohra escape nahi hota", () => {
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");   // asli & tha, isliye ye sahi hai
  });

  it("null/undefined par nahi girta", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("inlineMarkup — XSS ke paanch hamle (18 Agast 2026 ki jaanch)", () => {
  it("<script> nahi chalta", () => {
    const out = inlineMarkup("<script>alert(1)</script>", RANG);
    expect(asliTag(out)).toEqual([]);
    expect(out).toContain("&lt;script&gt;");
  });

  it("<img onerror> nahi chalta", () => {
    const out = inlineMarkup("<img src=x onerror=alert(1)>", RANG);
    expect(asliTag(out)).toEqual([]);
  });

  it("javascript: wala link nahi chalta", () => {
    const out = inlineMarkup('<a href="javascript:alert(1)">x</a>', RANG);
    expect(asliTag(out)).toEqual([]);
  });

  it("quote todkar bahar nikalne ki koshish nahi chalti", () => {
    const out = inlineMarkup("''><svg onload=alert(1)>", RANG);
    expect(asliTag(out)).toEqual([]);
  });

  // ⚠️ YE SABSE ZAROORI JAANCH HAI — kram ki.
  // Markdown ke saath tag bhejne par: hamara <strong> banna chahiye, PAR
  // andar ka <b> escape hona chahiye. Agar kram ulta ho jaye to ye test
  // turant girega.
  it("markdown ke saath tag ho to markup bane aur tag escape ho", () => {
    const out = inlineMarkup("**<b>bold</b>**", RANG);
    expect(out).toMatch(/^<strong /);           // hamara markup bana
    expect(out).toContain("&lt;b&gt;");         // model ka tag mara
    expect(asliTag(out)).toEqual([]);           // koi bahari tag nahi
  });
});

describe("inlineMarkup — sahi kaam bhi karta hai", () => {
  it("bold, italic, code teenon", () => {
    expect(inlineMarkup("**a**", RANG)).toMatch(/<strong[^>]*>a<\/strong>/);
    expect(inlineMarkup("*a*", RANG)).toMatch(/<em[^>]*>a<\/em>/);
    expect(inlineMarkup("`a`", RANG)).toMatch(/<code[^>]*>a<\/code>/);
  });

  it("saaf Devanagari paath ko chhoota hi nahi", () => {
    const t = "एकादशी व्रत से पुण्य मिलता है।";
    expect(inlineMarkup(t, RANG)).toBe(t);
  });

  it("khaali par nahi girta", () => {
    expect(inlineMarkup("", RANG)).toBe("");
    expect(inlineMarkup(null, RANG)).toBe("");
  });
});
