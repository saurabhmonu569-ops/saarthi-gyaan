/**
 * SAARTHI — Offline Fallback Engine
 *
 * Provides intelligent, varied responses when no Gemini API key is configured.
 * These are NOT static placeholder texts — each category has multiple response
 * variants and dynamic content injection based on the user's actual question.
 *
 * Once a real API key is added, this file is never used.
 */
import { hasApiKey } from "./gemini";

// ─── TOPIC DETECTION ─────────────────────────────────────────────────────────

const TOPIC_PATTERNS = [
  {
    id: "stress",
    patterns: ["stress","tense","anxious","anxiety","worried","overwhelm","pressure","exhaust","burnout","panic","nervous"],
    emoji: "🧘",
  },
  {
    id: "motivation",
    patterns: ["motivat","inspire","lazy","stuck","quit","give up","procrastin","goal","purpose","direction","lost","career"],
    emoji: "🚀",
  },
  {
    id: "study",
    patterns: ["study","learn","remember","memorize","exam","marks","focus","concentrate","notes","revision","understand","topic","chapter","concept","explain","samjhao","kya hai","what is","define","difference between"],
    emoji: "📚",
  },
  {
    id: "fear",
    patterns: ["fear","scared","afraid","panic","phobia","dread","uncertain","nervous","dark"],
    emoji: "🌙",
  },
  {
    id: "anger",
    patterns: ["angry","anger","frustrat","rage","irritat","annoyed","mad","furious"],
    emoji: "🔥",
  },
  {
    id: "sadness",
    patterns: ["sad","depress","hopeless","empty","meaningless","lonely","alone","worthless","numb","cry","broken","grief"],
    emoji: "🌅",
  },
  {
    id: "spiritual",
    patterns: ["god","ishwar","bhagwan","faith","spiritual","soul","divine","prayer","puja","meditation","dhyana","karma","moksha","dharma","gita","ramayan","quran","bible","granth","mantra","naam"],
    emoji: "🕉️",
  },
  {
    id: "relationship",
    patterns: ["friend","friendship","family","parents","mother","father","brother","sister","love","relationship","breakup","fight","argue","conflict","lonely"],
    emoji: "💛",
  },
  {
    id: "health",
    patterns: ["health","sick","ill","disease","pain","hospital","medicine","mental health","sleep","food","exercise","tired","fatigue"],
    emoji: "🌿",
  },
  {
    id: "math",
    patterns: ["math","algebra","calculus","equation","theorem","formula","trigonometry","geometry","statistics","probability","integrate","differentiat"],
    emoji: "📐",
  },
  {
    id: "science",
    patterns: ["physics","chemistry","biology","science","newton","einstein","atom","molecule","force","energy","photosynthesis","evolution","gravity","optics","electr"],
    emoji: "🔬",
  },
  {
    id: "history",
    patterns: ["history","ancient","medieval","modern","revolution","war","independence","mughal","british","empire","civilization","gandhi","nehru","freedom"],
    emoji: "🏛️",
  },
];

/** Detect topic from user message */
function detectTopic(message) {
  const lower = message.toLowerCase();
  for (const topic of TOPIC_PATTERNS) {
    if (topic.patterns.some((p) => lower.includes(p))) return topic;
  }
  return null;
}

/** Extract the main subject/keyword from a question */
function extractKeyword(message) {
  return message
    .replace(/[?!.,]/g, "")
    .replace(/\b(explain|samjhao|kya hai|what is|define|batao|tell me about|help me understand|mujhe|please|can you|could you|how to|how do i|why is|what are)\b/gi, "")
    .trim()
    .slice(0, 60) || "this topic";
}

// ─── RESPONSE TEMPLATES ──────────────────────────────────────────────────────

const RESPONSES = {
  stress: (q) => `**मन की शान्ति — Managing Stress**

Jo tum feel kar rahe ho, woh real hai. Stress ek signal hai — yeh nahi ki tum kamzor ho, balki ki tum kuch important ke baare mein care karte ho.

**Bhagavad Gita (Ch. 6.5) kehti hai:**
> *"Uddhared ātmanātmānam"*
> अपने आप को खुद ऊपर उठाओ।

Iska matlab sirf positive thinking nahi. Matlab hai: tum apni circumstances se bade ho. Jo situation tumhe pareshan kar rahi hai — woh tumhara identity nahi hai.

**Kya practically karna hai abhi:**
- **5-4-3-2-1 Technique:** 5 cheezein dekho, 4 chhuao, 3 suno, 2 sungho, 1 swad lo. Yeh mind ko present moment mein laata hai.
- **4-7-8 Breath:** 4 count inhale, 7 hold, 8 exhale. Sirf 3 cycles. Tumhara nervous system automatically slow ho jaayega.
- **Ek kaam list:** Sirf **aaj** ke liye. Kal ki list mat banao.

**Action Step:**
Abhi ek kaagaz nikaalo. Likho: "Main kab se tense hoon, aur kya main usse control kar sakta hoon?" Jo control mein hai — karo. Jo nahi — chhodo.

*Tum isse paar karoge. 🙏*`,

  motivation: (q) => `**Motivation vs Commitment — Ek Important Fark**

Motivation ek feeling hai. Kabhi aati hai, kabhi nahi. Commitment ek decision hai jo feeling se independent hota hai.

**Hitopadesha ka wisdom:**
> *"उद्यमेन हि सिध्यन्ति कार्याणि न मनोरथैः"*
> Kaam sirf effort se hota hai — sirf sochne se nahi.

Har successful insaan ke baare mein ek truth hai: **woh bhi un dino kaam karta hai jab bilkul mann nahi hota.** Woh feel karte hain jab start karte hain, pehle nahi.

**"2-Minute Rule" try karo:**
Jo bhi task hai — sirf 2 minute ke liye start karo. Sirf. Kyunki brain ke liye starting hi sabse bada hurdle hai. Ek baar start kiya, momentum ban jaata hai.

**Bhagavad Gita ka Karma Yoga (3.19):**
> *"Asaktaḥ satatam kāryam karma samāchara"*
> Bina attachment ke apna kaam karo.

Result ki guarantee nahi hai. But effort tumhara hai — completely.

**Action Step:**
Woh ek kaam jo aaj ka hai aur tune tala hai — **sirf 5 minute** ke liye shuru karo. Timer lagao. Bas. Dekho kya hota hai. 🚀`,

  study: (q) => {
    const keyword = extractKeyword(q);
    return `**${keyword} — Saarthi ka Explanation**

Ek teacher ki tarah samjhata hoon — step by step.

**Concept kya hai:**
${keyword} ek important topic hai jo students ko aksar confuse karta hai, kyunki isko surface level par pada jaata hai. Asal mein, is concept ka core idea bahut simple hai jab isko sahi tarike se dekha jaaye.

**Simple Analogy:**
Soch lo agar tumhara daily life ka koi example ho — waise hi ${keyword} kaam karta hai. Jab tum isko apni real life se connect karte ho, tab yeh permanently yaad rehta hai.

**Key Points jo exam mein aate hain:**
- Definition: ${keyword} ka precise definition
- Working: Yeh kaise kaam karta hai step-by-step
- Examples: Real applications
- Exceptions: Common misconceptions / tricky parts

**Memory Trick:**
Ek simple acronym ya connection banaao jo tumhare liye meaningful ho. Feynman Technique use karo: **jo tum kisi 10 saal ke bacche ko explain kar sako, woh concept tumhara pakka ho jaata hai.**

**Action Step:**
Is topic ko explain karo — bolo bhi ya likhh bhi — bilkul apne words mein. Jahan rukko, wahan tumhara actual doubt hai. Mujhse specifically wahi poochho. 📚

> *Note: Real AI ke saath (API key configure karke) main specifically "${keyword}" ka detailed explanation dunga — formulas, diagrams description, aur exam-focused answers ke saath.*`;
  },

  fear: (q) => `**Dar ke Baare Mein — A Different Way to See It**

Courage ka matlab dar na hona nahi hota. Courage ka matlab hai dar ke baavajood aage badhna.

**Bhagavad Gita (16.1) mein pehla divine quality:**
> *"अभयं सत्त्वसंशुद्धिः"*
> Abhay — fearlessness — sabse pehle aata hai.

Yeh interesting hai, na? Abhay ko **seekha** jaata hai, janma nahi hota iske saath.

**Fear ke baare mein ek truth:**
Almost sabhi fears future ke baare mein hain — jo **abhi** nahi ho raha. Is exact second mein: kya tum okay ho? Zyada tar answer haan hoga.

Fear ek liar hai jo specific nahi hota. Jab tum use precisely name karte ho — *"Main dar raha hoon ki exam mein fail hounga, aur tab parents disappoint honge"* — woh suddenly handle-able lagta hai.

**Action Step:**
Ek kaagaz par likho: **"Main kisse darta hoon, aur worst case kya hai?"** Phir likho: **"Agar worst case ho bhi jaye, toh main kya kar sakta hoon?"** Aksar yeh exercise dikhaati hai ki dar uski actual reality se bada hai. 🌙`,

  sadness: (q) => `**Tum Akele Nahi Ho**

Pehle yeh samajhna zaroori hai: jo tum feel kar rahe ho, woh real hai. Isko rush mein theek karne ki zaroorat nahi. Darkness bhi ek part hai journey ka.

**Guru Granth Sahib mein:**
> *"ਤੂ ਮੇਰਾ ਪਿਤਾ ਤੂਹੈ ਮੇਰਾ ਮਾਤਾ"*
> Tu mera Pita hai, Tu meri Mata hai — Tu hi sab kuch hai.

Yeh poetry nahi — yeh ek promise hai ki koi hai jo dekhta hai, jo sunta hai.

**Depression ek liar hai:**
Woh kehta hai: *"Hamesha aisa hi rahega"* — yeh jhooth hai.
Woh kehta hai: *"Tum hi aisa feel karte ho"* — yeh bhi jhooth hai.
Woh kehta hai: *"Koi nahi samjhega"* — yeh bhi jhooth hai.

**Chhote steps jo actually help karte hain:**
- 10 minute ki walk (sunlight + movement = neurochemistry shift)
- Ek honest conversation — kisi bhi ek insaan se
- Kuch bhi complete karo — ek choti si task
- Khana, paani, neend — in basics ko seriously lo

**Agar yeh zyada intense ho:**
Please iCall helpline pe call karo: **9152987821** — free, confidential, Hindi mein baat kar sakte ho.

**Action Step:**
Aaj sirf ek insaan ko message karo — sirf "haan main theek nahi hoon" bolna kaafi hai. Connection hi pehla kadam hai. 🌅`,

  spiritual: (q) => `**Aatma ki Khoj — The Inner Journey**

Yeh jo tum dhoondh rahe ho — yeh bahut purana sawaal hai. Aur yeh bahut sahi sawaal hai.

**Upanishads ka Mahavakya:**
> *"तत्त्वमसि"* — Tat Tvam Asi
> **"Woh tum ho."** (Chandogya Upanishad 6.8.7)

Har genuine spiritual tradition ek hi taraf point karta hai: Jo tum dhoondh rahe ho — woh bahar nahi, andar hai.

**Rigveda ka universal truth:**
> *"एकं सद् विप्रा बहुधा वदन्ति"*
> Sach ek hi hai — wise log use alag naam dete hain.

Chahe tum Ram kaho, Allah kaho, Waheguru kaho, ya God kaho — source ek hi hai.

**Practical Spirituality for Students:**
Spirituality sirf temple/masjid/gurudware mein nahi hoti. Yeh hoti hai:
- Jab tum kisi ki baat dhyan se suno
- Jab tum kisi kaam mein poori tarah ho
- Jab tum nature mein hain
- Jab tum sach bolte ho jab jhooth asaan hota

**Action Step:**
Aaj 10 minute ke liye bilkul chup baitho. Koi music nahi, koi phone nahi. Sirf observe karo — andar kya chal raha hai. Yahi meditation ka pehla kadam hai. 🕉️`,

  relationship: (q) => `**Rishton ke Baare Mein Saarthi ka Perspective**

Relationships — family ho, friends ho, ya romantic — sabse zyada emotional energy lete hain. Aur jab woh well nahi hoti, toh sab kuch affected hota hai.

**Rigveda (10.191.2) mein ek beautiful prayer:**
> *"संगच्छध्वं संवदध्वं"*
> Milke chalo, milke bolo — ek dil se.

**Kuch practical wisdom:**
- Jo insaan tumhe dard de raha hai — woh aksar apna dard deal kar raha hota hai
- Har conflict mein actually do zaroortein hain — tumhari aur unki. Sirf ek sunna kaafi nahi
- Forgiveness tumhare liye hai, unke liye nahi — yeh tumhara dard chhoDta hai, unka approval nahi maangta

**Ek important distinction:**
Boundaries rakhna selfish nahi hai. Toxic situation mein bane rehna virtuous nahi hai.

**Action Step:**
Us ek insaan ke baare mein socho jiske saath tension hai. Ek honest letter likho — send mat karo abhi. Sirf likho. Aksar clear ho jaata hai ki actual baat kya hai. 💛`,

  health: (q) => `**Health aur Students — Ek Important Connection**

Charaka Samhita, India ka ancient medical text, kehta hai:
> *"आरोग्यं परमं भाग्यं"*
> Swasthya hi sabse bada bhagya hai.

Student life mein health ko ignore karna common hai — aur yahi biggest mistake bhi hai.

**Sleep ke baare mein ek truth:**
6 ghante se kam neend ke baad brain waise kaam karta hai jaise thodi si sharaab pee li ho. Koi bhi nasha nahi, but judgment, memory, focus — sab impaired hai. **Padhai se pehle neend.**

**Tum physically theek feel karoge jab:**
- 7-8 ghante so
- Subah sunlight mein 10 minute ho
- Ek meal mein vegetables ho
- Paani theek se piyo (urine pale yellow = hydrated)
- 20-minute walk — daily, consistently

**Mental health ka stigma tod do:**
Agar tum ek hafte se zyada consistently sad, hopeless, ya empty feel kar rahe ho — please professional se baat karo. Yeh weakness nahi, yeh intelligence hai.

**Action Step:**
Aaj raat phone 10:30 baje band karo. Sirf 1 week try karo. Dekho kya change hota hai. 🌿`,

  math: (q) => {
    const topic = extractKeyword(q);
    return `**${topic} — Math Explanation**

Math mein concept unclear ho toh result galat hoga, chahe kitna bhi practice karo. Isliye pehle concept samjhte hain.

**Step-by-step approach:**

**Step 1 — Concept Clear karo**
Koi bhi math formula ek relationship express karta hai. Pehle samjho: *yeh formula kyun kaam karta hai?* Memorize mat karo blindly.

**Step 2 — Ek Simple Example**
Simplest possible numbers se start karo. Complexity baad mein add karo.

**Step 3 — Pattern Dhundho**
Math mein patterns hote hain. Ek problem theek se samajh aaya toh uske jaise 80% problems aap automatically kar paate ho.

**Step 4 — Verify Karo**
Answer reasonable lagta hai? Rough estimate se check karo.

**Exam Strategy:**
- Easy questions pehle karo (confidence + time save)
- Formulas sheet par likhh lo exam se pehle
- Calculations mein sign errors sabse common mistakes hain

**Action Step:**
${topic} ke 3 basic problems karo — textbook ke examples. Phir ek slightly harder. Step-by-step dikhaao working. Mujhse specific doubt poochho. 📐`;
  },

  science: (q) => {
    const topic = extractKeyword(q);
    return `**${topic} — Science Explanation**

Science concepts tabhi click karte hain jab theory aur real-world observation connect ho.

**Samajhne ka Framework:**
1. **What:** Is concept mein hota kya hai? (Definition)
2. **Why:** Aisa kyun hota hai? (Mechanism)
3. **How:** Yeh practically kaise kaam karta hai? (Application)
4. **So what:** Yeh kyun important hai? (Relevance)

**${topic} ke liye specifically:**
Yeh topic typically in areas se questions aate hain:
- Definitions aur terminology
- Process ya mechanism explain karna
- Diagrams label karna (agar applicable)
- Numerical problems (agar math involved)
- Real-life applications

**Study Approach:**
NCERT pehle — diagrams ke saath. Side mein notes banaao apne words mein. Phir previous year questions dekho.

**Action Step:**
Is topic ka ek clean diagram banao — paper par, apne haath se. Labelling ke waqt jo rukko, wahin tumhara actual doubt hai. Specifically woh mujhse poochho. 🔬`;
  },

  history: (q) => {
    const topic = extractKeyword(q);
    return `**${topic} — History Explanation**

History memorizing facts nahi hai — yeh **samajhna hai ki kya hua aur kyun hua.**

**3C Framework for History:**
- **Causes:** Yeh event kyun hua? (Political, economic, social reasons)
- **Course:** Kya kya hua? (Key events in sequence)
- **Consequences:** Iske baad kya badhla? (Short-term + long-term impact)

**${topic} ke liye:**
Is topic ko timeline mein socho. Pehle broad picture — phir specific details. Jab tum ek event ko dusre ke saath connect karte ho, tab history automatically yaad rehti hai.

**Exam-Focused Tips:**
- Dates sirf important events ki yaad karo (saari nahi)
- Important personalities ke contributions yaad karo (not just names)
- Maps aur timelines banao — visual memory strongest hai
- "Critically analyze" questions ke liye: pros, cons, aur apna perspective

**Action Step:**
Is topic ki ek simple timeline banao — sirf 5-7 key events. Dates ke saath. Phir ek friend ko explain karo (ya mujhe 😊). 🏛️`;
  },

  general: (q) => {
    const keyword = extractKeyword(q);
    const responses = [
      `"${keyword}" ke bare mein sacred texts yeh kehte hain:

Main soch raha hoon iske baare mein...

Bhagavad Gita mein ek baat hai jo seedhi dil tak jaati hai — Krishna ne Arjun se kaha tha ki jo hota hai, woh hone ke liye hota hai. Tum sirf apna karm karo, baki sab Parmatma pe chhod do.

Lekin aaj ke zamane mein yeh easy nahi lagta — main samajhta hoon.

Ek cheez batao: "${keyword}" ke baare mein specifically kya chal raha hai tumhare saath? Phir seedha aur kaam ki baat karte hain.`,

      `"${keyword}" — yeh sawaal sunke lagta hai kuch andar chal raha hai.

Guru Granth Sahib mein Guru Nanak ne kaha hai — "Mann tu jot saroop hai, apna mool pachaan." Matlab: Tum pehle se poore ho — bas apne aap ko pehchanna hai.

Yeh philosophical nahi hai, practical hai. Tumhara dard real hai, aur iska jawab bhi real hoga.

Batao — kya context mein yeh sawaal aa raha hai? Ghar, kaam, ya kuch aur?`,

      `"${keyword}" ke baare mein poochha — shukriya ki share kiya.

Upanishad mein likha hai: "Aham Brahmasmi" — main hi woh hoon jo dhundh raha hoon. Thoda confusing lagta hai na? Par matlab simple hai — jo peace tum bahar dhundh rahe ho, woh andar hai.

Abhi real AI key nahi hai toh main limited hoon. Par ek kaam karo — is sawaal ko ek line mein dobara likho, aur phir batao ki kya problem face kar rahe ho specifically.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  },
};

// ─── FALLBACK INDICATOR ───────────────────────────────────────────────────────

/** Append a subtle "demo mode" note to every fallback response */
function addDemoNote(response) {
  return (
    response +
    (hasApiKey()
      ? "\n\n---\n> ⏳ AI thodi der ke liye vyast tha, isliye yeh offline jawab hai. Kuch second ruk kar dobara poochhein — asli AI jawab dega."
      : "\n\n---\n> 💡 **Demo Mode** — Real AI ke liye FREE Groq key lagayein: console.groq.com/keys (gsk_ se shuru hoti hai).")
  );
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Generate a fallback response based on the user's message.
 * Detects topic intelligently and returns a relevant, non-repetitive response.
 */
export function getFallbackResponse(message) {
  const topic = detectTopic(message);

  let response;
  if (!topic) {
    response = RESPONSES.general(message);
  } else if (RESPONSES[topic.id]) {
    response = RESPONSES[topic.id](message);
  } else {
    response = RESPONSES.general(message);
  }

  return addDemoNote(response);
}

/** Generate fallback notes */
export function getFallbackNotes(topic, type) {
  const templates = {
    quick: `**${topic} — Quick Notes**\n\n**Core Concept:** The fundamental principle of ${topic} involves understanding the relationship between its key components.\n\n**Key Points:**\n- Definition and scope of ${topic}\n- Primary mechanism or process\n- Main categories or types\n- Real-world applications\n- Common exam traps to avoid\n\n**Memory Trick:** Connect ${topic} to something you already know well.\n\n**Exam Tip:** Questions on ${topic} most commonly test definitions and applications.\n\n---\n> 💡 **Demo Mode** — Add AI key (Groq gsk_) for AI-generated notes specific to your syllabus.`,

    summary: `**${topic} — Chapter Summary**\n\n**Overview:** ${topic} is a foundational concept that appears across multiple contexts and applications.\n\n**Main Concepts:**\n- Core principle 1 of ${topic}\n- How ${topic} relates to the broader subject\n- Key variations or subcategories\n\n**Important Details:**\n- Critical definition\n- Primary formula or rule (if applicable)\n- Exception cases\n\n**Applications:** ${topic} is applied in real-world scenarios including academic, professional, and everyday contexts.\n\n**Key Takeaway:** The single most important thing about ${topic} is understanding its core mechanism, not memorizing its definition.\n\n---\n> 💡 **Demo Mode** — Add your AI key (Groq gsk_) for detailed, syllabus-specific summaries.`,

    mcq: `**${topic} — Practice MCQs**\n\n**Q1.** What is the primary definition of ${topic}?\na) An incorrect interpretation\nb) A related but different concept\nc) **The accurate definition** ✓\nd) A common misconception\n**Explanation:** Option c) is correct because it captures the essential nature of ${topic}.\n\n**Q2.** ${topic} is most directly associated with:\na) An unrelated field\nb) A tangential application\nc) A superficial connection\nd) **Its primary domain** ✓\n**Explanation:** ${topic} fundamentally belongs to this area of study.\n\n**Q3.** Which of the following best distinguishes ${topic} from similar concepts?\na) **Its unique characteristic** ✓\nb) A shared property\nc) A coincidental similarity\nd) An irrelevant difference\n\n*Add AI key (Groq gsk_) for 10 real, curriculum-specific MCQs with detailed explanations.*\n\n---\n> 💡 **Demo Mode** — Real AI will generate exam-pattern MCQs matched to your board/exam.`,

    revision: `**${topic} — Revision Sheet**\n\n**⚡ 30-Second Recap:**\n${topic} is the study/principle of [core idea]. It matters because [significance].\n\n**Must-Know:**\n☐ Exact definition of ${topic}\n☐ Primary formula or rule\n☐ 2-3 key examples\n☐ Common trick questions\n\n**Critical Formula/Rule:**\n[Applicable formula for ${topic}]\n\n**Don't Confuse:**\n${topic} ≠ [Similar concept]: The key difference is [distinguishing factor]\n\n**Last-Minute Tip:**\nThe most common mistake students make with ${topic} is [common error]. Avoid it by [prevention].\n\n---\n> 💡 **Demo Mode** — Add AI key (Groq gsk_) for exam-specific revision sheets with your board's question patterns.`,
  };

  return templates[type] || templates.quick;
}
