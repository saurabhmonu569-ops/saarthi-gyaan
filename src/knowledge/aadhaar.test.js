import { describe, it, expect } from "vitest";
import { vishishtShabd } from "./aadhaar.js";

// ⚠️ `chuneGayeGranth` ke 7 test yahan se hataye gaye (19 Agast 2026) —
// wo module hi hata diya gaya. Wajah aadhaar.js me likhi hai. Asli tark
// ke test ab src/shared/aadhaar.test.js me hain.

/** chhota sahayak — asli dhaancha jaisa chunk banata hai */
const ansh = (book, text, rerank) => ({ chunk: { book, book_title: book, text }, rerank });

describe("vishishtShabd — Devanagari me shabd todna", () => {
  // ⚠️ YE SABSE ZAROORI TEST HAI.
  // Devanagari me matra (ृ, ्, ा) Unicode me "mark" hoti hai, "letter"
  // nahi. Regex me \p{M} chhoot jaye to "कृष्ण" → क, ष, ण ban jaata hai.
  // Ye galti is project me DO BAAR ho chuki hai (\b ke saath bhi), aur
  // dono baar chup-chaap — kahin koi error nahi aaya.
  it("matra ke kaaran shabd todta NAHI hai", () => {
    const s = vishishtShabd("कृष्ण ने अर्जुन को समझाया");
    expect(s.has("कृष्ण")).toBe(true);
    expect(s.has("अर्जुन")).toBe(true);
    expect(s.has("क")).toBe(false);      // toota hua tukda nahi hona chahiye
  });

  it("aam shabd nahi ginta", () => {
    const s = vishishtShabd("यह इस प्रकार किया गया है और उनके अनुसार");
    expect(s.size).toBe(0);
  });

  it("angrezi shabd nahi ginta", () => {
    const s = vishishtShabd("spiritual meaning of life and purpose");
    expect([...s]).toEqual([]);
  });

  // ⚠️ LAMBAI KA JAAL — JS ki `length` AKSHAR nahi, code-unit ginti hai.
  // "राम" ki lambai 3 hai (2 akshar), "कर्म" ki 4 (3 akshar — matra alag
  // code-unit leti hai). Pehle maine seema 4 rakhi thi, "chaar akshar"
  // sochkar — us seema ne "राम" ko hata diya hota, jo Ramcharitmanas ka
  // sabse pehchana shabd hai.
  it("chhote par vishisht shabd rakhta hai (राम, शिव)", () => {
    const s = vishishtShabd("राम और शिव की कथा");
    expect(s.has("राम")).toBe(true);
    expect(s.has("शिव")).toBe(true);
  });

  it("bahut chhote shabd chhod deta hai (मन, तप — lambai 2)", () => {
    const s = vishishtShabd("मन तप जल");
    expect([...s]).toEqual([]);
  });
});
