import { describe, it, expect } from "vitest";
import { chuneGayeGranth, vishishtShabd } from "./aadhaar.js";

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

describe("chuneGayeGranth — Aadhaar me kaun jaaye", () => {
  it("jis granth ke shabd jawab me hain, wo rehta hai", () => {
    const jawab = "श्रीकृष्ण ने अर्जुन को निष्काम कर्मयोग समझाया। मोहग्रस्त मन ही दुःख का कारण है।";
    const { granth, hataye } = chuneGayeGranth(jawab, [
      ansh("Gita", "श्रीकृष्ण अर्जुन से कहते हैं कि निष्काम कर्मयोग ही श्रेष्ठ है", 0.9),
      ansh("Mahabharata", "अर्जुन मोहग्रस्त होकर रथ पर बैठ गया", 0.7),
    ]);
    expect(granth).toContain("Gita");
    expect(granth).toContain("Mahabharata");
    expect(hataye).toEqual([]);
  });

  // YEHI IS POORE BADLAV KA MAQSAD HAI
  it("jis granth ka jawab se koi mel nahi, use HATA deta hai", () => {
    const jawab = "श्रीकृष्ण ने अर्जुन को निष्काम कर्मयोग समझाया।";
    const { granth, hataye } = chuneGayeGranth(jawab, [
      ansh("Gita", "श्रीकृष्ण अर्जुन से निष्काम कर्मयोग कहते हैं", 0.9),
      ansh("Lal Kitab", "शनि ग्रह के उपाय हेतु सरसों तेल दान करें", 0.4),
    ]);
    expect(granth).toEqual(["Gita"]);
    expect(hataye).toEqual(["Lal Kitab"]);
  });

  // ⚠️ ULTA KHATRA — ise todna sabse mehnga hoga
  it("sabse achha granth HAMESHA rehta hai, chahe ek bhi shabd na mile", () => {
    // model ne poori tarah apne shabdon me likha — granth ki bhasha purani
    const jawab = "Anger is best cooled by patience and self-restraint.";
    const { granth } = chuneGayeGranth(jawab, [
      ansh("Gita", "क्रोधाद्भवति सम्मोहः सम्मोहात्स्मृतिविभ्रमः", 0.9),
      ansh("Chanakya Neeti", "क्षमा ही श्रेष्ठ बल है", 0.5),
    ]);
    expect(granth).toEqual(["Gita"]);    // khaali NAHI hona chahiye
  });

  it("kram: sabse ooncha score pehle", () => {
    const jawab = "धर्म और मोक्ष दोनों पुरुषार्थ हैं। वैराग्य से मुक्ति मिलती है।";
    const { granth } = chuneGayeGranth(jawab, [
      ansh("Vishnu Purana", "धर्म तथा मोक्ष पुरुषार्थ माने गये", 0.6),
      ansh("Yoga Vasishtha", "वैराग्य से ही मुक्ति सम्भव है", 0.95),
    ]);
    expect(granth[0]).toBe("Yoga Vasishtha");
  });

  it("ek granth ke kai ansh — naam ek hi baar", () => {
    const jawab = "एकादशी व्रत से पुण्य मिलता है और उपवास श्रेष्ठ माना गया है।";
    const { granth } = chuneGayeGranth(jawab, [
      ansh("Ekadashi Mahatmya", "एकादशी व्रत से पुण्य प्राप्त होता है", 0.9),
      ansh("Ekadashi Mahatmya", "उपवास श्रेष्ठ माना गया है", 0.8),
    ]);
    expect(granth).toEqual(["Ekadashi Mahatmya"]);
  });

  it("koi ansh na ho to khaali lautata hai (footer lagega hi nahi)", () => {
    expect(chuneGayeGranth("kuch bhi", []).granth).toEqual([]);
    expect(chuneGayeGranth("kuch bhi", null).granth).toEqual([]);
  });

  it("adhikatam seema maanta hai", () => {
    const jawab = "धर्म अर्थ काम मोक्ष यज्ञ तपस्या ध्यान समाधि वैराग्य ज्ञान भक्ति";
    const list = ["A", "B", "C", "D", "E", "F", "G"].map((n, i) =>
      ansh(n, "धर्म अर्थ काम मोक्ष यज्ञ तपस्या ध्यान समाधि", 0.9 - i * 0.01));
    expect(chuneGayeGranth(jawab, list).granth.length).toBe(5);
  });
});
