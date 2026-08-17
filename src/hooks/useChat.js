/**
 * SAARTHI — useChat Hook v2
 *
 * Improvements:
 * - Hard debounce: ignores calls while one is in-flight (ref-based, no stale closure)
 * - Rate-limit auto-fallback: on retryable error → silently serves fallback response
 *   with a small indicator instead of a hard error bubble
 * - Countdown timer: when rate-limited, shows seconds remaining in typing indicator
 * - Loading phases: "thinking" → "writing" → done  (richer UX)
 * - Retry restores clean state before re-sending
 * - Last user message ref prevents duplicate sends from double-tap / React StrictMode
 */

import { useState, useCallback, useRef, useEffect } from "react";
// Fix 4 (2026-08-03) — model ke jawab se Cyrillic corruption saaf karne ke liye
import { stripCyrillic } from "@/knowledge/translit";
// 2026-08-04 — gadhe hue uddharan aur jhoothi citation pakadne ke liye
import { verifyAnswer } from "@/services/verifyAnswer";
import { BOOK_META } from "@/data/bookMeta";

// ── Chat history persistence ──────────────────────────────────────────────────
const STORAGE_KEY = "saarthi_chat_history";
const MAX_STORED  = 60; // keep last 60 messages to cap storage usage

// Home page ke global Hindi/English toggle ka nirnay — offline/kota-exhausted
// fallback messages (jo AI ke bina hi seedha yahan bante hain) bhi isी ke
// anusaar dikhayein, warna toggle English hone par bhi yeh Hinglish mein
// aate the.
// item #15: signed-in user ka pehla naam — Ask ke jawab mein "Naam ji" se
// sambodhit karne ke liye gemini.js ko bhejte hain. AuthContext.jsx ka
// SAARTHI_USER_PROFILE localStorage yahan seedha padha jaata hai (context ke
// bina — yeh hook ek plain hook hai, App-tree ke bahar se bhi bulaya jaata hai).
function getUserName() {
  try {
    const raw = localStorage.getItem("SAARTHI_USER_PROFILE");
    if (!raw) return "";
    const p = JSON.parse(raw);
    return (p?.name || "").trim().split(/\s+/)[0] || "";
  } catch { return ""; }
}

function getUiLang() {
  try {
    const v = localStorage.getItem("SAARTHI_UI_LANG");
    return v === "en" ? "en" : "hi";
  } catch {
    return "hi";
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    // Purani versions numeric ids (1001, 1002...) save karti thin — duplicates
    // se React "duplicate key" warning aati hai. Restore par ids sanitize karo:
    // khaali/duplicate id ko naya collision-proof id de do.
    const seen = new Set();
    return parsed.map(m => {
      let id = m && m.id != null ? String(m.id) : "";
      if (!id || seen.has(id)) id = uid();
      seen.add(id);
      return { ...m, id };
    });
  } catch { return null; }
}

function saveHistory(messages) {
  try {
    // Never save error or loading messages; cap at MAX_STORED
    const clean = messages
      .filter(m => !m.error && m.content)
      .slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {}
}
import {
  sendMessage, askAboutPDF,
  hasApiKey, getErrorMessage, GeminiError,
  lastAnswerModel,
  isHealthQuery,          // swasthya chetavani code se lagane ke liye
} from "@/services/gemini";
import { getFallbackResponse } from "@/services/fallback";
import { isOwnerEmail } from "@/services/tier";

// item #12 (owner demo): Saurabh apne hi Google account se sign-in kare toh
// saari free-limits hat jaati hain (presentation ke liye "paid experience").
// Baaki users par koi asar nahi — abhi tak real payment na hone tak sirf
// yeh ek email hi "paid" maana jaata hai (tier.js dekhein).
function isOwnerLocal() {
  try {
    const raw = localStorage.getItem("SAARTHI_USER_PROFILE");
    if (!raw) return false;
    const p = JSON.parse(raw);
    return isOwnerEmail(p?.email);
  } catch { return false; }
}

// ─── ID GENERATOR ─────────────────────────────────────────────────────────────
// Start above any restored message IDs to prevent React key collisions.
// Restored messages may have ids 1..60; start at 1000 so new ids never clash.
let _id = 1000;
// Collision-proof ids: the old in-memory counter reset on every page load,
// so restored-from-localStorage messages collided with new ones (React
// "duplicate key 1003" warning + risk of dropped messages).
const uid = () => `m${Date.now().toString(36)}_${(++_id).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ── KAVACH 1: Din ka AI-kota (shared free quota ko 25 users mein bachane ke liye) ──
// Ask + PDF ke AI-sawaal ginta hai. Books/Search/Amrit/Audio par KOI limit nahi
// (woh AI use hi nahi karte). Apni key daalne wale user par bhi koi limit nahi.
const AI_DAILY_LIMIT = 5;   // D-mode: kam sawaal, par har jawab 70b pakka-sateek
const _quotaToday = () => new Date().toISOString().slice(0, 10);
function aiQuotaLeft() {
  try {
    if (localStorage.getItem("SAARTHI_RUNTIME_KEY")) return Infinity; // apni key = apna quota
    if (isOwnerLocal()) return Infinity; // owner demo (#12) = unlimited
    const q = JSON.parse(localStorage.getItem("SAARTHI_AI_QUOTA") || "{}");
    if (q.date !== _quotaToday()) return AI_DAILY_LIMIT;
    return Math.max(0, AI_DAILY_LIMIT - (q.used || 0));
  } catch { return AI_DAILY_LIMIT; }
}
function aiQuotaUse() {
  try {
    if (localStorage.getItem("SAARTHI_RUNTIME_KEY")) return Infinity;
    if (isOwnerLocal()) return Infinity;
    const q = JSON.parse(localStorage.getItem("SAARTHI_AI_QUOTA") || "{}");
    const used = (q.date === _quotaToday() ? (q.used || 0) : 0) + 1;
    localStorage.setItem("SAARTHI_AI_QUOTA", JSON.stringify({ date: _quotaToday(), used }));
    return Math.max(0, AI_DAILY_LIMIT - used);
  } catch { return AI_DAILY_LIMIT; }
}

// ─── TIME HELPER ──────────────────────────────────────────────────────────────

const timeNow = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// ─── HOOK ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {"chat"|"pdf"|"spiritual"} opts.mode
 * @param {string|null} opts.pdfText
 * @param {string|null} opts.pdfName
 * @param {string|null} opts.subject
 * @param {string|null} opts.welcomeMessage
 */
export function useChat({
  mode            = "chat",
  pdfText         = null,
  pdfName         = null,
  subject         = null,
  welcomeMessage  = null,
  sacredChunks    = null,   // SearchResult[] from engine.js — injected by callers that do retrieval
} = {}) {

  // ── Welcome message ──────────────────────────────────────────────────────
  const welcome = welcomeMessage || buildWelcome(mode, pdfName);

  // ── State ────────────────────────────────────────────────────────────────
  // Restore chat history from localStorage (chat mode only — not PDF/spiritual)
  const [messages, setMessages] = useState(() => {
    if (mode === "chat") {
      const stored = loadHistory();
      if (stored && stored.length > 1) return stored; // has real conversation
    }
    return [firstMsg(welcome)];
  });
  const [loadPhase,   setLoadPhase]   = useState(null);
  // null | "thinking" | "writing" | "retrying" | "fallback"
  const [apiStatus,   setApiStatus]   = useState(hasApiKey() ? "ready" : "demo");
  // "ready" | "demo" | "rate_limited" | "error"
  const [countdown,   setCountdown]   = useState(0);

  // ── Refs (immune to stale closures) ──────────────────────────────────────
  // Seed historyRef from restored messages so AI has memory after page refresh.
  // Only include user/ai messages (not system/error), matching what Gemini expects.
  const historyRef    = useRef(
    messages
      .filter(m => (m.role === "user" || m.role === "ai") && m.content && !m.error)
      .map(m => ({ role: m.role, content: m.content }))
  );
  const inFlightRef   = useRef(false);       // hard lock — one request at a time
  const lastMsgRef    = useRef("");          // dedup: ignore identical rapid sends
  const countdownRef  = useRef(null);        // setInterval handle

  // Cleanup countdown timer on unmount
  useEffect(() => () => clearInterval(countdownRef.current), []);

  // BUG FIX (audit): naya PDF upload hone par purani chat wahi rehti thi —
  // header mein naya naam, chat mein purane PDF ka welcome/jawab (mismatch).
  // Jab welcome badle (= naya pdfName), chat poori reset karo.
  const welcomeRef = useRef(welcome);
  useEffect(() => {
    if (welcomeRef.current !== welcome) {
      welcomeRef.current  = welcome;
      historyRef.current  = [];
      lastMsgRef.current  = "";
      inFlightRef.current = false;
      setMessages([firstMsg(welcome)]);
      setLoadPhase(null);
    }
  }, [welcome]);

  // Persist chat history on every message change (chat mode only)
  useEffect(() => {
    if (mode === "chat" && messages.length > 1) {
      saveHistory(messages);
    }
  }, [messages, mode]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pushMsg = useCallback((role, content, extra = {}) => {
    const msg = { id: uid(), role, content, time: timeNow(), error: false, ...extra };
    setMessages(prev => [...prev, msg]);
    // Only persist non-system messages to AI history
    if (role === "user" || role === "ai") {
      historyRef.current = [...historyRef.current, msg];
    }
    return msg;
  }, []);

  const startCountdown = useCallback((seconds) => {
    setCountdown(seconds);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Main send ─────────────────────────────────────────────────────────────

  const sendUserMessage = useCallback(async (rawText, chunksOverride) => {
    // chunksOverride: freshly-retrieved passages for THIS question.
    // (State-based sacredChunks lags one render behind — that race sent the
    // PREVIOUS question's passages, so answers were grounded in the wrong book.)
    const liveChunks = (chunksOverride !== undefined) ? chunksOverride : sacredChunks;
    const text = rawText.trim();
    if (!text)                    return;   // empty
    if (inFlightRef.current)      return;   // already waiting — hard block
    if (text === lastMsgRef.current && Date.now() - (lastMsgRef._ts || 0) < 1000) return; // dedup

    inFlightRef.current = true;
    lastMsgRef.current  = text;
    lastMsgRef._ts      = Date.now();

    // Add user message immediately for instant visual feedback
    pushMsg("user", text);
    setLoadPhase("thinking");

    try {
      let responseText;
      let quotaLeftNow = Infinity;   // KAVACH 1: safal AI-jawab ke baad bacha kota

      if (!hasApiKey()) {
        // ── Demo mode ──────────────────────────────────────────────────────
        setApiStatus("demo");
        await fakeDelay(700, 1300);
        setLoadPhase("writing");
        await fakeDelay(300, 600);
        responseText = getFallbackResponse(text);

      } else if (aiQuotaLeft() <= 0) {
        // ── KAVACH 1: Aaj ka free AI-kota poora ──────────────────────────
        await fakeDelay(400, 700);
        responseText = getUiLang() === "en"
          ? "🙏 **Today's free wisdom quota (5 AI questions) is used up.**\n\n" +
            "But don't stop here — all of this stays **unlimited**:\n" +
            "- 📖 Read all 24 scriptures (original pages included)\n" +
            "- 🔍 Search in Sacred Search\n" +
            "- 🕉️ Listen to Today's Amrit\n\n" +
            "You'll get **5 fresh AI questions tomorrow morning**. Take care! 🌅"
          : "🙏 **आज का मुफ़्त ज्ञान-कोटा (5 AI-सवाल) पूरा हो गया।**\n\n" +
            "लेकिन रुकिए मत — यह सब **असीमित** है:\n" +
            "- 📖 24 ग्रंथ पढ़ना (असली पन्नों सहित)\n" +
            "- 🔍 पवित्र खोज में खोजना\n" +
            "- 🕉️ आज का अमृत सुनना\n\n" +
            "AI-सवाल **कल सुबह फिर 5** मिलेंगे। शुभ हो! 🌅";
        pushMsg("ai", responseText, { fallback: true });
        return;

      } else {
        // ── Real AI ────────────────────────────────────────────────────────
        setApiStatus("ready");

        const userName = mode === "chat" ? getUserName() : ""; // #15: sirf Ask mein "Naam ji"
        const ctx = {
          mode,
          ...(pdfText      ? { pdfText }      : {}),
          ...(subject      ? { subject }       : {}),
          ...(userName     ? { userName }      : {}),
          ...(liveChunks && liveChunks.length > 0 ? { sacredChunks: liveChunks } : {}),
        };

        try {
          setLoadPhase("thinking");
          // Small natural pause before "thinking" appears
          await fakeDelay(200, 400);

          responseText = await (mode === "pdf" && pdfText
            ? askAboutPDF(text, pdfText, (historyRef.current || []).slice(-3))
            : sendMessage(text, (historyRef.current || []).slice(-4), ctx));

          quotaLeftNow = aiQuotaUse();   // KAVACH 1: safal jawab = 1 kota kharcha

          setLoadPhase("writing");
          // Brief pause so UI doesn't snap — feels more natural
          await fakeDelay(120, 280);

        } catch (apiErr) {
          // ITEM #2 (server-side quota): Worker ne apna KV-backed daily-kota
          // check karke reject kiya (localStorage bypass ke bawajood bhi) —
          // yehi wahi friendly message hai jo pehle sirf local aiQuotaLeft()
          // check dikhata tha. Retry/backoff bekaar hai (agle IST-din tak
          // nahi badlega), isliye alag, seedha branch.
          if (apiErr instanceof GeminiError && apiErr.code === "QUOTA_EXCEEDED") {
            await fakeDelay(300, 500);
            responseText = getUiLang() === "en"
              ? "🙏 **Today's free wisdom quota (5 AI questions) is used up.**\n\n" +
                "But don't stop here — all of this stays **unlimited**:\n" +
                "- 📖 Read all 24 scriptures (original pages included)\n" +
                "- 🔍 Search in Sacred Search\n" +
                "- 🕉️ Listen to Today's Amrit\n\n" +
                "You'll get **5 fresh AI questions tomorrow morning**. Take care! 🌅"
              : "🙏 **आज का मुफ़्त ज्ञान-कोटा (5 AI-सवाल) पूरा हो गया।**\n\n" +
                "लेकिन रुकिए मत — यह सब **असीमित** है:\n" +
                "- 📖 24 ग्रंथ पढ़ना (असली पन्नों सहित)\n" +
                "- 🔍 पवित्र खोज में खोजना\n" +
                "- 🕉️ आज का अमृत सुनना\n\n" +
                "AI-सवाल **कल सुबह फिर 5** मिलेंगे। शुभ हो! 🌅";
            pushMsg("ai", responseText, { fallback: true });
            return;
          }
          if (apiErr instanceof GeminiError && apiErr.retryable) {
            // ── Soft failure → auto fallback ──────────────────────────────
            // We got rate-limited or a transient error.
            // Serve a fallback response silently instead of showing an error.
            const isRateLimit = apiErr.status === 429 || apiErr.code === "RATE_LIMITED";

            if (isRateLimit) {
              setApiStatus("rate_limited");
              setLoadPhase("retrying");
              startCountdown(8); // visual countdown while we "process"
              await fakeDelay(2000, 3000);
            } else {
              setLoadPhase("fallback");
              await fakeDelay(600, 900);
            }

            // Key maujood hai lekin limit/network fail — NAKLI jawab kabhi nahi,
            // seedha sach batao. (Nakli-guru template sirf bina-key demo ke liye.)
            responseText = hasApiKey()
              ? (getUiLang() === "en"
                  ? "🙏 **Saarthi is in deep reflection right now** — please ask again in a minute or two.\n\nMeanwhile, all of this stays **unlimited**: 📖 reading scriptures · 🔍 searching · 🕉️ listening to Amrit.\n\n(If this keeps showing all day, today's quota is used up — see you tomorrow morning 🌅)\n\n*This question was not counted against your quota.*"
                  : "🙏 **सारथी अभी ध्यान-मग्न हैं** — कृपया थोड़ी देर (1-2 मिनट) बाद फिर पूछें।\n\nतब तक यह सब **असीमित** है: 📖 ग्रंथ पढ़ना · 🔍 खोजना · 🕉️ अमृत सुनना।\n\n(दिन भर ऐसा ही दिखे तो आज का समय पूरा हुआ — कल सुबह फिर मिलेंगे 🌅)\n\n*आपका सवाल कोटा में नहीं गिना गया।*")
              : getFallbackResponse(text);

            // Tag the message so UI can show the subtle fallback badge
            pushMsg("ai", responseText, { fallback: true });
            return; // early return — already pushed

          } else {
            // ── Hard failure → show error bubble ──────────────────────────
            const isAuth = apiErr.code === "AUTH_ERROR" || apiErr.status === 400 || apiErr.status === 403;
            setApiStatus(isAuth ? "error" : "rate_limited");
            pushMsg("ai", getErrorMessage(apiErr, false), { error: true });
            return;
          }
        }
      }

      // ── Success ───────────────────────────────────────────────────────────
      // 📚 Sources footer: batao kaunse passages ne is jawab ko aadhaar diya.
      // Transparency + retrieval fail hone pe turant pakda jayega.
      // 📚 PDF mode: jawab ka aadhaar = uploaded document
      if (responseText && mode === "pdf" && pdfName && !responseText.includes("📚 Aadhaar")) {
        responseText += `\n\n---\n📚 *Aadhaar: ${pdfName}*`;
      }
      // FIX 4 (2026-08-03): Cyrillic corruption saaf karo — "नарам" → "नरम".
      // Groq ke degraded output ki nishani. Kitni baar hua, log karo taaki
      // pata rahe ki model kitna kharab chal raha hai.
      if (responseText) {
        const { text: cleanTxt, fixed } = stripCyrillic(responseText);
        if (fixed) {
          console.warn(`[Sanitize] ${fixed} Cyrillic akshar theek kiye — model degraded output de raha hai`);
          responseText = cleanTxt;
        }
      }
      // Model ne agar khud footer nakal kiya ho toh pehle use hatao
      if (responseText) responseText = responseText
        .replace(/\n*-{2,}\n*📚[^\n]*/g, "")
        .replace(/\n*📚\s*\*?Aadhaar[^\n]*/gi, "")
        // Model kabhi bina-📚 wala nakli "*Aadhaar: ..." footer bana deta hai — use bhi hatao
        .replace(/\n+[*_]{0,2}\s*Aadhaar\s*:[^\n]*/gi, "")
        // AUDIT FIX (2026-08-01): upar wale dono sirf LATIN "Aadhaar" pakadte
        // the. Model bahut baar DEVANAGARI mein likhta hai — "आधार:" (aur
        // galat hijje "आदार:"). Woh bach jaati thi, isliye ek hi jawab mein
        // DO alag-alag source-lists dikhti thi, jo aapas mein match bhi
        // nahi karti thi. Asli mein dekha gaya:
        //     आधार: गीता, उपनिषद, और अन्य आध्यात्मिक ग्रंथ।
        //     📚 Aadhaar: Valmiki Ramayana · Yajurveda · Samaveda
        // App ka apna footer hi ekmatra sach hai — model ka apna hataao.
        .replace(/\n+[*_]{0,2}\s*(आधार|आदार|आधार-ग्रंथ|स्रोत)\s*[:：][^\n]*/g, "")
        // GURU-GARIMA FILTER: 8b model prompt ke bawajood "Arre bhai/yaar" bol
        // deta hai — code se hatao, model koi bhi ho. (Guru aisa nahi bolta.)
        .replace(/\b[Aa]rre\s+(bhai|yaar|dost)\b[,!]?\s*/g, "")
        .replace(/^(bhai|yaar)[,!]\s*/gim, "")
        // Beech-vakya wala "Aur, bhai, ..." / "Toh, bhai, ..." bhi pakdo
        .replace(/,\s*(bhai|yaar)\s*,/gi, ",")
        .replace(/\b(Aur|Toh|To|Lekin|Par)\s+(bhai|yaar)\s+/gi, "$1 ");
      // 8b REPEAT-FILTER: chhota model kabhi ek hi baat 3-4 baar likh deta hai
      // (numbering badal kar bhi). Lambi duplicate lines code se hi hata do.
      if (responseText) {
        const seen = [];
        responseText = responseText.split("\n").filter(line => {
          const norm = line.replace(/^\s*[\d•*\-]+[.)]?\s*/, "").trim().toLowerCase();
          if (norm.length < 30) return true;                       // chhoti lines chhodo
          if (seen.length && seen[seen.length - 1] === norm) return false; // lagataar same
          if (norm.length > 45 && seen.includes(norm)) return false;       // kahin bhi same
          seen.push(norm);
          return true;
        }).join("\n");
      }
      // FIX (2026-07-24): jab model khud saaf keh de "in granthon mein iska
      // seedha zikr/shlok nahi mila, isliye samanya gyaan se bata raha hoon"
      // (ya English mein waisa hi), tab retrieved passages asal mein jawab
      // ka aadhaar NAHI the — unhe "📚 Aadhaar" footer mein dikhana galat
      // bharosa deta hai (jaise woh sach mein cite hue ho). Aisa disclaimer
      // dikhe toh footer mat lagao.
      const NO_GROUNDING_RE = /कोई सीधा (उल्लेख|संदर्भ|ज़िक्र|जिक्र)[^.।]{0,40}(नहीं मिला|नहीं मिलता)|श्लोक नहीं मिला|सामान्य (शास्त्र-?ज्ञान|ज्ञान) के आधार पर|इन उपलब्ध ग्रंथों[^.।]{0,40}नहीं मिला|no direct (reference|mention|verse)|couldn't find (any )?(direct|specific)|not (directly )?(mentioned|found) in (the )?(available|these) (scriptures|texts|books)|based on general (scriptural|shastra)? ?knowledge/i;
      const noGroundingDisclaimed = responseText && NO_GROUNDING_RE.test(responseText);
      // AUDIT FIX (2026-08-03) — Fix 2: footer SIRF sach ke aadhaar par.
      //
      // Pehle yeh footer tab lag jaata tha jab liveChunks maujood ho —
      // chahe woh passages jawab se juda hon ya na hon. Yaani app woh
      // pramaan dikha rahi thi jo uske paas tha hi nahi.
      //
      // Ab ChatView har passage par `grounded` lagata hai, jo cross-encoder
      // reranker ke faisle se aata hai (score >= 0.5). Reranker fail ho
      // jaye toh grounded=false rehta hai — passages phir bhi AI ko jaate
      // hain, par citation NAHI lagti. Kam bharosa theek hai; galat
      // bharosa nahi.
      const groundedChunks = (liveChunks || []).filter(c => c.grounded);

      // DIAGNOSTIC (2026-08-03): footer laga ya nahi, aur NAHI toh KYUN —
      // chaaron shart alag-alag dikhti hain. Audit ka sabak: chup-chaap
      // fail hone mat do, warna mahino pata nahi chalta.
      // ── JAWAB KI JAANCH (2026-08-04) — teesri parat ──────────────────
      // Asli ghatna: "jap vidhi bataye" par model ko sirf mantra_shakti
      // p.133 diya gaya tha, par usne likha:
      //     📜 "जपमान् यस्य मनस्सहितम्" — मन्त्र महासागर (पृष्ठ १४)
      // Woh shlok poore 23,425 chunks mein ek baar bhi nahi hai, aur
      // मन्त्र महासागर ka panna 14 index (vishayanukramanika) hai. Shlok,
      // granth aur panna — teeno gadhe gaye.
      //
      // SYSTEM_PROMPT mein yeh pehle se mana hai. Model ne phir bhi kiya.
      // Isliye ab jaanch CODE karta hai: har uddharan diye gaye passages
      // mein dhoondha jaata hai, aur har granth-naam grounded list se
      // milaya jaata hai. Na mile toh hata do.
      if (responseText && groundedChunks.length >= 0) {
        const bookNames = {};
        for (const [id, m] of Object.entries(BOOK_META)) {
          bookNames[id] = [m.title, m.en].filter(Boolean);
        }
        // chunk ke apne book_title bhi jodo (kabhi alag hote hain)
        for (const r of (liveChunks || [])) {
          const id = r?.chunk?.book, bt = r?.chunk?.book_title;
          if (id && bt && bookNames[id] && !bookNames[id].includes(bt)) bookNames[id].push(bt);
        }
        const v = verifyAnswer(responseText, groundedChunks, bookNames);
        if (v.removed.quotes || v.removed.citations) {
          console.warn(`[Verify] gadha hua hissa hataya — uddharan: ${v.removed.quotes}, citation: ${v.removed.citations}`);
          responseText = v.text;
        }
      }

      const _why = !responseText ? "koi jawab nahi"
        : groundedChunks.length === 0 ? `grounded=0 (kul chunks ${(liveChunks || []).length})`
        : responseText.includes("📚 Aadhaar") ? "model ne khud footer likh diya"
        : noGroundingDisclaimed ? "model ne 'ullekh nahi mila' kaha"
        : null;
      console.log(`[Aadhaar] ${_why ? "footer NAHI laga — " + _why : `footer lagega — ${groundedChunks.length} grounded chunks`}`);

      // ── ANDAR KE NIRDESH JAWAB SE HATAO (2026-08-11) ─────────────────
      //
      // ASLI GHATNA: har jawab ke ant mein user ko ye dikh raha tha —
      //     [REPLY LANGUAGE: shuddh saral HINDI (Devanagari)]
      // Ye tag gemini.js user-message ke ant mein jodta hai taaki model
      // sahi bhasha chune (languagePinned). SYSTEM_PROMPT mein saaf likha
      // hai ki ye SYSTEM ka nirdesh hai — par model use jawab mein likh
      // deta hai. Wahi purana sabak: prompt KEHTA hai, code NIBHATA hai.
      //
      // Yahan uske do roop pakadte hain: bracket wala tag, aur agar model
      // use bina bracket ke likh de.
      if (responseText) {
        const pehle = responseText;
        responseText = responseText
          .replace(/\n*\s*\[?\s*REPLY\s+LANGUAGE\s*:[^\]\n]*\]?\s*/gi, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (pehle !== responseText) console.log("[Aadhaar] andar ka [REPLY LANGUAGE] tag hataya");
      }

      // ── ADHOORI BHOOMIKA HATAO ───────────────────────────────────────
      //
      // verifyAnswer() gadha hua UDDHARAN hata deta hai — ye sahi kaam hai.
      // Par uski BHOOMIKA wali line reh jaati thi, aur jawab mein aisa
      // dikhta tha:
      //     "गीता के दूसरे अध्याय में भगवान श्रीकृष्ण कहते हैं:"   ← phir kuch nahi
      //     "यह श्लोक बताता है कि संस्कारों से…"                  ← koi shlok hi nahi
      // Jhoothi citation se kam gambhir hai, par user ko adhoora aur
      // laparwah dikhta hai.
      //
      // Ilaaj: agar jawab mein koi uddharan bacha hi nahi (📜 ya quote),
      // to uski taraf ishara karne wali line bhi hata do.
      if (responseText && !/📜|["""«»]/.test(responseText)) {
        const pehle = responseText;
        responseText = responseText
          .split("\n")
          .filter(line => {
            const t = line.trim();
            if (!t) return true;
            // "…कहते हैं:" / "…कहा गया है:" — bhoomika jiska uddharan gaya
            if (/(?:कहते\s*हैं|कहा\s*गया\s*है|likha\s*hai|कहा\s*है)\s*[:：]\s*$/.test(t)) return false;
            // "यह श्लोक बताता है…" / "इस श्लोक का अर्थ…" — jab shlok hai hi nahi
            if (/^(?:यह|इस|उपर्युक्त)\s*श्लोक/.test(t)) return false;
            return true;
          })
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (pehle !== responseText) console.log("[Aadhaar] adhoori bhoomika hatai (uddharan hat chuka tha)");
      }

      // PANNA HATAO — prompt kehta hai, CODE nibhata hai (2026-08-10).
      //
      // SYSTEM_PROMPT me "panna kabhi mat likho" saaf likha hai. Par is app
      // ka apna itihaas kehta hai ki model niyam todta hai — shloka gadhne
      // aur granth ka naam gadhne par bhi pehle yahi hua tha, aur dono baar
      // ilaaj code me lagana pada. Isliye yahan bhi wahi.
      //
      // Do roop pakadte hain: "(p.352)" / "(pp.12-14)" aur "(पृ. ३२)".
      // Space aur alag-alag brackets ke saath. Baaki text ko haath nahi
      // lagate — sirf ye tukda nikalta hai.
      if (responseText) {
        const before = responseText;
        responseText = responseText
          .replace(/\s*[（(\[]\s*(?:pp?\.?|page)\s*[\d०-९]+(?:\s*[-–,]\s*(?:p\.?\s*)?[\d०-९]+)*\s*[）)\]]/gi, "")
          .replace(/\s*[（(\[]\s*(?:पृ\.?|पृष्ठ|पन्ना)\s*[\d०-९]+(?:\s*[-–,]\s*[\d०-९]+)*\s*[）)\]]/g, "");
        if (before !== responseText) console.log("[Aadhaar] jawab me se panna-number hataye");
      }

      // "(Passage 4)" HATAO — hamara apna plumbing user tak pahunch raha tha
      // ------------------------------------------------------------------
      // 2026-08-17. Model ko ansh is roop me jaate hain:
      //     [1] Narasimha Purana
      //     <paath>
      // Wo "[1]" hamare liye hai, user ke liye nahi. Par model use jawab me
      // uddharan ki tarah likhne laga:
      //     "...vah sabhi paapon se mukt ho jata hai. (Passage 4)"
      //
      // User ke liye ye number ka koi matlab nahi — wo kahin dikhta hi nahi,
      // aur na hi jaancha ja sakta hai. Ye bilkul wahi kism hai jo panne ke
      // number ki thi (upar dekhein): jo pramaan jaancha na ja sake, wo
      // pramaan nahi — wo sirf bharosa todta hai.
      //
      // Ye 17 Aug ko tab dikha jab jawab lambe kiye gaye. Lamba jawab likhne
      // par model zyada uddharan dene lagta hai, aur wahin ye bahar aaya.
      //
      // ⚠️ Akela "[4]" JAAN-BOOJHKAR nahi hata rahe — wo asli paath me bhi
      //    ho sakta hai (shlok ki ginti, soochi). Sirf wo roop hata rahe hain
      //    jinme "passage" ya "ansh" shabd saath likha ho.
      if (responseText) {
        const before = responseText;
        responseText = responseText
          .replace(/\s*[（(\[]\s*(?:passages?|ansh|अंश|पैसेज)\s*[#:]?\s*[\d०-९]+(?:\s*[-–,]\s*[\d०-९]+)*\s*[）)\]]/gi, "")
          .replace(/\s*[（(\[]\s*(?:passages?|ansh|अंश)\s*[\d०-९]+\s*(?:aur|and|,)\s*[\d०-९]+\s*[）)\]]/gi, "");
        if (before !== responseText) console.log("[Aadhaar] jawab me se (Passage N) hataye");
      }

      if (responseText && groundedChunks.length > 0 && !responseText.includes("📚 Aadhaar") && !noGroundingDisclaimed) {
        // BUG FIX: pehle book+page se dedupe hota tha — "Agni Purana · Agni
        // Purana · Agni Purana" dikhta tha. Ab ek book EK baar, pages jud kar.
        // ── SIRF GRANTH KA NAAM — PANNA NAHI (2026-08-10) ───────────────
        //
        // Pehle "अग्नि पुराण (p.520, p.521)" jaisa dikhta tha. Ab sirf
        // "अग्नि पुराण". Teen wajah:
        //
        // 1. PANNA SAABIT NAHI HO SAKTA. Read section hat raha hai, yaani
        //    user us panne par ja hi nahi sakta. Jo pramaan jaancha na ja
        //    sake, wo pramaan nahi — sirf dikhawa hai.
        //
        // 2. PANNA HAMARE SANSKARAN KA HAI. "Garuda Purana p.520" ka matlab
        //    sirf HAMARI PDF me hai. Kisi aur sanskaran me wahi baat kisi
        //    aur panne par hogi. User agar apni kitab me dhoondhe to nahi
        //    milegi — aur bharosa toot jaayega.
        //
        // 3. OCR ke panne kabhi-kabhi khiske hue hain (scan me blank/dohre
        //    panne). Ek galat number poore jawab ko shak me daal deta hai.
        //
        // Granth ka naam hi asli pramaan hai — wo sthir hai, jaancha ja
        // sakta hai, aur Indian Copyright Act §52 ki "source acknowledgement"
        // ki maang bhi wahi poori karta hai.
        // ⚠️ SHABD-MEL WALA CHUNAV AAZMAYA AUR HATAYA — 2026-08-14
        //
        // Niyam #2 ("naam sirf usi granth ka jiska ansh sach me istemaal
        // hua") laagu karne ke liye src/knowledge/aadhaar.js banayi thi:
        // jawab aur ansh ke vishisht shabd milao, jinka mel na ho unhe
        // hata do; aur sabse ooncha score wala granth hamesha rakho.
        //
        // 12 unit-test hare the. Par wo test MAINE banaye the — yaani wo
        // sirf wahi pakadte the jo maine socha. 24_aadhaar_check.mjs ne
        // ASLI jawab par chalaya, aur 5 me se 4 ULTE nikle:
        //
        //   "Agni Puran ko encyclopedic kyun kaha jata hai?"
        //       AB: Rigveda        HATAYE: Agni Purana   ← sahi granth hi gaya
        //   "Gita mein indriyon aur mann ka relation"
        //       AB: Mahabharata    HATAYE: Bhagavad Gita ← jawab me NAAM likha tha
        //   "Bhavishya Puran mein marriage duties"
        //       AB: Rashi-Muhurt   HATAYE: Bhavishya Purana
        //
        // DO MAANYATAYEN GALAT THI:
        //  1. "sabse ooncha score = sabse zyada istemaal" — nahi. Namoona 1
        //     me Rigveda ka score ooncha tha, par jawab Agni Puran ka tha.
        //  2. "jawab aur ansh me shabd milenge" — nahi. Model purani Hindi
        //     ko aaj ki bhasha me likhta hai; shabd-mel bahut kamzor sanket
        //     hai aur DONO taraf fail hota hai.
        //
        // Zyada naam dikhana ek galti hai; GALAT naam dikhana aur sahi naam
        // chhupana usse bahut badi galti hai. Isliye purana vyavhaar wapas.
        //
        // aadhaar.js aur uske test rakhe hain — wo sanket khud galat nahi,
        // bas AKELA kaafi nahi. Sahi raasta shayad ye hai ki model se hi
        // poochha jaye ki usne kaun se granth istemaal kiye (prompt me),
        // par wo alag kaam hai aur uski apni jaanch chahiye.
        const books = [];
        for (const r of groundedChunks) {
          const bt = (r.chunk && (r.chunk.book_title || r.chunk.book)) || "";
          if (!bt || books.includes(bt)) continue;
          books.push(bt);
          if (books.length >= 5) break;
        }
        if (books.length) responseText += `\n\n---\n📚 *Aadhaar: ${books.join(" · ")}*`;
      }
      // SWASTHYA CHETAVANI (2026-08-04) — CODE se, model ke bharose NAHI.
      //
      // Faisla: granthon mein jo upay/mantra likha hai woh user ko dikhega
      // (pehle poori tarah rok diya jaata tha). Uske saath yeh chetavani
      // ZAROORI hai — aur ise prompt par nahi chhoda ja sakta, kyunki
      // model niyam todta hai (audit mein baar-baar dekha). Prompt kehta
      // hai, code NIBHATA hai.
      if (responseText && isHealthQuery(text)) {
        const en = getUiLang() === "en";
        const note = en
          ? "_⚕️ This is what the scriptures say — not medical advice. Please do consult a doctor._"
          : "_⚕️ यह ग्रंथों में लिखी बात है, चिकित्सा सलाह नहीं। कृपया डॉक्टर से अवश्य मिलें।_";
        if (!responseText.includes("⚕️")) responseText += `\n\n${note}`;
      }

      // IMAANDAAR TAG: backup-model (8b) ka jawab tha toh user ko saaf batao —
      // taaki halka jawab dekh kar granth-bharosa na toote
      if (responseText && lastAnswerModel && lastAnswerModel.includes("8b")) {
        responseText += `\n\n_⚡ Vyast samay ka sankshipt uttar — vistrit pramaanik uttar ke liye thodi der baad dobara poochhein._`;
      }
      // KAVACH 1: aakhri 3 sawalon par naram yaad-dilana
      if (responseText && quotaLeftNow !== Infinity && quotaLeftNow <= 3) {
        responseText += `\n\n_🪔 Aaj ke ${quotaLeftNow} AI-sawaal bache — padhna, khojna aur Amrit sunna unlimited hai._`;
      }
      if (responseText) pushMsg("ai", responseText);

    } catch (unexpected) {
      // Catch-all — should never reach here but keeps UX stable
      console.error("[SAARTHI] Unexpected error:", unexpected);
      pushMsg("ai", "Kuch unexpected ho gaya. Dobara try karo. 🙏", { error: true });
    } finally {
      setLoadPhase(null);
      inFlightRef.current = false;
      clearInterval(countdownRef.current);
      setCountdown(0);
    }
  }, [mode, pdfText, subject, pushMsg, startCountdown, sacredChunks]);

  // ── Clear ─────────────────────────────────────────────────────────────────

  const clearMessages = useCallback(() => {
    historyRef.current = [];
    lastMsgRef.current = "";
    setMessages([firstMsg(welcome)]);
    setLoadPhase(null);
    setApiStatus(hasApiKey() ? "ready" : "demo");
    clearInterval(countdownRef.current);
    setCountdown(0);
    // Clear persisted history too
    if (mode === "chat") {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, [welcome, mode]);

  // ── Retry ─────────────────────────────────────────────────────────────────

  const retryLast = useCallback(() => {
    if (inFlightRef.current) return;

    // Find last user message in displayed messages
    setMessages(prev => {
      const lastUser = [...prev].reverse().find(m => m.role === "user");
      if (!lastUser) return prev;

      // Strip the last AI error/fallback bubble
      const withoutError = [...prev];
      for (let i = withoutError.length - 1; i >= 0; i--) {
        if (withoutError[i].role === "ai" && (withoutError[i].error || withoutError[i].fallback)) {
          withoutError.splice(i, 1);
          break;
        }
      }

      // Also trim history ref
      historyRef.current = historyRef.current.filter(
        m => !(m.error || m.fallback)
      );

      // Re-send — run after state settles
      setTimeout(() => sendUserMessage(lastUser.content), 50);
      return withoutError;
    });
  }, [sendUserMessage]);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    messages,
    isLoading:      loadPhase !== null,
    loadPhase,      // "thinking" | "writing" | "retrying" | "fallback" | null
    countdown,      // seconds remaining (rate limit countdown)
    apiStatus,
    hasKey:         hasApiKey(),
    sendUserMessage,
    clearMessages,
    retryLast,
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function firstMsg(content) {
  return { id: uid(), role: "ai", content, time: timeNow(), error: false };
}

function buildWelcome(mode, pdfName) {
  if (mode === "spiritual") {
    return "Namaste 🙏 Main SAARTHI hoon — tumhara spiritual companion.\n\nKya chal raha hai mann mein? Koi bhi baat share karo — main sunn raha hoon.";
  }
  if (mode === "pdf" && pdfName) {
    return `**"${pdfName}"** successfully analyze ho gayi ✓\n\nAb tum seedha is document se poochh sakte ho:\n- *"Chapter 2 explain karo"*\n- *"Important points kya hain?"*\n- *"10 MCQs do"*\n- *"Summary banao"*\n\nKya jaanna chahte ho?`;
  }
  return "Namaste 🙏 Main SAARTHI hoon — tumhara AI teacher aur spiritual companion.\n\nMain help kar sakta hoon:\n- **Koi bhi concept explain karna** (Hindi ya English mein)\n- **Spiritual guidance** — Gita, Ramayana, Ved aur Puranon se\n- **Life challenges** — stress, fear, motivation, focus\n- **Study strategy** — notes, MCQs, revision\n\nKya hai aaj jo poochhhna hai?";
}

function fakeDelay(min, max) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min)) + min));
}
