/**
 * SAARTHI — translit.js ke tests (audit finding D5, 2026-08-03)
 * =====================================================================
 * KYUN: audit se pehle ~8,900 lines ke liye sirf 3 test files thi, aur
 * retrieval/grounding — yaani theek wahi subsystem jo mahino se chup-chaap
 * toota pada tha — uska ek bhi test nahi tha.
 *
 * Yahan har test ek ASLI galti se juda hai jo naapi gayi thi, taaki koi
 * dobara wahi badlav karke wahi bug wapas na le aaye.
 */

import { describe, it, expect } from "vitest";
import { toDevanagari, detectQueryLanguage, devanagariRatio, stripCyrillic } from "./translit.js";

describe("toDevanagari — Hinglish se Devanagari", () => {
  it("pehle se Devanagari text ko chhoota nahi", () => {
    const s = "गुस्सा कैसे शांत करें";
    expect(toDevanagari(s)).toBe(s);
  });

  it("pura Hindi-in-Roman sahi badalta hai", () => {
    // Naapa gaya: raw 0.5038 → translit 0.7479 (gold ke barabar)
    expect(toDevanagari("mrityu ke baad aatma ka kya hota hai"))
      .toBe("मृत्यु के बाद आत्मा का क्या होता है");
  });

  it("corpus-lexicon ke shabd pakadta hai (lal → लाल, kitab → किताब)", () => {
    const out = toDevanagari("lal kitab mein shani ka upay kya hai");
    expect(out).toContain("लाल");
    expect(out).toContain("किताब");
    expect(out).toContain("शनि");
  });

  it("ANJAAN/ANGREZI shabd Latin mein hi chhodta hai", () => {
    // YEH SABSE ZAROORI TEST HAI.
    // Pehla version har anjaan shabd ko akshar-dar-akshar badal deta tha:
    //     "error" → "एर्रोर",  "React" → "रेअच्त"
    // Corpus OCR-scanned hai (usme waisa hi garbled Devanagari bhara hai),
    // isliye woh bakwas kachre se match kar jaati thi aur kachre sawaalon
    // ka score +0.13 tak CHADH gaya — separation ulta kharab ho gaya.
    // Ab anjaan shabd Latin mein rehte hain.
    const out = toDevanagari("OCR me error ho to AI kya kare");
    expect(out).toContain("OCR");
    expect(out).toContain("error");
    expect(out).toContain("में");     // Hindi hissa phir bhi badla
  });

  it("hyphen par todta hai (baar-baar)", () => {
    expect(toDevanagari("baar-baar")).toBe("बार-बार");
  });
});

describe("detectQueryLanguage — jawab kis bhasha mein de", () => {
  it("Devanagari sawaal → hi (toggle chahe kuch bhi ho)", () => {
    // ASLI BUG: user ne "मृत्यु के बाद आत्मा का क्या होता है?" poocha,
    // toggle English par tha, aur poora jawab English mein aa gaya.
    expect(detectQueryLanguage("मृत्यु के बाद आत्मा का क्या होता है?")).toBe("hi");
  });

  it("saaf English sawaal → en", () => {
    expect(detectQueryLanguage("What happens to the soul after death?")).toBe("en");
    expect(detectQueryLanguage("Who wrote the Ramayana and when?")).toBe("en");
  });

  it("angrezi vaakya jisme sanskrit shabd hon → phir bhi en", () => {
    // Pehla tarika "kitne shabd Hindi lexicon mein hain" ginta tha, isliye
    // yeh Hinglish gina jaata tha — karma aur yoga Hindi shabd hain hi.
    // Ab vyakaran dekhte hain, vishay ke shabd nahi.
    expect(detectQueryLanguage("Explain karma yoga to me")).toBe("en");
    expect(detectQueryLanguage("Tell me about the Bhagavad Gita")).toBe("en");
  });

  it("Hinglish → mixed (yahan toggle faisla kare)", () => {
    expect(detectQueryLanguage("mrityu ke baad aatma ka kya hota hai")).toBe("mixed");
    expect(detectQueryLanguage("mera job chhut gaya hai bahut tension hai")).toBe("mixed");
    expect(detectQueryLanguage("React useState hook kaise use karte hain")).toBe("mixed");
  });

  it('"the" ko Hindi ka saboot nahi maanta', () => {
    // थे ka Roman "the" hai, par woh angrezi ka sabse aam shabd bhi hai.
    // Use grammar-list mein rakhne se har angrezi vaakya Hinglish ban
    // jaata tha.
    expect(detectQueryLanguage("I feel angry all the time, what should I do?")).toBe("en");
  });
});

describe("stripCyrillic — model ke degraded output ki safai", () => {
  it("Devanagari ke beech Cyrillic ko Devanagari mein badalta hai", () => {
    // Asli output jo dikha tha: "एक नарам सावाल" — नरम hona chahiye tha
    const r = stripCyrillic("मैं आपको एक नарам सावाल पूछना चाहता हूं");
    expect(r.text).toContain("नरम");
    expect(r.fixed).toBeGreaterThan(0);
  });

  it("saaf text ko bilkul nahi chhoota", () => {
    const s = "बिलकुल साफ हिंदी, कोई गड़बड़ नहीं";
    const r = stripCyrillic(s);
    expect(r.text).toBe(s);
    expect(r.fixed).toBe(0);
  });

  it("saaf English ko nahi chhoota", () => {
    const s = "Plain English sentence";
    expect(stripCyrillic(s).text).toBe(s);
  });
});

describe("devanagariRatio", () => {
  it("poora Devanagari → 1", () => {
    expect(devanagariRatio("नमस्ते")).toBe(1);
  });
  it("poora Latin → 0", () => {
    expect(devanagariRatio("namaste")).toBe(0);
  });
  it("bina akshar ke text par crash nahi karta", () => {
    expect(devanagariRatio("123 !!!")).toBe(0);
  });
});
