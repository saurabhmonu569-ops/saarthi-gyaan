import { describe, it, expect } from "vitest";
import { granthPanktiNikaalo, aadhaarBanao, bhejeGayeGranth } from "./aadhaar.js";

/**
 * ⚠️ YE TEST APP AUR NAAP DONO KE LIYE HAI.
 *
 * useChat.js (app) aur 24_aadhaar_check.mjs (naap) — dono ab isi module
 * ko bulate hain. Pehle dono ke paas apni-apni nakal thi, aur 18 Agast ko
 * naap "khatra 7" chhaap rahi thi jabki app bilkul theek chal rahi thi.
 * Nidaan asli tha, bimari nakli.
 */

const ansh = (...naam) => naam.map(n => ({ chunk: { book_title: n } }));

describe("granthPanktiNikaalo — [[GRANTH: …]] pakdo aur hatao", () => {
  it("pankti pakadta hai aur jawab se hata deta hai", () => {
    const { text, granthKahe } = granthPanktiNikaalo(
      "कर्म योग का अर्थ है फल की चिंता छोड़ना।\n\n[[GRANTH: श्रीमद्भगवद्गीता | महाभारत]]"
    );
    expect(granthKahe).toEqual(["श्रीमद्भगवद्गीता", "महाभारत"]);
    expect(text).toBe("कर्म योग का अर्थ है फल की चिंता छोड़ना।");
    expect(text).not.toMatch(/GRANTH/);
  });

  it("pankti na ho to jawab achhoota rehta hai", () => {
    const j = "यह एक साधारण जवाब है।";
    const { text, granthKahe } = granthPanktiNikaalo(j);
    expect(granthKahe).toBeNull();
    expect(text).toBe(j);
  });

  // ⚠️ Ye zaroori hai: bina-ansh wale jawab me bhi pankti hatni chahiye,
  // warna wo USER KO DIKH JAATI hai. `[REPLY LANGUAGE]` tag ke saath yahi
  // galti ho chuki hai — wo ek raaste par hat-ta tha, doosre par nahi.
  it("beech me ho ya bade-chhote akshar me — phir bhi hat-ti hai", () => {
    expect(granthPanktiNikaalo("aage\n[[granth: गीता]]\npeeche").text)
      .not.toMatch(/granth/i);
    expect(granthPanktiNikaalo("[[ GRANTH : गीता ]]x").granthKahe).toEqual(["गीता"]);
  });

  it("khaali/null par nahi girta", () => {
    expect(granthPanktiNikaalo("").granthKahe).toBeNull();
    expect(granthPanktiNikaalo(null).text).toBe("");
  });
});

describe("aadhaarBanao — model ki baat MAANO nahi, MILAO", () => {
  it("model ne jo kaha, usi me se bheje hue granth bachte hain", () => {
    const r = aadhaarBanao(["श्रीमद्भगवद्गीता"], ansh("श्रीमद्भगवद्गीता", "महाभारत"));
    expect(r.granth).toEqual(["श्रीमद्भगवद्गीता"]);
    expect(r.hataye).toEqual(["महाभारत"]);
    expect(r.girGaya).toBe(false);
  });

  // ⚠️ SABSE ZAROORI JAANCH — model granth GADH sakta hai.
  it("gadha hua naam Aadhaar me nahi jaata", () => {
    const r = aadhaarBanao(["अष्टावक्र गीता"], ansh("योग वासिष्ठ"));
    expect(r.gadhe).toEqual(["अष्टावक्र गीता"]);
    expect(r.granth).not.toContain("अष्टावक्र गीता");
  });

  // ⚠️ AADHAAR KABHI KHAALI NAHI. Khaali Aadhaar user ko "ye jawab kahin
  // se nahi aaya" dikhata hai — wo zyada naam dikhane se bhi bura hai.
  it("mel shoonya nikle to purane vyavhaar par girta hai", () => {
    const r = aadhaarBanao(["कोई और ग्रंथ"], ansh("योग वासिष्ठ", "महाभारत"));
    expect(r.granth).toEqual(["योग वासिष्ठ", "महाभारत"]);
    expect(r.girGaya).toBe(true);
  });

  it("model ne pankti hi na di to bhi purana vyavhaar", () => {
    const r = aadhaarBanao(null, ansh("योग वासिष्ठ"));
    expect(r.granth).toEqual(["योग वासिष्ठ"]);
    expect(r.soochiMili).toBe(false);
    expect(r.girGaya).toBe(true);
  });

  it("bade-chhote akshar aur extra jagah se farak nahi padta", () => {
    const r = aadhaarBanao(["  श्रीमद्भगवद्गीता  "], ansh("श्रीमद्भगवद्गीता"));
    expect(r.granth).toEqual(["श्रीमद्भगवद्गीता"]);
  });

  it("paanch se zyada granth nahi", () => {
    const r = aadhaarBanao(null, ansh("a", "b", "c", "d", "e", "f", "g"));
    expect(r.granth.length).toBe(5);
  });

  it("koi ansh hi na ho to khaali", () => {
    expect(aadhaarBanao(["गीता"], []).granth).toEqual([]);
    expect(aadhaarBanao(null, null).granth).toEqual([]);
  });
});

describe("bhejeGayeGranth", () => {
  it("dohraav hata kar usi kram me deta hai", () => {
    expect(bhejeGayeGranth(ansh("क", "ख", "क", "ग"))).toEqual(["क", "ख", "ग"]);
  });
  it("book_title na ho to book chalega", () => {
    expect(bhejeGayeGranth([{ chunk: { book: "mahabharata" } }])).toEqual(["mahabharata"]);
  });
});
