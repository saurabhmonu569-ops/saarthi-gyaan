import { describe, it, expect } from "vitest";
import { anupasthitGranthHai } from "./anupasthitGranth.js";
import { isOutOfScope } from "./translit.js";
import { detectHintedBook } from "./bookHints.js";

/**
 * ⚠️ YE TEST EK KHAAS TARAH KI JHOOTHI CITATION KE LIYE HAI.
 *
 * "vishay bahar hai" (mausam, petrol, iPhone) se ye ALAG hai. Yahan
 * vishay hamare paas HAI, par granth nahi:
 *
 *     "अष्टावक्र गीता में विदेह मुक्ति क्या है"
 *     → Yoga Vasishtha ka videha-mukti wala ansh, rerank 0.9965
 *
 * विदेह मुक्ति sach me hamare granthon me hai. Reranker galat nahi hai.
 * Galti ATTRIBUTION ki hai. Koi bhi threshold ise nahi rok sakta —
 * 0.9965 asli hai.
 *
 * NAAPA (19 Agast 2026, control_kathin — 20 sawaal):
 *     in niyamon se pehle : JHOOTHI CITATION 17/20 (best 0.84 – 0.9992)
 */
describe("anupasthit granth — jo hamare 24 me nahi hain", () => {
  it("un granthon ke naam pehchane jaate hain", () => {
    for (const q of [
      "अष्टावक्र गीता में विदेह मुक्ति क्या है",
      "नारद भक्ति सूत्र में प्रेम-लक्षणा भक्ति किसे कहते हैं",
      "विवेकचूड़ामणि में अध्यारोप और अपवाद की विधि क्या है",
      "शिव सूत्र में स्पन्द किसे कहते हैं",
      "पञ्चदशी में जीव और ईश्वर का भेद कैसे समझाया गया है",
      "हठयोग प्रदीपिका में षट्कर्म कौन-कौन से हैं",
      "घेरण्ड संहिता के सप्त साधन कौन से हैं",
      "योग याज्ञवल्क्य में नाड़ी शोधन कैसे बताया गया है",
      "गौडपाद कारिका में अजातिवाद क्या है",
      "ब्रह्मसूत्र के चार अध्यायों का विषय क्या है",
      "तिरुक्कुरल में गृहस्थ धर्म पर क्या कहा गया है",
      "कुलार्णव तंत्र में गुरु-शिष्य सम्बन्ध कैसा बताया गया है",
      "देवी गीता में शक्ति का स्वरूप कैसे बताया गया है",
      "अवधूत गीता में विदेह अवस्था क्या है",
      "मनुस्मृति में वर्ण व्यवस्था पर क्या कहा गया है",
      "Ashtavakra Gita me videh mukti kya hai",
      "Hathyog Pradipika me shatkarm kaunse hain",
      "Vivekchudamani me adhyarop apvad kya hai",
      "Bhagavata Purana me Uddhav Gita ka saar kya hai",
    ]) expect(anupasthitGranthHai(q), q).toBe(true);
  });

  // ⚠️ YE JAANCH ZYADA ZAROORI HAI. "गीता" aur "सूत्र" HAMARE granth hain.
  // Agar koi galti se akela "गीता" ya "सूत्र" list me likh de, to Bhagavad
  // Gita aur Yoga Sutra ke saare sawaal mar jayenge — aur wo nuksaan us
  // jhoothi citation se kahin bada hoga jise hum rok rahe hain.
  it("HAMARE granth galti se bahar na ho jaayein", () => {
    for (const q of [
      "गीता में कर्म योग क्या है?",
      "भगवद्गीता का सार क्या है",
      "श्रीमद्भगवद्गीता में स्थितप्रज्ञ कौन है",
      "what does the gita say about karma",
      "योग सूत्र में क्लेश कितने हैं",
      "Yoga Sutra me kleshas kitne hain",
      "पतंजलि का चित्तवृत्ति निरोध",
      "रामचरितमानस में भक्ति के बारे में क्या कहा है",
      "महाभारत में धर्म क्या है",
      "चाणक्य नीति में मित्र के बारे में क्या कहा है",
      "विष्णु पुराण में ध्रुव की कथा",
      "शिव पुराण में रुद्राक्ष का महत्व",
      "अग्नि पुराण में वास्तु",
      "गरुड़ पुराण में मृत्यु के बाद",
      "ईशावास्य उपनिषद का पहला मंत्र",
      "कठोपनिषद में नचिकेता",
    ]) expect(anupasthitGranthHai(q), q).toBe(false);
  });

  it("isOutOfScope inhe rokta hai", () => {
    expect(isOutOfScope("अष्टावक्र गीता में विदेह मुक्ति क्या है")).toBe(true);
    expect(isOutOfScope("गीता में कर्म योग क्या है?")).toBe(false);
  });

  /**
   * ⚠️ HINT WALA BUG — ISKA NUKSAAN SABSE BADA THA.
   *
   * detectHintedBook seedha substring match karta hai, isliye "अष्टावक्र
   * गीता" ke andar "गीता" mil jaata tha aur hint bhagavad_gita_shankar
   * ban jaata tha. Aur hint sirf sujhav nahi hai — HINTED_PAKKA=2 us
   * granth ke DO ansh SCORE DEKHE BINA jawab me daal deta hai. Yaani gate
   * ise rok hi nahi sakta tha.
   */
  it("hint 'X गीता' par Bhagavad Gita nahi dega", () => {
    expect(detectHintedBook("अष्टावक्र गीता में विदेह मुक्ति क्या है")).toBeNull();
    expect(detectHintedBook("देवी गीता में शक्ति का स्वरूप")).toBeNull();
    expect(detectHintedBook("अवधूत गीता में विदेह अवस्था")).toBeNull();
    expect(detectHintedBook("Ashtavakra Gita me videh mukti kya hai")).toBeNull();
    // par asli Gita ka hint bacha rehna chahiye
    expect(detectHintedBook("गीता में कर्म योग")).toBe("bhagavad_gita_shankar");
    expect(detectHintedBook("what does the gita say about karma")).toBe("bhagavad_gita_shankar");
  });
});
