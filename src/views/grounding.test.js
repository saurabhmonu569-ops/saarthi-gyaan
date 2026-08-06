import { describe, it, expect } from "vitest";
import { looksGarbled, MAX_FRAGMENT_RATIO } from "./ChatView.jsx";

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
