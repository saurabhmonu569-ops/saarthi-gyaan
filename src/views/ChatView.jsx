/**
 * SAARTHI — Chat view (starters, ChatMessage bubble, DemoKeyEntry, ChatView)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useKnowledge } from "@/hooks/useKnowledge";
import { useBookProgress } from "@/context/AppContext";
import { BOOKS } from "@/data";
import { useT } from "@/i18n";
import { detectHintedBook } from "@/knowledge/bookHints";
import { semanticSearch, preloadSemanticSearch, rerankPassages, RERANK_MAX_TOTAL } from "@/knowledge/semanticSearch";
import { normalizeQueryForSearch } from "@/knowledge/translit";

// ── RELEVANCE GATE (item #17, 2026-08-03) ────────────────────────────────
// 13 sawaalon par naapa gaya. Reranker ka score bimodal nikla:
//     sahi sawaal   0.9009 – 0.9995
//     kachre sawaal 0.0000 – 0.0131
// Beech mein kuch nahi. 0.5 par dono taraf ~0.44 ka margin — itna chauda
// ki koi ek sawaal ise hila nahi sakta.
//
// Ise badalna ho toh pehle naapo:  node scripts/test-reranker.mjs
const MIN_RERANK_SCORE = 0.5;

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
function hasSentences(text) {
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
  const { ready: knowledgeReady, crossBookSearch, hybridSearch, getBookChunks, getChunk } = useKnowledge();
  const [sacredChunks, setSacredChunks] = useState([]);

  // FIX (2026-07-26): real neural semantic search ab bhi Ask ke liye warm
  // hona shuru ho jaata hai jab user Chat tab par aata hai — pehla asli
  // sawaal aane tak model+vectors (background mein) load ho chuke hote
  // hain, taaki pehla jawab bhi tez ho. Fail-soft — is call ka result
  // istemal nahi hota, sirf warmup ke liye hai.
  useEffect(() => {
    preloadSemanticSearch();
  }, []);

  // Build a stable retrieval function — called before every AI send
  // Merges keyword + cross-book + semantic results, deduplicates by chunk ID, sorts by score
  const retrieveContext = useCallback(async (query) => {
    if (!knowledgeReady) return [];
    try {
      // 0. QUERY NORMALIZATION (item #17, 2026-08-03)
      // Poora corpus Devanagari mein hai. Roman/Hinglish sawaal
      // ("gussa kaise shant karein") ko model na Hindi maanta hai na
      // English — score girkar shor ke barabar aa jaata hai:
      //     gussa kaise shant karein   0.4370
      //     गुस्सा कैसे शांत करें         0.6595
      // Lexicon-based translit (corpus ke 6,000 sabse aam shabd) se 96%
      // faayda wapas aata hai. Keyword search ko bhi isse hi laabh hota
      // hai — woh bhi Devanagari substring par chalti hai.
      // Original query AI ke prompt ke liye waisa hi rehta hai; yeh sirf
      // DHOONDHNE ke liye hai.
      const { query: searchQ } = normalizeQueryForSearch(query);

      // 1. Cross-book: top 3 per book
      const crossResults = crossBookSearch(searchQ, null, 3);
      const crossFlat = crossResults.flatMap(r => r.results);

      // 2. Keyword: direct inverted-index search
      const kwResults = hybridSearch(searchQ, null, {}, 40);

      // 2.5 REAL semantic search (2026-07-26 fix — see src/knowledge/
      // semanticSearch.js for full context): keyword search sirf exact/
      // substring text match karta hai — "family mein ego kaise kam
      // karein" jaisa paraphrased sawaal miss ho sakta hai agar corpus
      // "ahankar" shabd use karta ho, "ego" nahi. Yeh asli meaning se
      // match karta hai. FAIL-SOFT: model abhi load ho raha ho ya fail
      // ho jaaye toh khaali array — keyword+cross-book upar se hamesha
      // kaam karte rehte hain, yeh sirf ADDITIONAL signal hai.
      let semResults = [];
      try {
        const semHits = await semanticSearch(searchQ, 50);
        semResults = semHits
          .map(h => {
            const chunk = getChunk(h.id);
            return chunk ? { chunk, score: h.score, match_type: "semantic" } : null;
          })
          .filter(Boolean);
      } catch { /* soft-fail — keyword+cross-book results still cover us */ }

      // 3. SOURCE-BALANCED MERGE (2026-08-03 fix)
      //
      // Pehle yahan teeno sources ko ek saath dal kar `r.score > existing.score`
      // se chuna jaata tha. Par teeno ke paimane ALAG hain:
      //     keyword  : (s/keywords.length) * (0.5 + 0.5*density)  — apna scale
      //     semantic : cosine, −1..1
      //     overview : hardcoded 0.05
      // Inhe `>` se tolna kilo aur kilometre ki tulna hai. Isliye har source
      // se ALAG-ALAG top-N lete hain (apne hi scale ke andar), aur asli
      // faisla aage reranker par chhodte hain — wahi ekmatra bharosemand,
      // aapas mein tulne-layak score deta hai.
      // FUNNEL CHAUDA (2026-08-06) — kota 10/6/6 = ~22 tha, ab 45/20/20 = ~85.
      //
      // Jad: reranker hi ekmatra bharosemand judge hai (gap +0.8878 vs cosine
      // ka +0.0059), par wo sirf UNHI par lag sakta hai jo use diye jaayein.
      // Purane kote mein wo 32,032 chunks mein se 20 dekhta tha — 0.06%.
      // Sahi ansh agar cosine ke top-12 mein nahi aaya to wo hamesha ke liye
      // gaayab tha. Yahi "kabhi-kabhi galat granth aata hai" ki asli jad hai —
      // corpus mein kami NAHI hai (36 jeevan-vishayon par 300 se 61,000 tak
      // hits, 20-24 kitaabon mein faile hue), dhoondhne ka jaal chhota tha.
      //
      // rerankPassages ab 20-20 ke parallel batch bhejta hai, isliye 85
      // candidates ka samay lagbhag 20 jitna hi hai.
      const SRC_QUOTA = [[semResults, 45], [kwResults, 20], [crossFlat, 20]];
      const byId = new Map();
      for (const [arr, k] of SRC_QUOTA) {
        const sortedSrc = [...arr].sort((a, b) => b.score - a.score).slice(0, k);
        for (const r of sortedSrc) if (!byId.has(r.chunk.id)) byId.set(r.chunk.id, r);
      }

      // 3.5 Agar user ne kisi book ka naam liya hai, USI book ke passages pehle
      // (2026-07-25: hint list ab src/knowledge/bookHints.js mein hai — apne
      // aap ek testable pure function, App.jsx ke bahar unit-test ho sakta hai)
      const hintedBook = detectHintedBook(query);

      // 3.6 AUTOPSY FIX (2026-07-24): "Atharvaveda ka modern use kya hai?"
      // jaise sawaal 0 candidate laate the — keyword-search sirf Devanagari
      // substring match karta hai, aur "Atharvaveda" jaisa Roman naam kisi
      // Devanagari chunk mein literally kabhi nahi milta (TRANSLIT dict mein
      // ab in Veda/Purana naamon ki entry jod di gayi hai, par phir bhi
      // CONCEPTUAL/paraphrased sawaal (jaise "modern use") us granth ke
      // shabdon se seedha match nahi karega). Isliye jab user ne khud granth
      // ka naam liya ho (hintedBook), us granth se REAL ansh milna GUARANTEE
      // karo — pehle usi granth ke andar keyword-search try karo, phir bhi
      // kam mile toh granth ka ek spread (shuru/beech/ant) le lo. Isse AI
      // kabhi "koi ullekh nahi mila" bol kar anjaan books cite nahi karega —
      // hamesha us granth ka असली text milega jawab dene ke liye.
      if (hintedBook) {
        const already = [...byId.values()].filter(r => r.chunk.book === hintedBook).length;
        if (already < 3) {
          const withinBook = hybridSearch(searchQ, null, { book: hintedBook }, 6);
          for (const r of withinBook) {
            const existing = byId.get(r.chunk.id);
            if (!existing || r.score > existing.score) byId.set(r.chunk.id, r);
          }
          const nowHave = [...byId.values()].filter(r => r.chunk.book === hintedBook).length;
          if (nowHave < 3) {
            const allBookChunks = (getBookChunks(hintedBook) || [])
              .filter(c => (c.text || "").trim().length > 60);
            const step = Math.max(1, Math.floor(allBookChunks.length / 6));
            for (let i = 0; i < allBookChunks.length; i += step) {
              const c = allBookChunks[i];
              if (!byId.has(c.id)) byId.set(c.id, { chunk: c, score: 0.05, match_type: "book-overview" });
            }
          }
        }
      }

      // 4. Candidates saaf karo aur rerank ke liye taiyaar karo.
      //    (Purana `const sorted = ...` block yahan se hata diya — ab yehi
      //    kaam neeche `cleaned` karta hai, ek hi jagah.)
      // VIVIDHTA-CAP (user complaint: "har jawab same book se aata hai" —
      // dobara cross-check ke baad aur sakht kiya gaya): ek book ke max 2
      // ansh, ab top-8 mein se — kam se kam 4 alag granth aayenge, taaki
      // GENERIC (bina naam liye) sawaalon mein zyada vividhta rahe.
      //
      // BUG FIX (2026-07-24): jab user khud kisi granth ka naam le (e.g.
      // "Mantra Maha Sagar se mantra bataiye"), purana cap (3 vs 2) tha —
      // 8 mein se sirf 3 hinted-book se, baaki 5 alag-alag anjaan granthon
      // se — AI ka jawab un anjaan granthon ko bhi "Aadhaar" mein cite kar
      // deta tha (galat/bharamak). Ab hinted-book ka cap bahut dheela (6)
      // — woh hi granth zyaadatar context bharega; doosre books sirf tab
      // aayenge jab hinted-book ke paas khud itne matching ansh na hoon.
      // SCORE-AWARE DIVERSITY FLOOR (2026-07-26 fix): purana cap sirf "max 2
      // per book, top-8 tak bharo" tha — bhale hi 3rd/4th book ka score bahut
      // kamzor/anrelevant ho, phir bhi 8 tak pahunchne ke liye force-include
      // ho jaata tha. Isi wajah se ek badi, broad-topic wali kitaab (jaise
      // Guru Granth Sahib) almost HAR generic sawaal ke Aadhaar mein aa jaati
      // thi, chahe topic se seedha lena-dena na ho — semantic search sahi
      // passage dhoondh leta hai, par yeh cap use bhi dilute kar deta tha.
      // Ab (sirf generic/non-hinted sawaalon ke liye): kam se kam 3 acche
      // (top-score) results mil chuke hon, uske baad koi bhi naya passage
      // jo top-score ke 35% se kamzor ho, use diversity ke liye zabardasti
      // shaamil mat karo — kam passages sahi, galat/anrelevant citation nahi.
      // (hintedBook wale case ko chhua nahi — uska apna guaranteed-grounding
      // logic hai, upar dekhen.)
      // AUDIT REWRITE (2026-08-03) — purana relevance-guard yahan tha:
      //     const MIN_RELATIVE_SCORE = 0.35;
      //     if (!hintedBook && diverse.length >= 3 && r.score < topScore * 0.35) continue;
      //
      // Usme DO buniyadi kharabiyan thi:
      //
      // (a) Threshold RELATIVE tha. Cutoff = topScore x 0.35. Agar sabse
      //     accha match hi kachra ho (0.12), toh cutoff 0.042 ban jaata
      //     aur sab paar kar jaate. Aisa guard vividhta control kar sakta
      //     hai, PRASANGIKTA kabhi nahi — theek us waqt andha hota hai jab
      //     poora result-set hi bekaar ho.
      //
      // (b) `diverse.length >= 3` — pehle 3 passages ko koi jaanch hi nahi.
      //     ISI wajah se HAR jawab ke saath granth cite hote the, chahe
      //     sawaal ka unse koi lena-dena ho ya na ho. "OCR me error ho to
      //     AI kya kare" par bhi Valmiki Ramayana aa jaati thi.
      //
      // Ab: candidates bante hain (vividhta ke saath), phir CROSS-ENCODER
      // RERANKER faisla karta hai ki koi passage sach mein jawab deta hai
      // ya nahi. Naapa hua farak:
      //     cosine     sahi-min 0.4941  kachra-max 0.4882  gap +0.0059
      //     reranker   sahi-min 0.9009  kachra-max 0.0131  gap +0.8878
      //
      // Reranker score bimodal hai — ya 0.90+, ya lagbhag 0 — isliye 0.5
      // par dono taraf 0.44 ka margin milta hai.
      // BUG FIX (2026-08-03, user ne pakda): pehle per-book cap YAHAN,
      // rerank se PEHLE lagta tha. Nateeja — "मृत्यु के बाद आत्मा का क्या
      // होता है" par Garuda Purana ke chunks cosine list mein rank 2, 4, 5,
      // 6, 7... par the. Cap=2 sirf rank 2 aur 4 rakhta tha, aur rank 6
      // wala — jiska rerank score 0.9406 tha, poore corpus mein doosra
      // sabse achha — chhant jaata tha. Jawab mein sirf कठोपनिषद् aata tha,
      // jabki Garuda Purana hi mrityu-ke-baad ka asli granth hai.
      //
      // Jad: cap ka faisla us mile-jule score par ho raha tha jo keyword
      // aur cosine ko aapas mein tolta hai (alag paimane). Bharosemand
      // score reranker ke baad milta hai — isliye ab kram ULTA hai:
      // pehle rerank, phir diversity.
      const cleaned = [...byId.values()]
        .map(r => ({ ...r, chunk: { ...r.chunk, text: cleanOcrText(r.chunk.text || "") } }))
        .filter(r => r.chunk.text.trim().length > 40)   // pure OCR junk hatao
        .sort((a, b) => {
          if (hintedBook) {
            const ab = a.chunk.book === hintedBook, bb = b.chunk.book === hintedBook;
            if (ab !== bb) return ab ? -1 : 1;
          }
          return b.score - a.score;
        })
        .slice(0, RERANK_MAX_TOTAL);   // rerankPassages ise 20-20 ke batch mein baantega

      if (!cleaned.length) { setSacredChunks([]); return []; }

      // ── RELEVANCE GATE ────────────────────────────────────────────────
      const scores = await rerankPassages(searchQ, cleaned.map(r => r.chunk.text.slice(0, 1200)));

      let kept;
      if (scores) {
        const passed = cleaned
          .map((r, i) => ({ ...r, rerank: scores[i] ?? 0 }))
          .filter(r => r.rerank >= MIN_RERANK_SCORE)
          .sort((a, b) => b.rerank - a.rerank);

        // AB diversity — reranker ke bharosemand score ke kram par.
        // Ek granth ke max 3 ansh, taaki ek hi kitaab poora context na
        // bhar de, par sabse achha ansh kabhi na chhoote.
        const perBook = new Map();
        kept = [];
        for (const r of passed) {
          const c = perBook.get(r.chunk.book) || 0;
          if (c >= 3) continue;
          perBook.set(r.chunk.book, c + 1);
          kept.push(r);
        }
        if (!kept.length) {
          // Yeh SAFALTA hai, vifalta nahi — user ka apna niyam:
          // "agar 1% bhi jawab nahi mila toh saada jawab dena, source ke
          //  bina bhi chalega". Khaali lautne se AI ko koi granth nahi
          //  milta aur useChat.js koi Aadhaar footer nahi lagata.
          console.log(`[Retrieval] koi prasangik ansh nahi mila (best rerank ${Math.max(...scores).toFixed(3)}) — bina granth ke jawab`);
          setSacredChunks([]);
          return [];
        }
      } else {
        // Rerank fail (network/AI down) — passages istemal karo par
        // grounded MAT maano, taaki citation na lage. Kam bharosa theek
        // hai; galat bharosa nahi.
        kept = cleaned.slice(0, 6).map(r => ({ ...r, rerank: null }));
      }

      // ── PADOSI ANSH (2026-08-04) — chunk ki seema par kata jawab ─────
      //
      // ASLI GHATNA: "सूर्य के 12 नमस्कार" par nitya_karm_pooja p.125 mila,
      // jisme likha tha "सूर्यके बारह नामोंके द्वारा होनेवाले बारह..." —
      // aur wahin chunk KHATAM ho gaya. Baarah naam agle chunk (p.126)
      // mein the. Model ke paas bhoomika thi, naam nahi — usne apni yaad
      // se list bhar di aur 12 mein se 5 naam GALAT nikle (12 आदित्य ki
      // alag list ghusa di).
      //
      // Yeh RAG ki jaani-mani samasya hai: jawab do chunks ke beech kat
      // jaata hai. Standard ilaaj — jo ansh gate paar kare, uska AGLA
      // ansh bhi saath bhejo. Sirf top-3 ke liye, taaki prompt na phoole.
      //
      // Padosi ko bhi grounded maante hain: woh usi passage ka agla hissa
      // hai jise reranker ne pass kiya, aur uski kitaab pehle se cite ho
      // rahi hai.
      try {
        const already = new Set(kept.map(r => r.chunk.id));
        const withNeighbours = [];
        let added = 0;
        for (let n = 0; n < kept.length; n++) {
          const r = kept[n];
          withNeighbours.push(r);
          if (n >= 3) continue;                       // sirf top-3 ke padosi
          const all = getBookChunks(r.chunk.book) || [];
          const idx = all.findIndex(c => c.id === r.chunk.id);
          if (idx < 0) continue;
          // DONO taraf dekho — pichla AUR agla.
          //
          // KYUN (2026-08-04, asli ghatna): "कृत्तिका नक्षत्र में जन्मे जातक"
          // par rashi_muhurt_vigyan ka idx-13 wala ansh mila (rerank 0.78).
          // Par jawab idx-12 mein tha — TURANT PEHLE wale ansh mein. Woh
          // ansh search ko dikhta hi nahi kyunki OCR ne uske shirshak
          // "कृत्तिका" ko "Gitar" padh liya hai. Sirf agla ansh uthate toh
          // idx-14 (वृषभ राशि) milta — bilkul bekaar.
          //
          // Yeh OCR ki galti ka sasta ilaaj bhi hai: jab kisi ansh ka
          // vishay-shabd bigda ho, uska padosi aksar saaf hota hai — aur
          // padosi ke rastey woh ansh wapas mil jaata hai.
          for (const off of [-1, 1]) {
            const nb = all[idx + off];
            if (!nb || already.has(nb.id) || (nb.text || "").trim().length <= 40) continue;
            already.add(nb.id);
            // Padosi ko TURANT uske mool ansh ke saath rakho — model dono ko
            // ek hi behaav mein padhe.
            withNeighbours.push({
              chunk: { ...nb, text: cleanOcrText(nb.text || "") },
              score: r.score, rerank: r.rerank, match_type: "neighbour",
            });
            added++;
          }
        }
        if (added) {
          console.log(`[Retrieval] ${added} padosi ansh jode (chunk-seema par kata jawab bachane ke liye)`);
          kept = withNeighbours;
        }
      } catch { /* padosi na mile toh koi baat nahi — mool ansh kaafi hain */ }

      // PRAMAAN-FIX: top-3 ansh MOTE (800) taaki AI seedha uddharan de sake,
      // baaki patle (300) — kul tokens lagbhag wahi (TPM surakshit)
      // NAAPA HUA (2026-08-04): padosi ansh ko 300 chars par kaatna use
      // bekaar kar deta hai. nitya_karm_pooja p.126 mein "मित्राय" 383ve
      // aur "भास्कराय" 624ve akshar par hai — 300 par kaato toh 12 naamon
      // mein se EK bhi nahi dikhta, aur model phir se yaad se bhar deta
      // hai. Padosi maujood hi isliye hai ki kata hua hissa poora ho —
      // isliye use hamesha poora slice do.
      // Ansh AI ko jaate hain, par CITATION sirf unhi par jinme asli vaakya
      // hain — table/suchi/mukhprishth kabhi "aadhaar" nahi banenge.
      const merged = kept.slice(0, 12).map((r, i) => ({
        ...r,
        grounded: r.rerank != null && r.rerank >= MIN_RERANK_SCORE
                  && hasSentences(r.chunk.text) && !looksGarbled(r.chunk.text),
        chunk: {
          ...r.chunk,
          text: r.chunk.text.slice(0, (i < 3 || r.match_type === "neighbour") ? 800 : 300),
        },
      }));

      // DIAGNOSTIC (2026-08-03): retrieval ka poora hisaab ek line mein —
      // kitne candidates aaye, kitne gate paar kiye, kaun se granth, aur
      // grounded flag sach mein laga ya nahi.
      console.log(`[Retrieval] candidates=${cleaned.length} → gate-paar=${kept.length} → bheje=${merged.length}`
        + ` | grounded=${merged.filter(m => m.grounded).length}`
        + ` | granth: ${[...new Set(merged.map(m => m.chunk.book))].join(", ") || "koi nahi"}`
        + (scores ? ` | best-rerank=${Math.max(...scores).toFixed(3)}` : " | RERANK FAIL"));

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
      return [];
    }
  }, [knowledgeReady, crossBookSearch, hybridSearch, getBookChunks]);

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

