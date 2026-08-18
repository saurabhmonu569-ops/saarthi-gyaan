import { describe, it, expect } from "vitest";
import {
  hasSentences, looksGarbled, MAX_FRAGMENT_RATIO,
  tokenAndaza, tokenBudgetMeKaato, DEV_BHAAR,
  GROQ_TPM_SURAKSHIT, MAX_TOKENS_CAP, TOKEN_BUDGET,
  ftsQuery,
} from "./paath.js";

/**
 * ⚠️ YE TEST 18 AGAST 2026 KE CHAAR ASLI BUG SE BANE HAIN, KALPANA SE NAHI.
 *
 * Us din worker (1,871 line, shoonya test) me ek ke peeche ek chaar
 * kharabiyan mili aur Ask section ~1 ghanta 40 minute band raha. Uske
 * teen fix inhi function me the — aur unhe jaanchne ka koi tareeka nahi
 * tha, isliye maine worker ke SOURCE SE `eval` karke jaancha. Wo jaanch
 * commit me bachi bhi nahi.
 *
 * Isliye har test ke saath likha hai ki wo KIS asli galti ko rok raha hai.
 * Koi test hatane se pehle wo galti padh lijiye.
 */

describe("token ka hisaab — Devanagari ka bhaar", () => {
  // ⚠️ 18 Agast ki JAD. Devanagari ko 1 token/akshar maana tha; Groq ne
  // phir bhi 413 diya. Asli tokenizer ~2 leta hai (matra aur halant apne
  // alag token bante hain). Isi ek galti se DO kharabiyan aayi —
  // 413 (input) aur MAX_TOKENS (jawab beech vaakya me kata).
  it("Devanagari Roman se kai guna mehnga ginta hai", () => {
    const dev = tokenAndaza("क".repeat(100));
    const rom = tokenAndaza("x".repeat(100));
    expect(dev).toBe(200);              // 100 × DEV_BHAAR
    expect(rom).toBe(29);               // 100 ÷ 3.5
    expect(dev / rom).toBeGreaterThan(6);
  });

  it("DEV_BHAAR 2 hai — 1 rakhne par 413 wapas aayega", () => {
    expect(DEV_BHAAR).toBe(2);
  });

  it("khaali aur null par nahi girta", () => {
    expect(tokenAndaza("")).toBe(0);
    expect(tokenAndaza(null)).toBe(0);
    expect(tokenAndaza(undefined)).toBe(0);
  });
});

describe("budget ke ank aapas me mel khate hain", () => {
  // ⚠️ Pehli koshish me TOKEN_BUDGET (5,500) aur GROQ_TPM_SURAKSHIT
  // (6,000) alag-alag likh diye the. 5,500 + 1,600 = 7,100 — apni hi
  // seema paar. Ab TOKEN_BUDGET ghata kar nikalta hai, par ye test us
  // rishte ko pakka rakhta hai agar koi dobara haath se likhe.
  it("input + output seema ke andar rehte hain", () => {
    expect(TOKEN_BUDGET + MAX_TOKENS_CAP).toBeLessThanOrEqual(GROQ_TPM_SURAKSHIT);
  });

  it("Groq ke asli 8,000 TPM se neeche hai (bachav ke saath)", () => {
    expect(GROQ_TPM_SURAKSHIT).toBeLessThan(8000);
  });
});

describe("tokenBudgetMeKaato — kaat-chhaant", () => {
  const SYS = { role: "system", content: "x".repeat(11205) };   // ~3,201 token

  it("SYSTEM ko kabhi haath nahi lagata", () => {
    const out = tokenBudgetMeKaato([SYS, { role: "user", content: "क".repeat(7000) }]);
    expect(out[0].content.length).toBe(11205);
  });

  // ⚠️ Ye bug asli tha: DEV_BHAAR 2 kiya par kaatne wale hisaab me 1 hi
  // raha — pehra apni seema 4,400 ki jagah 5,598 par chhod raha tha.
  it("kaat kar bhi budget ke ANDAR rehta hai", () => {
    const out = tokenBudgetMeKaato([SYS, { role: "user", content: "क".repeat(7000) }]);
    const kul = out.reduce((n, m) => n + tokenAndaza(m.content), 0);
    expect(kul).toBeLessThanOrEqual(TOKEN_BUDGET);
  });

  it("chhoti request ko chhoota hi nahi", () => {
    const chhoti = [SYS, { role: "user", content: "धर्म क्या है?" }];
    const out = tokenBudgetMeKaato(chhoti);
    expect(out).toHaveLength(2);
    expect(out[1].content).toBe("धर्म क्या है?");
  });

  it("purana itihaas pehle girta hai, aaj ka sawaal aakhir me", () => {
    const out = tokenBudgetMeKaato([
      SYS,
      { role: "user", content: "क".repeat(3000) },      // purana
      { role: "assistant", content: "क".repeat(3000) }, // purana
      { role: "user", content: "आज का सवाल" },          // naya — bachna chahiye
    ]);
    expect(out[out.length - 1].content).toContain("आज का सवाल");
  });

  it("ek bhi sandesh na ho to nahi girta", () => {
    expect(() => tokenBudgetMeKaato([SYS])).not.toThrow();
    expect(() => tokenBudgetMeKaato([])).not.toThrow();
  });
});

describe("hasSentences — citation ka haq", () => {
  it("poore vaakya wala paath paas karta hai", () => {
    expect(hasSentences("धर्म का पालन करना चाहिए।")).toBe(true);
    expect(hasSentences("यह श्लोक बताता है कि सत्य ही परम धर्म है")).toBe(true);
  });

  it("suchi aur table ko roka jaata hai", () => {
    expect(hasSentences("अध्याय १ २ ३ ४ ५")).toBe(false);
    expect(hasSentences("")).toBe(false);
    expect(hasSentences(null)).toBe(false);
  });
});

describe("looksGarbled — OCR-kachra", () => {
  // ⚠️ Ye asli paath hai — valmiki_ramayana (1927 sanskaran) se. Ye
  // "grounded" bankar model ko ja raha tha, yaani app apne hi kachre ko
  // us granth ke naam se quote kar sakti thi.
  it("asli OCR-kachra pakadta hai", () => {
    expect(looksGarbled(
      "द | चस्ति नि धा धत ॥ ३२ जी थी कह ने लगे कि, से शु क्त दन ब ड़ी क णा ध र ल्क तै"
    )).toBe(true);
  });

  it("saaf paath ko nahi pakadta", () => {
    expect(looksGarbled(
      "धर्म का पालन करना प्रत्येक मनुष्य का कर्तव्य है। सत्य बोलना और दूसरों की सहायता करना ही सच्चा धर्म कहलाता है।"
    )).toBe(false);
  });

  it("bahut chhote paath par chup rehta hai (12 se kam token)", () => {
    expect(looksGarbled("ॐ नमः शिवाय")).toBe(false);
    expect(looksGarbled("")).toBe(false);
    expect(looksGarbled(undefined)).toBe(false);
  });

  it("bina Devanagari ke paath par chup rehta hai", () => {
    expect(looksGarbled("this is plain english text with no devanagari at all here")).toBe(false);
  });

  it("seema 0.40 par hi hai — naap kar chuni gayi thi", () => {
    expect(MAX_FRAGMENT_RATIO).toBe(0.40);
  });
});

describe("ftsQuery", () => {
  it("har shabd par prefix lagta hai", () => {
    // Bina prefix ke "भय" akela kabhi match nahi karta — corpus me shabd
    // jude hue roop me hain ("भयसे", "भयके")
    expect(ftsQuery("भय")).toBe('"भय"*');
  });

  it("stopwords bahar rehte hain", () => {
    expect(ftsQuery("का के की को")).toBe(null);
  });

  it("ek akshar ka Devanagari nahi leta (2+ chahiye)", () => {
    expect(ftsQuery("क")).toBe(null);
  });

  // ⚠️ FTS5 me " aur * khaas hain — bina sambhale query hi toot jaati
  it("quote wale shabd se query nahi tootti", () => {
    const q = ftsQuery('धर्म "test"');
    expect(q).not.toMatch(/""/);
    expect(q).toContain("धर्म");
  });

  it("khaali par null", () => {
    expect(ftsQuery("")).toBe(null);
    expect(ftsQuery(null)).toBe(null);
  });
});
