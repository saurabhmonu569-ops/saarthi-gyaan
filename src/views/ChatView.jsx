/**
 * SAARTHI — Chat view (starters, ChatMessage bubble, DemoKeyEntry, ChatView)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useBookProgress } from "@/context/AppContext";
import { BOOKS } from "@/data";
import { BOOK_META } from "@/data/bookMeta";
import { useT } from "@/i18n";
import { detectHintedBook } from "@/knowledge/bookHints";
import { serverRetrieve, warmServerSearch } from "@/knowledge/serverSearch";
import { normalizeQueryForSearch, expandQueryWithParyay, stripMetaFraming, questionToTopic, isOutOfScope } from "@/knowledge/translit";

// ── RELEVANCE GATE ───────────────────────────────────────────────────────
//
// 2026-08-03 (13 sawaal): reranker ka score bimodal laga — sahi 0.90+,
// kachra 0.01 se neeche. Us chhote namoone par 0.5 surakshit tha.
//
// 2026-08-10 (298 sawaal + 32 control): asli tasveer alag nikli. 78 fail
// sawaalon mein se 33 ka best-rerank 0.30–0.50 ke beech tha — yaani unka
// jawab MIL gaya tha, gate ne rok diya. Score bimodal nahi hai; beech
// mein kaafi kuch hai.
//
// Toh gate kahan rakhein? Faisla CONTROL sawaalon se hua — wo sawaal
// jinka jawab hamari kitaabon mein hai HI NAHI ("kal ka mausam", "petrol
// ka rate", "Bible mein kya likha hai"). Unpar koi bhi citation JHOOTHI
// citation hai. Naapa:
//     control ka sabse ooncha score : 0.177
//     control ke top-3              : 0.177, 0.166, 0.113
//     asli sawaalon ka atka hua dher: 0.30 – 0.50
// Beech mein 0.12 ka khaali maidan hai. 0.30 usi maidan ke doosre kinare
// par hai — poora atka dher andar aata hai, aur sabse ooncha control
// 0.123 neeche rehta hai.
//
// 0.23 bhi ganit ke hisaab se "surakshit" tha (+41 sawaal), par wahan
// margin sirf 0.05 bachta — aur ye ek hi run ka namoona hai. Jhoothi
// citation is app ki sabse badi haar hai; uske saamne 8 sawaal ka laalach
// kuch nahi.
//
// Ise badalne se pehle DOBARA naapo:  node scripts/eval-ask.mjs --300 --full
// Dekhna sirf ek cheez: `jhoothi cite` 0 rahi ya nahi.
//
// ⚠️ YE GATE AB SIRF WORKER MEIN HAI — client ise nahi lagata.
//
// P2 ke baad maine yahan bhi 0.30 ka pehra rakha tha, "do-parat suraksha"
// kehkar. Usi din Worker mein naam liye gaye granth ke liye alag floor
// (0.18) aaya — aur ye line 0.30 maangti rahi. Nateeja: har us sawaal par
// jahan user ne granth ka naam liya, Aadhaar POORA GAAYAB ho gaya. Live
// app par pakda gaya, kisi test par nahi.
//
// Sabak: gate ka faisla EK JAGAH rehna chahiye — wahan jahan poora
// sandarbh ho (kaunsa granth hinted hai, kaunsa floor lagta hai). Client
// ke paas wo sandarbh hai hi nahi. Do jagah ek hi niyam rakhna hamesha
// aise hi tootta hai.
//
// Asli gate: deploy/cloudflare-worker.js mein SEARCH_MIN_RERANK (0.30)
// aur SEARCH_HINTED_MIN_RERANK (0.18). Wahan poori tippani hai.
//
// Ye const yahan sirf itihaas ke liye chhoda hai — kahin istemal nahi hota.
const MIN_RERANK_SCORE = 0.30;   // eslint-disable-line no-unused-vars

/**
 * Kya is ansh mein asli VAAKYA hain, ya sirf table/suchi/mukhprishth hai?
 *
 * ASLI GHATNA (2026-08-04): "कृत्तिका नक्षत्र में जन्मे जातक" par
 * rashi_muhurt_vigyan p.74 aur p.75 mile. Reranker ne pass kar diya —
 * vishay to kritika hi tha. Par woh dono ansh TABLE hain:
 *     "कृतिका नक्षत्र जन्म-उत्पत्तिकर . कृतिका 0. उत्तरा फा. 9. उत्तराषाढ़
 *      संपत्तकर 2. रोहिणी ll. हस्त 20. श्रवण विपदकर 3. मृग…"
 * Nakshatron ke naam aur ank — koi vivaran nahi. Model ke paas kehne ko
 * kuch tha hi nahi, isliye usne apni taraf se bhar diya — aur jo likha
 * woh kitab ke BILKUL ULTA tha (kitab: कंजूसी, आक्रामक, झूठ; app: दयालु,
 * बुद्धिमान, सुख-समृद्धि). Aur footer ne unhi table-pannon ko cite kar
 * diya. Yeh sabse dhoka dene wala roop hai — sahi kitab, sahi panna,
 * ulta matlab.
 *
 * Naapne par saaf farak mila (prati 1000 akshar vaakya-chinh):
 *     table / copyright page   → 0
 *     asli Vedic richa         → 4.1 – 7.7
 *     asli Hindi gadya         → 17.9 – 46.6
 *
 * NOTE: aise ansh PHENKTE nahi — 2.8% chunks aise hain aur unme kuch
 * asli-par-kata-hua gadya bhi hai (agni_purana p.432 jaisa). Woh AI ko
 * context ki tarah ja sakte hain; bas CITATION ka aadhaar nahi ban
 * sakte. Content kabhi nahi khoyega, jhoothi citation nahi lagegi.
 */
export function hasSentences(text) {
  const t = (text || "").trim();
  if (!t) return false;
  return /।|॥|(?:है|हैं|था|थी|थे|हुआ|हुई|होता|होती|करते|करना|चाहिये|चाहिए|गया|गयी|रहता|रहती)(?=[\s।॥,.]|$)/.test(t);
}

/**
 * OCR-kachra pehchaan (2026-08-05 audit).
 *
 * KYUN ZAROORI: hasSentences() akela kaafi nahi hai. Bigda hua OCR bhi "॥"
 * aur "है" ugal deta hai, isliye woh gate paar kar jaata hai. valmiki_ramayana
 * (1927 sanskaran, kharab scan) ka asli text aisa nikla —
 *   "द | चस्ति निधाधत ॥ ३२ जी थी कहने लगे कि, से शुक्त दन बड़ी कणा धर ल्क तै"
 * — aur ye "grounded" bankar model ko jaa raha tha, yaani app apne hi kachre
 * ko Valmiki Ramayana ke naam se quote kar sakti thi. Wahi "jhootha aadhaar"
 * ki shikayat hai jo baar-baar aa rahi thi.
 *
 * KAISE: bigde OCR mein shabd TOOT jaate hain — "रामायण" → "रा मा यण". Toh
 * 1-2 akshar waale Devanagari token ka anupaat naapo.
 *
 * NAAPA GAYA (poora corpus, 32,032 chunks, per-book):
 *     madhya — 23 saaf kitaabein : 0.20 – 0.33
 *     madhya — valmiki_ramayana  : 0.50
 *   threshold 0.40 par:
 *     valmiki ke      97.8% chunks pakde gaye
 *     baaki 23 ke sirf 3.7% (jhootha alarm)
 *   0.45/0.50 par jhootha alarm to girta hai, par valmiki ka 16%/50% bach
 *   nikalta hai — isliye 0.40.
 *
 * hasSentences() ki tarah yeh bhi chunk PHENKTA nahi. Woh AI ko context ki
 * tarah mil sakta hai; bas CITATION ka aadhaar nahi ban sakta.
 */
export const MAX_FRAGMENT_RATIO = 0.40;
export function looksGarbled(text) {
  const words = String(text || "").match(/[ऀ-ॿ]+/g);
  // 12 se kam token par anupaat shor hai — chhote saaf ansh ko sazaa na mile
  if (!words || words.length < 12) return false;
  return words.filter(w => w.length <= 2).length / words.length > MAX_FRAGMENT_RATIO;
}
import { C, F } from "@/styles/theme";
import { SaarthiOrb, StatusDot, Btn, ThinkingBubble, Prose, cleanOcrText } from "@/components/ui/Primitives";
import { AudioEngine, HAS_EL } from "@/services/audioEngine";

const CHAT_STARTERS = [
  "I feel lost and don't know my direction",
  "I'm overwhelmed with stress lately",
  "Tell me about the Bhagavad Gita",
  "How do I deal with anger?",
  "I'm struggling with a big decision",
  "What does it mean to find purpose?",
];

export function ChatMessage({ msg, onRetry }) {
  const t = useT();
  const [copied,  setCopied]  = useState(false);
  const [playing, setPlaying] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content || "").catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const listen = () => {
    if (playing) { AudioEngine.stop(); setPlaying(false); return; }
    AudioEngine._stopCallback = () => setPlaying(false);
    AudioEngine.speak(msg.content || "", {
      onStart: () => setPlaying(true),
      onEnd:   () => { AudioEngine._stopCallback = null; setPlaying(false); },
    });
  };

  // User bubble
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18, animation: "fadeUp 0.22s ease" }}>
        <div style={{
          background: `linear-gradient(140deg, ${C.saffronL}, ${C.gold})`,
          color: C.white, borderRadius: "22px 22px 5px 22px",
          padding: "12px 18px", maxWidth: "78%", fontSize: F.base,
          lineHeight: 1.68, fontWeight: 430,
          overflowWrap: "break-word", wordBreak: "break-word",
          boxShadow: `0 2px 14px rgba(200,85,26,0.22)`,
        }}>{msg.content}</div>
      </div>
    );
  }

  const isErr = msg.error;
  return (
    <div style={{ display: "flex", gap: 11, marginBottom: 24, animation: "fadeUp 0.35s ease" }}>
      <SaarthiOrb size={33} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: isErr ? "#FEF2F2" : C.white,
          border: `1px solid ${isErr ? "#FCA5A5" : C.border}`,
          borderRadius: "5px 20px 20px 20px",
          padding: "14px 18px 12px",
          boxShadow: C.shadow,
        }}>
          {isErr ? (
            <>
              <p style={{ color: C.red, fontSize: F.base, lineHeight: 1.65, margin: "0 0 10px" }}>{msg.content}</p>
              {onRetry && <Btn variant="soft" size="sm" onClick={onRetry}>{t('retryBtn')}</Btn>}
            </>
          ) : (
            <>
              <Prose text={msg.content} />
              {msg.fallback && (
                <span style={{ display: "inline-block", marginTop: 10, fontSize: F.xs, color: C.muted, background: "#F5F2EC", borderRadius: 20, padding: "2px 10px", border: `1px solid ${C.border}` }}>
                  ⚡ Offline response
                </span>
              )}
            </>
          )}
        </div>

        {!isErr && (
          <div style={{ display: "flex", gap: 14, paddingLeft: 2, marginTop: 7, alignItems: "center" }}>
            <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: C.faint, fontSize: F.xs + 1, padding: 0, transition: "color 0.18s" }}
              onMouseEnter={e => e.target.style.color = C.muted} onMouseLeave={e => e.target.style.color = C.faint}>
              {copied ? t('copiedBtn') : t('copyBtn')}
            </button>
            <button onClick={listen} style={{ background: "none", border: "none", cursor: "pointer", color: playing ? C.saffron : C.faint, fontSize: F.xs + 1, padding: 0, transition: "color 0.18s" }}>
              {playing ? t('stopBtn') : t('listenBtn')}
            </button>
            <span style={{ fontSize: F.xs, color: C.faint, marginLeft: "auto" }}>{msg.time}</span>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── DEMO KEY ENTRY ───────────────────────────────────────────────────────────
// Allows user to paste Gemini key directly in app without editing .env
function DemoKeyEntry() {
  const [open,   setOpen]   = React.useState(false);
  const [key,    setKey]    = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [done,   setDone]   = React.useState(false);

  const save = () => {
    const trimmed = key.trim();
    if (!trimmed || trimmed.length < 10) {
      alert("Key bahut chhoti lag rahi hai. Dobara copy karo.");
      return;
    }
    // OAuth tokens LOOK like keys but do NOT work with the API — reject
    // them here with a clear message instead of silently failing later.
    if (trimmed.startsWith("AQ.") || trimmed.startsWith("ya29.")) {
      alert("❌ Yeh API key NAHI hai — yeh Google ka OAuth token hai (AQ./ya29.). Yeh kaam NAHI karega.\n\n✅ Groq ki FREE key lo (gsk_ se shuru hoti hai):\nconsole.groq.com/keys");
      return;
    }
    // Valid key formats: gsk_ (Groq — recommended), AIzaSy (Gemini)
    const isValid = trimmed.startsWith("AIza") || trimmed.startsWith("gsk_");
    if (!isValid) {
      alert("Key sahi format mein nahi hai.\n\nValid formats:\n• gsk_... (Groq - FREE)\n• AIzaSy... (Google Gemini)\n\nGroq key: console.groq.com/keys");
      return;
    }
    setSaving(true);
    // Store in localStorage so the key SURVIVES browser restarts.
    // (.env is still the preferred permanent home for the key.)
    localStorage.setItem("SAARTHI_RUNTIME_KEY", trimmed);
    setTimeout(() => {
      setSaving(false);
      setDone(true);
      // Force page reload so Vite picks up the key
      setTimeout(() => window.location.reload(), 800);
    }, 600);
  };

  // Check localStorage for runtime key
  React.useEffect(() => {
    let rk = "";
    try { rk = localStorage.getItem("SAARTHI_RUNTIME_KEY") || sessionStorage.getItem("SAARTHI_RUNTIME_KEY") || ""; } catch {}
    if (rk) setDone(true);
  }, []);

  if (done) return (
    <div style={{ padding:"8px 18px", background:"#ECFDF5", borderBottom:"1px solid #6EE7B7", flexShrink:0 }}>
      <p style={{ fontSize:F.sm, color:"#065F46", margin:0, fontWeight:600 }}>
        ✅ Key set — reloading app for real AI...
      </p>
    </div>
  );

  return (
    <div style={{ padding:"11px 18px 10px", background:"#FEF3C7", borderBottom:"2px solid #F59E0B", flexShrink:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <p style={{ fontSize:F.sm, color:"#78350F", margin:0, fontWeight:700 }}>
          ⚡ Demo Mode — Real AI ke liye FREE Groq key chahiye (gsk_...)
        </p>
        <button onClick={() => setOpen(!open)}
          style={{ border:`1px solid #F59E0B`, background:"white", borderRadius:8, padding:"3px 10px",
                   fontSize:F.xs+1, color:"#92400E", cursor:"pointer", fontWeight:700, flexShrink:0 }}>
          {open ? "Close ✕" : "Key Enter Karo →"}
        </button>
      </div>

      {!open && (
        <p style={{ fontSize:F.xs+1, color:"#92400E", margin:0, lineHeight:1.4 }}>
          Free key milegi: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
            style={{ color:C.saffron, fontWeight:700 }}>console.groq.com/keys</a>
          {" "}→ Sign in → "Create API Key" → Copy → paste here
        </p>
      )}

      {open && (
        <div style={{ marginTop:8 }}>
          <p style={{ fontSize:F.xs+1, color:"#92400E", margin:"0 0 8px", lineHeight:1.7 }}>
            <strong>Step 1:</strong> Jao → <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
              style={{ color:C.saffron, fontWeight:700 }}>console.groq.com/keys</a><br/>
            <strong>Step 2:</strong> List mein <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>...XBg</code> wali row dikhegi<br/>
            <strong>Step 3:</strong> Us row ke right side mein <strong>📋 copy icon</strong> directly dabaao<br/>
            <strong style={{color:"#DC2626"}}>⚠️ Popup mat kholo — popup se AQ. token aata hai jo kaam nahi karta</strong><br/>
            <strong>Step 4:</strong> Jo key copy ho woh <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>AIzaSy...</code> se shuru hogi — woh paste karo
          </p>
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="AIzaSy... (paste your Gemini key here)"
              style={{ flex:1, padding:"9px 12px", borderRadius:10, border:"1.5px solid #F59E0B",
                       fontSize:F.sm, outline:"none", fontFamily:"monospace", background:"white" }}
            />
            <button onClick={save} disabled={saving || !key.trim()}
              style={{ padding:"9px 16px", borderRadius:10, border:"none", cursor:saving?"wait":"pointer",
                       background:key.trim() ? C.saffron : C.border, color:"white",
                       fontSize:F.sm, fontWeight:700, flexShrink:0, transition:"all 0.2s" }}>
              {saving ? "Saving…" : "Activate ✓"}
            </button>
          </div>
          <p style={{ fontSize:F.xs, color:"#92400E", margin:"6px 0 0", opacity:0.8 }}>
            ⚠️ For permanent fix: paste key in <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>.env</code> file → restart <code style={{background:"#FEF9C3",padding:"1px 4px",borderRadius:3}}>npm run dev</code>
          </p>
        </div>
      )}
    </div>
  );
}

export function ChatView() {
  const t = useT();
  const [sacredChunks, setSacredChunks] = useState([]);

  // Worker ko jagao jab user Chat tab par aaye.
  //
  // Pehle yahan preloadSemanticSearch() tha, jo 59 MB vectors utaarne
  // lagta tha. Ab utarne ko kuch hai hi nahi — par cold start abhi bhi
  // hai: /search ka pehla call 3,028 ms naapa gaya (Worker isolate +
  // Vectorize ka pehla connection + AI model warmup). Ye chhota-sa call
  // wo teeno pehle hi kara deta hai, taaki user ka PEHLA sawaal bhi utna
  // hi tez lage jitna doosra. Fail-soft — result istemal nahi hota.
  useEffect(() => {
    warmServerSearch();
  }, []);

  // ── RETRIEVAL — ab SERVER par (P2, 2026-08-10) ────────────────────────
  //
  // Yahan pehle ~360 line thi: keyword search, cross-book search, semantic
  // search, source-quota merge, hinted-book guarantee, rerank, gate,
  // per-book cap, padosi ansh. Woh SAARA logic ab Worker ke /search mein
  // hai — ek-ek line, wahi sankhyayein (45/20/20, 0.30, cap 3, keep 12).
  //
  // KYUN HATAYA: woh code chalane ke liye browser ko 316 MB corpus utaarna
  // padta tha (books 165 + keyword index 93 + vectors 59). Gzip ke baad
  // bhi ~122 MB. Bharat mein mobile par koi itna intezaar nahi karta —
  // yaani 298 sawaalon par naapa hua 80% ka score kisi ASLI user tak
  // pahunchta hi nahi tha. Ab client par download 0 MB hai.
  //
  // JO YAHAN BACHA HAI, WO JAAN-BOOJHKAR BACHA HAI:
  //   translit / paryay / stripMetaFraming / isOutOfScope / detectHintedBook
  // Ye sirf CODE hain — inka lexicon KB mein hai, MB mein nahi. Client par
  // rehne se ek round-trip bachta hai aur inke unit test bina network ke
  // chalte rehte hain.
  const retrieveContext = useCallback(async (query) => {
    try {
      // 0. QUERY NORMALIZATION (item #17, 2026-08-03)
      // Poora corpus Devanagari mein hai. Roman/Hinglish sawaal
      // ("gussa kaise shant karein") ko model na Hindi maanta hai na
      // English — score girkar shor ke barabar aa jaata hai:
      //     gussa kaise shant karein   0.4370
      //     गुस्सा कैसे शांत करें         0.6595
      const { query: searchQ } = normalizeQueryForSearch(query);

      // DAAYRE SE BAHAR? (2026-08-10) — "Quran ki shiksha", "Meditation app
      // kaunsa best" jaise sawaalon par reranker 0.9+ score deta hai kyunki
      // wo VISHAY milata hai, sawaal nahi. Koi bhi threshold ise nahi rok
      // sakta. Hamare paas 24 gine-chune granth hain; unse bahar ki cheez
      // par citation lagana hi galat hai — chahe score kitna bhi ho.
      // Jawab phir bhi jaata hai, bas bina granth ke.
      //
      // Ye jaanch SERVER CALL SE PEHLE hai — ek bekaar round-trip aur ek
      // bekaar AI-neuron dono bach jaate hain.
      if (isOutOfScope(query)) {
        console.log("[Retrieval] sawaal hamare 24 granthon ke daayre se bahar — bina aadhaar ke jawab");
        setSacredChunks([]); return [];
      }

      // Teen alag query, teen alag kaam (2026-08-07):
      //   query   = user ka asli sawaal   → AI ke PROMPT mein (achhoota)
      //   rerankQ = meta-dhaancha hataya  → RERANKER ko
      //   findQ   = rerankQ + granth-paryay → DHOONDHNE ko
      //
      // KYUN rerankQ se meta hataya: "क्रोध को नियंत्रित करने के लिए
      // शास्त्र क्या कहते हैं?" par 0 ansh mile the — jabki corpus mein
      // krodh-niyantran par 464 chunks hain. Reranker cross-encoder hai;
      // "शास्त्र क्या कहते हैं" use KITAB ke baare mein sawaal lagta hai,
      // vishay ke baare mein nahi.
      //
      // KYUN findQ alag: paryay sirf UMMEEDWAAR dhoondhne ke liye hain.
      // Reranker ko paryay dene se sawaal anaad ho jaata hai aur wahi gate
      // bigadta hai jo 32 control sawaalon par 0 jhoothi citation deta hai.
      // PRASHN → VISHAY-VAAKYA, sirf aankne wali query par (2026-08-11).
      // Naapa gaya: "चेतना क्या होती है?" → 0.0023, par
      //             "चेतना का स्वरूप और उसका वर्णन" → 0.6831 (300 guna).
      // Granth prashn-uttar ki shaili mein likhe hi nahi hain; wo vishay
      // ka VARNAN karte hain. Isliye reranker ko prashn nahi, vishay do.
      //
      // findQ ko JAAN-BOOJHKAR nahi badla — wo FTS/Vectorize ko jaati hai
      // jahan "क्या/कैसे" stopword hain aur asli sawaal ke shabd hi pool
      // banate hain. Do query, do alag kaam.
      const baseQ   = stripMetaFraming(searchQ);
      const rerankQ = questionToTopic(baseQ);
      const findQ   = expandQueryWithParyay(baseQ);
      const hintedBook = detectHintedBook(query);

      const { chunks } = await serverRetrieve({ findQ, rerankQ, hintedBook });
      if (!chunks.length) { setSacredChunks([]); return []; }

      // Server se aaye ansh ko wahi shakl do jo gemini.js aur useChat.js
      // pehle se padhte hain: { chunk: {...}, score, rerank, grounded }.
      //
      // book_title SERVER SE NAHI aata — D1 mein sirf book-id hai. Wo naam
      // BOOK_META se lagta hai, jo pehle se client par hai (chand KB). Isse
      // bachao ye hai ki 57,339 ansh mein 57,339 baar wahi naam na ho.
      // book_title zaroori hai: gemini.js citation usi se banata hai aur
      // useChat.js ka verifyAnswer() usi se gadhe hue granth-naam pakadta
      // hai.
      const merged = chunks.map(c => {
        const meta = BOOK_META[c.book] || {};
        return {
          chunk: {
            id: c.id,
            book: c.book,
            book_title: meta.title || meta.en || c.book,
            page: c.page,
            text: cleanOcrText(c.text || ""),
            chapter: null, chapter_title: null, verse: null,
          },
          score: c.rerank,
          rerank: c.rerank,
          match_type: c.src === "neighbour" ? "neighbour" : "server",
          // ⚠️ YAHAN SE `rerank >= MIN_RERANK_SCORE` HATAYA (2026-08-10)
          //
          // Pehle yahan likha tha:
          //     c.rerank >= MIN_RERANK_SCORE   // 0.30
          // aur maine use "do-parat suraksha" kehkar rakha tha.
          //
          // Wo suraksha nahi, JAAL nikla. Usi din maine Worker mein naam
          // liye gaye granth ke liye alag floor (0.18) lagaya — par ye
          // line 0.30 hi maangti rahi. Nateeja: jis sawaal mein user ne
          // granth ka naam liya, uske ansh server se 0.18-0.29 par aate
          // the aur yahan CHUP-CHAAP grounded=false ho jaate the.
          // AADHAAR POORA GAAYAB. Live app par do sawaalon par dikha:
          //     "Ekadashi ke vrat me Dashami aur Dwadashi ka relevance?"
          //     "Chanakya Neeti ke according secret share karna risky?"
          // Dono ka jawab aaya, dono ka Aadhaar nahi.
          //
          // Jad ye hai ki GATE KA FAISLA AB SERVER KA HAI. Wahan poora
          // sandarbh hai — hinted granth kaun hai, kaunsa floor lagta hai.
          // Client ke paas wo sandarbh hai hi nahi, isliye uska dobara
          // faisla lena sirf server se TAKRAA sakta hai, sudhaar nahi
          // sakta. Do jagah ek hi niyam rakhna hamesha aisa hi tootta hai.
          //
          // `c.grounded` server ka faisla hai — usi par bharosa.
          // hasSentences/looksGarbled yahan RAHNE DIYE: ye TEXT ke apne
          // lakshan hain (table hai? OCR kachra hai?), inke liye kisi
          // sandarbh ki zaroorat nahi, aur ye server se takraate nahi.
          grounded: c.grounded === true
                    && hasSentences(c.text) && !looksGarbled(c.text),
        };
      });

      // Agar EK BHI ansh cite-layak nahi (sab table/suchi hain), toh unhe
      // AI ko bhejna hi galat hai — prompt unhe "RELEVANT PASSAGES FROM
      // SACRED BOOKS" kehkar deta hai, aur khaali table dekh kar model
      // apni taraf se bhar deta hai. Kritika wale case mein theek yahi hua.
      // Aisi haalat mein kuch mat bhejo — saada jawab, koi granth-daava
      // nahi. Yehi user ka apna niyam hai.
      if (!merged.some(m => m.grounded)) {
        console.log(`[Retrieval] ${merged.length} ansh mile par sab table/suchi hain — bina granth ke jawab`);
        setSacredChunks([]);
        return [];
      }

      setSacredChunks(merged);
      return merged;
    } catch (e) {
      console.warn("[Retrieval] failed:", e);
      setSacredChunks([]);
      return [];
    }
  }, []);

  const { messages, isLoading, loadPhase, countdown, apiStatus, sendUserMessage, clearMessages, retryLast } = useChat({
    mode: "chat",
    sacredChunks,      // injected — updates before each send
  });
  const [text,      setText]      = useState("");
  const [micOn,     setMicOn]     = useState(false);
  const taRef  = useRef(null);
  const endRef = useRef(null);
  const recRef = useRef(null);
  const fresh  = messages.length === 1;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  const autoSize = () => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 130) + "px";
  };

  const send = useCallback(async () => {
    const q = text.trim(); if (!q || isLoading) return;
    setText(""); if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.focus(); }
    // Retrieve sacred context for this query before sending
    const freshChunks = await retrieveContext(q);
    sendUserMessage(q, freshChunks || []);
  }, [text, isLoading, sendUserMessage, retrieveContext]);

  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const toggleMic = () => {
    if (micOn) { recRef.current?.stop(); setMicOn(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome on Android or desktop."); return; }
    const r = new SR(); r.lang = "hi-IN"; r.continuous = false; r.interimResults = false;
    r.onresult = e => { setText(e.results[0][0].transcript); setTimeout(autoSize, 10); };
    r.onend = () => setMicOn(false); r.onerror = () => setMicOn(false);
    r.start(); recRef.current = r; setMicOn(true);
  };

  const statusMeta = {
    ready:        { color: C.green,   label: t('statusConnected') },
    demo:         { color: "#D97706", label: t('statusDemo') },
    rate_limited: { color: "#F97316", label: t('statusFallback') },
    error:        { color: C.red,     label: t('statusError') },
  }[apiStatus] || { color: C.muted, label: "—" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.cream }}>

      {/* Header */}
      <div style={{ padding: "12px 18px 11px", borderBottom: `1px solid ${C.border}`, background: C.white, display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
        <SaarthiOrb size={38} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: F.md, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: -0.2 }}>Saarthi</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <StatusDot color={statusMeta.color} />
            <span style={{ fontSize: F.xs + 1, color: C.muted }}>{statusMeta.label}</span>
          </div>
        </div>
        {messages.length > 1 && (
          <button onClick={clearMessages} disabled={isLoading}
            style={{ border: `1px solid ${C.border}`, background: "none", borderRadius: 10, padding: "5px 12px", color: C.muted, fontSize: F.sm, cursor: "pointer" }}>
            {t('clearBtn')}
          </button>
        )}
      </div>

      {/* Demo notice with inline key entry */}
      {apiStatus === "demo" && (
        <DemoKeyEntry />
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 8px" }}>

        {/* Welcome + starters */}
        {fresh && (
          <div style={{ marginBottom: 26, animation: "fadeIn 0.4s ease" }}>
            <div style={{ display: "flex", gap: 11, marginBottom: 14 }}>
              <SaarthiOrb size={33} />
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: "5px 20px 20px 20px", padding: "15px 18px", boxShadow: C.shadow, flex: 1 }}>
                <p style={{ color: C.body, fontSize: F.base, lineHeight: 1.78, margin: "0 0 8px" }}>
                  {t('chatWelcomeGreetingPre')}<strong style={{ color: C.ink }}>Saarthi</strong>{t('chatWelcomeGreetingPost')}
                </p>
                <p style={{ color: C.muted, fontSize: F.base, lineHeight: 1.75, margin: 0 }}>
                  {t('chatWelcomeDesc')}
                </p>
              </div>
            </div>
            <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 10px", paddingLeft: 44 }}>{t('chatStartersLabel')}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 44 }}>
              {CHAT_STARTERS.map(c => (
                <button key={c} onClick={async () => { const fc = await retrieveContext(c); sendUserMessage(c, fc || []); }}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontSize: F.sm, cursor: "pointer", transition: "all 0.18s", boxShadow: C.shadow, lineHeight: 1.4 }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.goldBg; e.currentTarget.style.borderColor = C.goldBdr; e.currentTarget.style.color = C.ink; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.body; }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => <ChatMessage key={m.id} msg={m} onRetry={m.error ? retryLast : null} />)}

        {/* Thinking indicator */}
        {isLoading && (
          <div style={{ display: "flex", gap: 11, marginBottom: 22, animation: "fadeUp 0.2s ease" }}>
            <SaarthiOrb size={33} />
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: "5px 20px 20px 20px", padding: "14px 18px", boxShadow: C.shadow }}>
              <ThinkingBubble label={loadPhase} />
              {countdown > 0 && <p style={{ fontSize: F.xs, color: C.muted, margin: "6px 0 0" }}>({countdown}s)</p>}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.white, padding: "11px 14px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-end", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: "10px 13px", transition: "border-color 0.2s" }}
          onFocus={e => e.currentTarget.style.borderColor = C.saffron}
          onBlur={e  => e.currentTarget.style.borderColor = C.border}>
          <textarea ref={taRef} value={text}
            onChange={e => { setText(e.target.value); autoSize(); }}
            onKeyDown={onKey}
            placeholder={t('chatInputPlaceholder')}
            rows={1}
            style={{ flex: 1, background: "none", border: "none", outline: "none", resize: "none", color: C.ink, fontSize: F.base, lineHeight: 1.65, minHeight: 42, maxHeight: 130, padding: "2px 0", fontFamily: "inherit" }}
          />
          <button onClick={toggleMic} aria-label={micOn ? "Stop voice input" : "Start voice input"} aria-pressed={micOn}
            style={{ width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0, background: micOn ? "#FEE2E2" : "transparent", color: micOn ? C.red : C.faint, fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s" }}>
            🎙️
          </button>
          <button onClick={send} disabled={!text.trim() || isLoading} aria-label="Send message"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0, cursor: text.trim() && !isLoading ? "pointer" : "not-allowed", background: text.trim() && !isLoading ? C.saffron : C.border, color: C.white, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", boxShadow: text.trim() && !isLoading ? `0 2px 10px rgba(200,85,26,0.35)` : "none" }}>
            ↑
          </button>
        </div>
        <p style={{ fontSize: F.xs, color: C.faint, textAlign: "center", margin: "6px 0 0" }}>
          {t('chatFooterHint')}{HAS_EL ? " · ElevenLabs voice active" : ""}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — BOOKS with bookmarks + continue reading
// ─────────────────────────────────────────────────────────────────────────────

// useBookProgress — imported from AppContext (shared across all views, CRITICAL-2 fix)

