import { describe, it, expect } from "vitest";
import { looksGarbled, hasSentences, MAX_FRAGMENT_RATIO } from "./ChatView.jsx";

/**
 * 2026-08-05 audit ka regression test.
 *
 * Asli ghatna: valmiki_ramayana (1927 sanskaran ka kharab scan) ka OCR
 * poori tarah kachra nikla, par usme "॥" aur "है" maujood the — isliye
 * hasSentences() ka gate paar karke woh chunk `grounded: true` ban jaata
 * tha. Natija: app apne hi OCR-kachre ko "Valmiki Ramayana ke anusaar"
 * likhkar quote kar sakti thi.
 *
 * Neeche ke garbled namoone SEEDHE corpus se uthaye gaye hain
 * (public/knowledge/books/valmiki_ramayana.json) — banaye nahi gaye.
 */
describe("looksGarbled — OCR-kachre par citation nahi lagni chahiye", () => {
  it("valmiki_ramayana ke asli garbled ansh pakadta hai", () => {
    expect(looksGarbled(
      "द | चस्ति निधाधत ॥ ३२ जी थी कहने लगे कि, से शुक्त दन बड़ी कणा धर ल्क तै ज चरित हैं थे बहुत च्छ जान पङ्के हैं ॥ ३६ ॥ ते! लत य॒ता तरार ५ स | सा चापि सः वश दति जी हारा है"
    )).toBe(true);

    expect(looksGarbled(
      "५8 २५ व्व च राजा छै स छालिल ही छल्ली छाती है, भहु जी के राजाओं के से ष का समस्त पर शाएसत शः | | 0 त ८ ला सागर ला । छरा नाव येन्न खानितः दष्टः थे वान्तं"
    )).toBe(true);
  });

  it("saaf granth-gadya ko NAHI pakadta", () => {
    // ramcharitmanas (asli chunk)
    expect(looksGarbled(
      "भगति हीन नर सोहइ कैसा। बिनु जल वारिद देखिअ जैसा॥ जाति पाति धनु धरमु बड़ाई। धन बल परिजन गुन चतुराई॥ भगति हीन नर सोहइ कैसा। बिनु जल वारिद देखिअ जैसा॥"
    )).toBe(false);

    // yoga_vasishtha (asli chunk)
    expect(looksGarbled(
      "पूर्वक उसे सुनकर एवं हृदय में धारण कर आप जीवन्मुक्त हो जायेंगे ॥५२॥ उक्त रामायण वसिष्ठ-राम संवादस्वरूप है । वह मुक्ति का अद्वितीय उपाय और अत्यन्त कल्याणकारी है । हे राजेन्द्र, आप उसे समझने में समर्थ हैं और मैं भी उसे जानता हूँ"
    )).toBe(false);
  });

  it("chhote ansh ko sazaa nahi deta (12 token se kam)", () => {
    // 12 se kam token par anupaat sirf shor hai — isliye hamesha false
    expect(looksGarbled("ॐ नमः शिवाय")).toBe(false);
    expect(looksGarbled("")).toBe(false);
    expect(looksGarbled(undefined)).toBe(false);
  });

  it("Latin-only ya khaali text par crash nahi karta", () => {
    expect(looksGarbled("this is plain english text with no devanagari at all here")).toBe(false);
    expect(looksGarbled("12345 !!! ??? ...")).toBe(false);
  });

  it("threshold wahi hai jo naapa gaya tha", () => {
    // Naap (32,032 chunks): 23 saaf kitaabein madhya 0.20–0.33,
    // valmiki 0.50. 0.40 par valmiki ka 97.8% pakda, jhootha alarm 3.7%.
    // Ise badalne se pehle dobara naapna — andaaze se mat badalna.
    expect(MAX_FRAGMENT_RATIO).toBe(0.40);
  });
});

describe("grounded ka faisla — client server se NAHI takraye (2026-08-10)", () => {
  // ASLI GHATNA: Worker mein naam liye gaye granth ke liye alag floor
  // (0.18) lagaya gaya, par ChatView mein `rerank >= 0.30` ka dobara
  // pehra reh gaya. Nateeja: jis sawaal mein user ne granth ka naam liya,
  // uske ansh server se 0.18-0.29 par aate the aur client unhe chup-chaap
  // khaarij kar deta tha — AADHAAR POORA GAAYAB.
  //
  // Live app par pakda gaya:
  //   "Ekadashi ke vrat me Dashami aur Dwadashi ka kya relevance hota hai?"
  //   "Chanakya Neeti ke according secret share karna risky kyu hai?"
  // Dono ka jawab aaya, dono ka Aadhaar nahi.
  //
  // Ye test us niyam ko pakadta hai: client SERVER ka `grounded` maanta
  // hai, apna score-gate nahi lagata.

  const grounded = (c) =>
    c.grounded === true && hasSentences(c.text) && !looksGarbled(c.text);

  const asliVaakya = "दान देनेसे मनुष्यको पुण्य मिलता है और उसका कल्याण होता है।";

  it("0.18-0.29 wale hinted ansh grounded rehte hain", () => {
    // Yahi wo dayra hai jo pehle chup-chaap gir jaata tha
    for (const r of [0.18, 0.22, 0.2447, 0.29]) {
      expect(grounded({ grounded: true, rerank: r, text: asliVaakya }),
        `rerank ${r} par grounded hona chahiye`).toBe(true);
    }
  });

  it("server ne khaarij kiya to client bhi khaarij karta hai", () => {
    expect(grounded({ grounded: false, rerank: 0.95, text: asliVaakya })).toBe(false);
  });

  it("table/OCR-kachra ab bhi ruka rehta hai — ye jaanch text ki hai, score ki nahi", () => {
    // Ye do jaanchein client par JAAN-BOOJHKAR bachi hain: inke liye kisi
    // sandarbh ki zaroorat nahi hai, isliye ye server se takraati nahi.
    const table = "कृतिका 0. उत्तरा फा. 9. उत्तराषाढ़ 2. रोहिणी 11. हस्त 20. श्रवण 3. मृग";
    expect(grounded({ grounded: true, rerank: 0.99, text: table })).toBe(false);
    const kachra = "द | चस्ति नि धा धत ॥ ३२ जी थी कह ने लगे कि, से शु क्त दन ब ड़ी क णा ध र ल्क तै";
    expect(grounded({ grounded: true, rerank: 0.99, text: kachra })).toBe(false);
  });
});
