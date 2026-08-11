import { describe, it, expect } from "vitest";
import { BOOK_RIGHTS, BOOK_ORDER, canReadFull, restrictionInfo, bookRank } from "./bookRights.js";
import { BOOK_META } from "./bookMeta.js";

describe("bookRights — Read section ki adhikar-jaanch", () => {
  it("har maujooda kitab ka faisla likha hai (koi chhooti nahi)", () => {
    // Agar nayi kitab jodi jaaye aur yahan entry na ho, ye test fail hoga.
    // Ye jaan-boojh kar hai: default "band" hai, par CHUP-CHAAP band nahi —
    // faisla likha jaana chahiye.
    for (const id of Object.keys(BOOK_META)) {
      expect(BOOK_RIGHTS[id], `${id} ka adhikar-faisla bookRights.js mein nahi hai`).toBeDefined();
    }
  });

  it("anjaan kitab default roop se BAND hai (fail-closed)", () => {
    expect(canReadFull("koi_nayi_kitab_jo_abhi_nahi_hai")).toBe(false);
    expect(canReadFull(undefined)).toBe(false);
    expect(canReadFull("")).toBe(false);
  });

  it("Gita Press ki saari kitaabein band hain", () => {
    const gitaPress = Object.entries(BOOK_RIGHTS)
      .filter(([, r]) => r.pub === "गीता प्रेस")
      .map(([id]) => id);
    expect(gitaPress.length).toBe(13);   // 2026-08-07: Mahabharata bhi Gita Press
    for (const id of gitaPress) expect(canReadFull(id)).toBe(false);
  });

  it("band kitab par prakashak ka naam aur link milta hai", () => {
    const { pub, url } = restrictionInfo("bhagavad_gita_shankar");
    expect(pub).toBe("गीता प्रेस");
    expect(url).toBe("https://gitapress.org");
  });

  it("prakashak agyaat ho to link nahi, par band phir bhi", () => {
    expect(canReadFull("lal_kitab")).toBe(false);
    expect(restrictionInfo("lal_kitab").url).toBeNull();
  });

  it("sirf public-domain sanskaran khule hain", () => {
    const open = Object.entries(BOOK_RIGHTS).filter(([, r]) => r.access === "open").map(([id]) => id);
    expect(open.sort()).toEqual(["yoga_vasishtha"]);
  });
});

describe("bookRights — dikhane ka kram", () => {
  it("Saurabh ka bataya hua kram sabse upar hai", () => {
    expect(BOOK_ORDER.slice(0, 4)).toEqual([
      "ramcharitmanas", "bhagavad_gita_shankar", "mahabharata", "yoga_vasishtha",
    ]);
  });

  it("mahabharata ab ingest ho chuki hai aur teesre sthan par hai", () => {
    expect(BOOK_META.mahabharata).toBeDefined();
    expect(bookRank("mahabharata")).toBe(2);   // 0-indexed: teesra
  });

  it("Ved, Puran, Upanishad isi kram mein hain", () => {
    const r = (id) => bookRank(id);
    expect(r("rigveda_1")).toBeLessThan(r("shiva_purana_1"));
    expect(r("shiva_purana_1")).toBeLessThan(r("ishadi_upanishad"));
    expect(r("ishadi_upanishad")).toBeLessThan(r("guru_granth_sahib"));
  });

  it("har maujooda kitab ko kram mila hai (koi aakhir mein nahi girti)", () => {
    for (const id of Object.keys(BOOK_META)) {
      expect(bookRank(id), `${id} BOOK_ORDER mein nahi hai`).toBeLessThan(BOOK_ORDER.length);
    }
  });

  it("soochi mein na hone wali id aakhir mein jaati hai, crash nahi karti", () => {
    expect(bookRank("kuch_bhi")).toBeGreaterThan(bookRank("rashi_muhurt_vigyan"));
  });
});

describe("SYSTEM_PROMPT ki granth-soochi sach bolti hai — 2026-08-10", () => {
  // ASLI GHATNA: Ramayan ke do sawaalon par model ne likha "yeh katha
  // VALMIKI RAMAYANA mein varnit hai". Woh granth 7 August ko corpus se
  // hataya ja chuka tha — par prompt ki HAATH SE LIKHI soochi mein woh
  // abhi bhi tha. Model ne wahi kiya jo humne use bataya tha.
  //
  // Soochi CHAAR jagah jhoothi nikli:
  //   likha tha par hai nahi : Valmiki Ramayana, Mantra Shakti,
  //                            Nitya Devta Archana
  //   hai par likha nahi     : Mahabharata, Shri Ramcharitmanas,
  //                            Shri Yoga Vasishtha
  //
  // Ab soochi BOOK_META se banti hai (gemini.js ka GRANTH_NAMES). Ye test
  // us naate ki dono taraf pakadta hai — bina gemini.js ko import kiye,
  // kyunki wo module network/env ko chhoota hai aur test usmein nahi
  // ulajhna chahiye.

  it("hataye hue granth BOOK_META mein wapas nahi aa gaye", () => {
    const naam = Object.values(BOOK_META).map(m => m.en || m.title).join(" | ");
    for (const gaya of ["Valmiki", "Mantra Shakti", "Nitya Devta Archana"]) {
      expect(naam, `"${gaya}" hataya ja chuka hai, phir bhi soochi mein hai`)
        .not.toMatch(new RegExp(gaya, "i"));
    }
  });

  it("teen sabse badi kitaabein soochi mein hain", () => {
    // Ye teeno corpus ke ~60% hain (mahabharata 45%, yoga_vasishtha 11%,
    // ramcharitmanas 3.6%) aur teeno purani soochi se GAYAB the — isi wajah
    // se model ko pata hi nahi tha ki uske paas Ramcharitmanas hai.
    for (const id of ["mahabharata", "ramcharitmanas", "yoga_vasishtha"]) {
      expect(BOOK_META[id], `${id} BOOK_META mein hona chahiye`).toBeDefined();
    }
  });

  it("har granth ka naam hai — soochi isi se banti hai", () => {
    // Naam khaali hua to prompt mein us granth ki jagah gap aa jaayega
    // aur model use "hai hi nahi" samjhega.
    for (const [id, m] of Object.entries(BOOK_META)) {
      expect(m.en || m.title, `${id} ka naam khaali hai`).toBeTruthy();
    }
  });

  it("soochi mein poore 24 granth hain — chahe chaabiyan 25 hon", () => {
    // 25 chaabi, 24 granth. Shiv Puran do khand me hai aur dono ki PDF
    // alag hai, isliye BOOK_META me uski do entry hain. User ke liye wo
    // EK kitab hai.
    //
    // Isiliye do alag baatein alag-alag jaanchi jaati hain: chaabiyan
    // kitni (ingestion ki ginti), aur granth kitne (user ki ginti).
    // gemini.js ka SYSTEM_PROMPT doosri wali istemaal karta hai — warna
    // prompt me "25 granth … Shiva Purana Khand 1, Shiva Purana Khand 2"
    // likha jaata, jo user ke liye ek hi kitab do naam se hai.
    expect(Object.keys(BOOK_META).length).toBe(25);

    const granth = new Set(
      Object.values(BOOK_META)
        .map(m => (m.en || m.title || "").replace(/\s*(Khand|खण्ड|खंड)\s*[0-9०-९]+\s*$/i, "").trim())
        .filter(Boolean)
    );
    expect(granth.size).toBe(24);
  });
});
