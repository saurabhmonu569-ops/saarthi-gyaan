import { describe, it, expect } from "vitest";
import { detectHintedBook, BOOK_HINTS } from "./bookHints.js";

describe("bookHints.js — Roman + Devanagari book detection", () => {
  it("detects Roman book names", () => {
    expect(detectHintedBook("Atharvaveda ka modern use kya hai?")).toBe("atharvaveda_1");
    expect(detectHintedBook("Yajurveda kya sikhata hai?")).toBe("yajurveda");
    expect(detectHintedBook("what does the gita say about karma")).toBe("bhagavad_gita_shankar");
  });

  it("detects Devanagari book names — the exact bug this fixed", () => {
    // Real regression case: this query used to return null (Roman-only hints
    // never match Devanagari substrings), silently disabling the guaranteed
    // book-grounding fix for every Hindi-typed question.
    expect(detectHintedBook("नित्य देवता अर्चना का उद्देश्य क्या है?")).toBe("nitya_devta_archana");
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

  it("mantra_shakti is matched before the generic mantra_maha_sagar hint", () => {
    // Regression: mantra_shakti previously had NO hint at all and would have
    // been swallowed by the generic "mantra" -> mantra_maha_sagar match.
    expect(detectHintedBook("mantra shakti ke baare mein bataiye")).toBe("mantra_shakti");
    expect(detectHintedBook("मंत्र शक्ति क्या है?")).toBe("mantra_shakti");
    // Generic "mantra" (no "shakti") still falls back to mantra_maha_sagar
    expect(detectHintedBook("mantra ke baare mein bataiye")).toBe("mantra_maha_sagar");
  });

  it("every book_id in the hint map is a plausible non-empty slug", () => {
    for (const bookId of Object.values(BOOK_HINTS)) {
      expect(typeof bookId).toBe("string");
      expect(bookId.length).toBeGreaterThan(0);
    }
  });
});
