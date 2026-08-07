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
