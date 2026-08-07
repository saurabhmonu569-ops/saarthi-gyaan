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
import { toDevanagari, detectQueryLanguage, devanagariRatio, stripCyrillic,
         normalizeQueryForSearch, expandQueryWithParyay, GRANTH_PARYAY } from "./translit.js";

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

/**
 * 2026-08-06: eval-ask.mjs ne "sacche mitra ki pehchan kya hai" fail
 * hote dekha, jabki jawab corpus mein tha ("मित्र की पहचान भी विपत्ति
 * के समय ही होती है" — चाणक्य नीति). Wajah retrieval nahi, translit thi.
 * Naapa: 89 aam Hinglish shabdon mein se 37 (42%) Devanagari ban hi
 * nahi rahe the — aur wahi shabd the jinse log apni pareshani batate
 * hain.
 */
describe("bolchaal ke shabd — user apni pareshani inhi shabdon mein likhta hai", () => {
  it("problem-shabd Devanagari mein badalte hain", () => {
    const must = {
      pehchan: "पहचान", jhagda: "झगड़ा", naukri: "नौकरी",
      kalesh: "क्लेश", samasya: "समस्या", tanav: "तनाव",
    };
    for (const [en, hi] of Object.entries(must)) expect(toDevanagari(en)).toBe(hi);
  });

  it("jin shabdon ka bolchaal roop corpus mein nahi, wo granth-shabd par jaate hain", () => {
    // Naapa gaya corpus-hits comment mein hain (translit.js). Misaal:
    // दिक्कत 0 hits vs बाधा 542 — seedha lipyantaran yahan bekaar hota.
    expect(toDevanagari("dikkat")).toBe("बाधा");
    expect(toDevanagari("dost")).toBe("मित्र");
    expect(toDevanagari("dushman")).toBe("शत्रु");
    expect(toDevanagari("sapna")).toBe("स्वप्न");
    expect(toDevanagari("maafi")).toBe("क्षमा");
  });

  it("'ne/jo/us/in' — chhoote hue function words", () => {
    expect(toDevanagari("dost ne dhokha diya")).toBe("मित्र ने धोखा दिया");
  });

  it("asli sawaal poora sahi banta hai", () => {
    expect(toDevanagari("sacche mitra ki pehchan kya hai"))
      .toBe("सच्चे मित्र की पहचान क्या है");
  });
});

/**
 * 2026-08-06: yahi badlaav karte waqt ek PURANA bug pakda gaya —
 * normalizeQueryForSearch sirf Devanagari-ratio dekhti thi, isliye
 * SHUDDH ANGREZI sawaal bhi lipyantaran mein chala jaata tha aur bigad
 * jaata tha: "in this life what is the purpose" → "इन this life what
 * एेसा थे purpose". Angrezi bolne wale har user ki query aadhi bakwaas
 * ban rahi thi.
 */
describe("normalizeQueryForSearch — teeno bhashaon ka sahi bartaav", () => {
  it("shuddh angrezi ko bilkul nahi chhoota", () => {
    for (const q of [
      "what does the gita say about karma",
      "in this life what is the purpose",
      "my friend betrayed me",
      "how do I find inner peace",
    ]) {
      const r = normalizeQueryForSearch(q);
      expect(r.query, `angrezi query badal gayi: ${q}`).toBe(q);
      expect(r.transliterated).toBe(false);
    }
  });

  it("Hinglish ko Devanagari banata hai", () => {
    const r = normalizeQueryForSearch("paise ki dikkat hai");
    expect(r.transliterated).toBe(true);
    expect(r.query).toBe("पैसे की बाधा है");
  });

  it("pehle se Devanagari ho to waisa hi rehta hai", () => {
    const q = "मृत्यु के बाद आत्मा का क्या होता है";
    expect(normalizeQueryForSearch(q).query).toBe(q);
  });

  it("original hamesha bacha rehta hai (AI ke prompt ke liye)", () => {
    const q = "dost ne dhokha diya";
    expect(normalizeQueryForSearch(q).original).toBe(q);
  });
});

/**
 * 2026-08-07: Mahabharata jodne ke BAAD bhi "पति पत्नी में झगड़ा हो तो
 * क्या करें" 30 mein se akela fail hota raha — jabki jawab corpus mein
 * saaf maujood hai ("पुरुषको चाहिये कि वह कुपित होनेपर भी पत्नीके साथ
 * कोई अप्रिय बर्ताव न करे" — महाभारत, 79 chunks गृहस्थ-धर्म par).
 *
 * Jad: granth "कलह/भार्या/कुपित" likhte hain, user "झगड़ा/बीवी/नाराज".
 * Hinglish ke liye ye pul kal ban gaya tha, par Devanagari mein type
 * karne walon ko milta hi nahi tha.
 */
describe("expandQueryWithParyay — bolchaal se granth-bhasha ka pul", () => {
  it("bolchaal ke shabd par granth-paryay jodta hai", () => {
    const r = expandQueryWithParyay("पति पत्नी में झगड़ा हो तो क्या करें");
    expect(r).toContain("कलह");
    expect(r).toContain("विवाद");
  });

  it("user ke apne shabd KABHI nahi hataata — sirf jodta hai", () => {
    const q = "मुझे नौकरी की दिक्कत है";
    const r = expandQueryWithParyay(q);
    expect(r.startsWith(q)).toBe(true);
  });

  it("roop badle shabd bhi pakadta hai (पैसे, गलतियों, रिश्ते)", () => {
    // "पैसे" mein "पैसा" hai hi nahi — substring milaan yahan fail hota
    expect(expandQueryWithParyay("पैसे की तंगी")).toContain("धन");
    expect(expandQueryWithParyay("गलतियों की माफी")).toContain("दोष");
    expect(expandQueryWithParyay("रिश्ते खराब हैं")).toContain("सम्बन्ध");
  });

  it("jis query mein bolchaal ka shabd nahi, use bilkul nahi chhoota", () => {
    for (const q of ["मृत्यु के बाद आत्मा का क्या होता है", "भक्ति क्या है", "मोक्ष कैसे मिलता है"]) {
      expect(expandQueryWithParyay(q)).toBe(q);
    }
  });

  it("ek hi paryay do baar nahi judta", () => {
    // "झगड़ा" aur "झगड़े" dono "कलह" dete hain
    const r = expandQueryWithParyay("झगड़ा और झगड़े दोनों");
    expect(r.match(/कलह/g).length).toBe(1);
  });

  it("agar paryay pehle se query mein hai to dobara nahi judta", () => {
    const r = expandQueryWithParyay("घर में कलह और झगड़ा");
    expect(r.match(/कलह/g).length).toBe(1);
  });

  it("khaali/undefined par crash nahi karta", () => {
    expect(expandQueryWithParyay("")).toBe("");
    expect(expandQueryWithParyay(undefined)).toBe("");
  });

  it("naksha mein koi bhi paryay khud ek bolchaal-shabd nahi hai", () => {
    // Warna zanjeer ban jaati (A→B, B→C) aur query bekaboo phailti.
    const keys = new Set(Object.keys(GRANTH_PARYAY));
    for (const [bol, paryay] of Object.entries(GRANTH_PARYAY)) {
      for (const p of paryay) {
        expect(keys.has(p), `"${bol}" → "${p}" — par "${p}" khud naksha ki chaabi hai`).toBe(false);
      }
    }
  });
});
