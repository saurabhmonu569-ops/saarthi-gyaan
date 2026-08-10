import { describe, it, expect } from "vitest";
import { detectHintedBook, BOOK_HINTS } from "./bookHints.js";

describe("bookHints.js — Roman + Devanagari book detection", () => {
  it("detects Roman book names", () => {
    expect(detectHintedBook("Atharvaveda ka modern use kya hai?")).toBe("atharvaveda_1");
    expect(detectHintedBook("Yajurveda kya sikhata hai?")).toBe("yajurveda");
    expect(detectHintedBook("what does the gita say about karma")).toBe("bhagavad_gita_shankar");
  });

  it("Ramayan ke hint ab Ramcharitmanas par jaate hain", () => {
    // 2026-08-07: valmiki_ramayana hatai gayi (OCR kachra — 381 akshar/page,
    // ek bhi kand ka naam nahi). Ramayan ka vishay ab Ramcharitmanas mein.
    expect(detectHintedBook("ramayan me kya likha hai")).toBe("ramcharitmanas");
    expect(detectHintedBook("रामायण की कथा बताइए")).toBe("ramcharitmanas");
    expect(detectHintedBook("वाल्मीकि ने क्या कहा")).toBe("ramcharitmanas");
  });

  it("Mahabharat aur uske paatra pehchane jaate hain", () => {
    expect(detectHintedBook("महाभारत में धर्म क्या है")).toBe("mahabharata");
    expect(detectHintedBook("vidur neeti kya kehti hai")).toBe("mahabharata");
    expect(detectHintedBook("भीष्म ने क्या उपदेश दिया")).toBe("mahabharata");
    expect(detectHintedBook("द्रौपदी के बारे में बताइए")).toBe("mahabharata");
    expect(detectHintedBook("शान्तिपर्व में क्या है")).toBe("mahabharata");
    // "गीता" apna samarpit granth rakhti hai — Mahabharat par nahi jaati
    expect(detectHintedBook("गीता में कर्म योग")).toBe("bhagavad_gita_shankar");
  });

  it("detects Devanagari book names — the exact bug this fixed", () => {
    // Real regression case: this query used to return null (Roman-only hints
    // never match Devanagari substrings), silently disabling the guaranteed
    // book-grounding fix for every Hindi-typed question.
    expect(detectHintedBook("रामचरितमानस में भक्ति के बारे में क्या कहा है?")).toBe("ramcharitmanas");
    expect(detectHintedBook("अथर्ववेद का आधुनिक उपयोग क्या है?")).toBe("atharvaveda_1");
    expect(detectHintedBook("यजुर्वेद क्या सिखाता है?")).toBe("yajurveda");
    expect(detectHintedBook("गीता में कर्म योग क्या है?")).toBe("bhagavad_gita_shankar");
  });

  it("returns null when no book is named", () => {
    expect(detectHintedBook("I feel anxious about the future")).toBeNull();
    expect(detectHintedBook("मुझे डर लगता है")).toBeNull();
  });

  it("does not crash on empty/undefined input", () => {
    expect(detectHintedBook("")).toBeNull();
    expect(detectHintedBook(undefined)).toBeNull();
  });

  it("naye granth apne naam se pehchane jaate hain", () => {
    // 2026-08-04: mantra_shakti aur nitya_devta_archana hataye gaye
    // (duplicate + kharab OCR), unki jagah ye do aaye.
    expect(detectHintedBook("योगवासिष्ठ में वैराग्य क्या है?")).toBe("yoga_vasishtha");
    expect(detectHintedBook("yoga vasishtha ke baare mein bataiye")).toBe("yoga_vasishtha");
    expect(detectHintedBook("रामचरितमानस की चौपाई बताइए")).toBe("ramcharitmanas");
    // Generic "mantra" ab bhi mantra_maha_sagar par jaata hai
    expect(detectHintedBook("mantra ke baare mein bataiye")).toBe("mantra_maha_sagar");
  });

  it("every book_id in the hint map is a plausible non-empty slug", () => {
    for (const bookId of Object.values(BOOK_HINTS)) {
      expect(typeof bookId).toBe("string");
      expect(bookId.length).toBeGreaterThan(0);
    }
  });
});

describe("Ramayan ke paatr → Ramcharitmanas (2026-08-10)", () => {
  // KYUN: is list mein Mahabharat ke paatr (युधिष्ठिर, भीष्म, द्रौपदी)
  // pehle se the, par Ramayan ka EK BHI paatr nahi tha — sirf granth ke
  // naam. Isliye "Hanuman ji ko Jambavan ne kya yaad dilaya?" par koi
  // granth hinted hi nahi hota tha, aur jawab Mahabharat ke Ramopakhyana
  // se judta tha. Din bhar mein teen sawaal isi wajah se galat aaye.

  it("paatr ka naam lene par Ramcharitmanas hinted hota hai", () => {
    for (const q of [
      "Bharat ji jab Ram ko wapas lane van gaye to unki Ram se kya baat hui?",
      "Hanuman ji ko samudra paar karne se pehle Jambavan ne kya yaad dilaya?",
      "anuman ji ne Lanka me Ashok Vatika ko destroy karne ka decision kyu liya?",
      "Panchavati me Ram, Sita aur Lakshman ka jeevan kaisa tha?",
      "कैकेयी ने दशरथ से क्या वरदान माँगा",
      "सुग्रीव और अंगद का क्या सम्बन्ध था",
    ]) {
      expect(detectHintedBook(q), q).toBe("ramcharitmanas");
    }
  });

  it('"bharat" Mahabharat ko nahi chhinta — KRAM ka imtihaan', () => {
    // Roman "bharat" poori tarah "mahabharat" ke andar hai. detectHintedBook
    // pehla match jeetne deta hai, aur BOOK_HINTS mein mahabharat ki entry
    // UPAR hai. Agar koi Ramayan wala block upar khiska de, ye test turant
    // fail hoga — aur "Mahabharat me kya hai" Ramcharitmanas par chala
    // jaayega.
    expect(detectHintedBook("Mahabharat me Bhishma ne kya kaha")).toBe("mahabharata");
    expect(detectHintedBook("Mahabharat ka saar kya hai")).toBe("mahabharata");
    expect(detectHintedBook("महाभारत में भरत वंश की कथा")).toBe("mahabharata");
    expect(detectHintedBook("Draupadi ka cheer haran")).toBe("mahabharata");
  });

  it("aam jeevan ke sawaal par koi granth hinted nahi hota", () => {
    // Warna har sawaal par hinted-floor (0.18) lag jaata aur wahi jhoothi
    // citation wapas le aata jo 32 control sawaalon par 0 hai.
    for (const q of [
      "mera business me nuksan ho raha hai",
      "gussa kaise shant karein",
      "kal ka mausam kaisa rahega",
    ]) {
      expect(detectHintedBook(q), q).toBeNull();
    }
  });
});
