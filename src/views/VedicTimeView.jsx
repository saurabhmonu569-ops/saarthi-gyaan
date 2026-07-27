/**
 * SAARTHI — Vikramaditya Vedic Time view (fmtTime, buildPanchangSummaryText, VedicTimeView, VedicRow, VedicTodayPanel, VedicLearnPanel, VedicAskPanel)
 * Extracted from App.jsx (item #4 refactor, 2026-07-27). Pure move — no
 * logic/behavior change from the original inline code.
 */
import { useState, useRef, useEffect } from "react";
import { askAboutVedicTime, hasApiKey } from "@/services/gemini";
import { useT, useUiLang } from "@/i18n";
import { computePanchang, getUserLocation } from "@/services/panchang";
import { tithiName, NAKSHATRAS, YOGAS, KARANAS, VAARS, RITUS, HINDU_MONTHS, muhurtaLabel, VEDIC_LESSONS } from "@/data/vedicData";
import { useAuth } from "@/context/AuthContext";
import { featureQuotaLeft, featureQuotaUse, VEDIC_QUOTA_LIMIT, serverQuotaConsume, syncLocalQuotaFromServer } from "@/services/quota";
import { C, F, serif } from "@/styles/theme";
import { QuotaPill } from "@/views/AuthWidgets";

function fmtTime(d, uiLang) {
  if (!d) return "—";
  try { return d.toLocaleTimeString(uiLang === "en" ? "en-IN" : "hi-IN", { hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

function buildPanchangSummaryText(p, uiLang) {
  if (!p) return "";
  const tn = tithiName(p.tithi.inPaksha, p.tithi.paksha);
  const lines = [
    `Date/Time: ${p.date.toLocaleString(uiLang === "en" ? "en-IN" : "hi-IN")}`,
    `Tithi: ${tn.hi} / ${tn.en} (${p.tithi.paksha === "shukla" ? "Shukla Paksha" : "Krishna Paksha"})`,
    `Nakshatra: ${NAKSHATRAS[p.nakshatra.index].hi} / ${NAKSHATRAS[p.nakshatra.index].en} (Pada ${p.nakshatra.pada})`,
    `Yoga: ${YOGAS[p.yoga.index].hi} / ${YOGAS[p.yoga.index].en}`,
    `Karana: ${KARANAS[p.karana.key].hi} / ${KARANAS[p.karana.key].en}`,
    `Vaar (weekday): ${VAARS[p.vaar.index].hi} / ${VAARS[p.vaar.index].en}`,
    `Ritu (season): ${RITUS[p.ritu.index].hi} / ${RITUS[p.ritu.index].en}`,
    `Hindu Month (approx): ${HINDU_MONTHS[p.hinduMonth.key].hi} / ${HINDU_MONTHS[p.hinduMonth.key].en}`,
    `Vikram Samvat (approx): ${p.vikramSamvat.value}`,
    `Muhurta: ${muhurtaLabel(p.muhurta.index, "en")} (index ${p.muhurta.index != null ? p.muhurta.index + 1 : "—"} of 30, ~48 min each, Brahma Muhurta = last one before sunrise)`,
    `Sunrise: ${fmtTime(p.sunrise, "en")}, Sunset: ${fmtTime(p.sunset, "en")}`,
  ];
  return lines.join("\n");
}

export function VedicTimeView() {
  const { uiLang } = useUiLang();
  const t = useT();
  const [screen, setScreen] = useState("today"); // today | learn | ask
  const [loc, setLoc]       = useState(null);
  const [now, setNow]       = useState(new Date());
  const [prefillQ, setPrefillQ] = useState("");

  useEffect(() => {
    let alive = true;
    getUserLocation().then(l => { if (alive) setLoc(l); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const panchang = loc ? computePanchang(now, loc.lat, loc.lon) : computePanchang(now);

  const goAsk = (q) => { setPrefillQ(q); setScreen("ask"); };

  const TABS3 = [
    { id: "today", label: uiLang === "en" ? "Today"  : "आज" },
    { id: "learn", label: uiLang === "en" ? "Learn"   : "सीखें" },
    { id: "ask",   label: uiLang === "en" ? "Ask"     : "पूछें" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.cream }}>
      <div style={{ padding: "18px 22px 14px", background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: F.xs + 1, color: C.gold, margin: "0 0 4px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          🕉️ {uiLang === "en" ? "Vedic Time" : "वैदिक समय"}
        </p>
        <h1 style={{ ...serif, fontSize: F.h1 - 2, fontWeight: 500, color: C.ink, margin: "0 0 6px" }}>
          {uiLang === "en" ? "Vikramaditya Vedic Clock" : "विक्रमादित्य वैदिक घड़ी"}
        </h1>
        <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
          {uiLang === "en"
            ? "Understand today's Panchang in simple language."
            : "आज के पंचांग को सरल भाषा में समझें।"}
        </p>
        <div style={{ display: "flex", gap: 6, background: C.cream, padding: 4, borderRadius: 14, border: `1px solid ${C.border}` }}>
          {TABS3.map(tb => (
            <button key={tb.id} onClick={() => setScreen(tb.id)}
              style={{ flex: 1, padding: "9px 6px", borderRadius: 10, border: "none", cursor: "pointer",
                       background: screen === tb.id ? C.white : "transparent",
                       boxShadow: screen === tb.id ? C.shadow : "none",
                       color: screen === tb.id ? C.saffron : C.muted,
                       fontWeight: screen === tb.id ? 700 : 500, fontSize: F.sm, transition: "all 0.18s" }}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {screen === "today" && <VedicTodayPanel panchang={panchang} uiLang={uiLang} loc={loc} onAsk={goAsk} />}
      {screen === "learn" && <VedicLearnPanel uiLang={uiLang} onAsk={goAsk} />}
      {screen === "ask"   && <VedicAskPanel uiLang={uiLang} panchang={panchang} prefill={prefillQ} onConsumePrefill={() => setPrefillQ("")} />}
    </div>
  );
}

function VedicRow({ icon, label, value, sub, uiLang }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px",
                  borderRadius: 14, border: `1px solid ${C.border}`, background: C.white, marginBottom: 8 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: F.xs + 1, color: C.muted, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, fontSize: F.base, color: C.ink, fontWeight: 700 }}>{value}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: F.xs, color: C.faint }}>{sub}</p>}
      </div>
    </div>
  );
}

function VedicTodayPanel({ panchang, uiLang, loc, onAsk }) {
  const p = panchang;
  const tn = tithiName(p.tithi.inPaksha, p.tithi.paksha);
  const nak = NAKSHATRAS[p.nakshatra.index];
  const yog = YOGAS[p.yoga.index];
  const kar = KARANAS[p.karana.key];
  const vaar = VAARS[p.vaar.index];
  const ritu = RITUS[p.ritu.index];
  const month = HINDU_MONTHS[p.hinduMonth.key];
  const approxTag = uiLang === "en" ? " (approx.)" : " (अनुमानित)";
  const en = uiLang === "en";

  const rows = [
    { icon: "🕐", label: en ? "Current Time" : "वर्तमान समय", value: fmtTime(p.date, uiLang) },
    { icon: "🌅", label: en ? "Sunrise" : "सूर्योदय", value: fmtTime(p.sunrise, uiLang) },
    { icon: "🌇", label: en ? "Sunset" : "सूर्यास्त", value: fmtTime(p.sunset, uiLang) },
    { icon: "🪔", label: en ? "Muhurta" : "मुहूर्त", value: muhurtaLabel(p.muhurta.index, uiLang) },
    { icon: "🌙", label: en ? "Tithi" : "तिथि", value: en ? tn.en : tn.hi, sub: en ? `${p.tithi.paksha === "shukla" ? "Shukla" : "Krishna"} Paksha` : `${p.tithi.paksha === "shukla" ? "शुक्ल" : "कृष्ण"} पक्ष` },
    { icon: "⭐", label: en ? "Nakshatra" : "नक्षत्र", value: `${en ? nak.en : nak.hi} · ${en ? "Pada" : "पद"} ${p.nakshatra.pada}` },
    { icon: "☯️", label: en ? "Yoga" : "योग", value: en ? yog.en : yog.hi },
    { icon: "◑", label: en ? "Karana" : "करण", value: en ? kar.en : kar.hi },
    { icon: "📅", label: en ? "Vaar (Weekday)" : "वार", value: en ? vaar.en : vaar.hi },
    { icon: "🍃", label: en ? "Ritu (Season)" : "ऋतु", value: en ? ritu.en : ritu.hi },
    { icon: "🌸", label: en ? "Hindu Month" : "हिंदू मास", value: (en ? month.en : month.hi) + approxTag },
    { icon: "🪷", label: en ? "Vikram Samvat" : "विक्रम संवत", value: p.vikramSamvat.value + approxTag },
  ];

  return (
    <div style={{ padding: 18 }}>
      {loc?.isDefault && (
        <p style={{ fontSize: F.xs, color: C.faint, margin: "0 0 12px", lineHeight: 1.6, padding: "8px 12px", background: C.goldBg, borderRadius: 10 }}>
          {en
            ? "📍 Location permission not given — showing Ujjain (traditional reference) time. Allow location for your city's exact sunrise/muhurta."
            : "📍 लोकेशन अनुमति नहीं मिली — उज्जैन (पारंपरिक संदर्भ) का समय दिखाया जा रहा है। अपने शहर का सटीक सूर्योदय/मुहूर्त देखने के लिए लोकेशन अनुमति दें।"}
        </p>
      )}
      {rows.map(r => <VedicRow key={r.label} {...r} uiLang={uiLang} />)}

      <div style={{ marginTop: 6, padding: "14px 16px", borderRadius: 14, background: C.goldBg, border: `1px solid ${C.goldBdr}50` }}>
        <p style={{ margin: 0, fontSize: F.xs, color: C.muted, lineHeight: 1.7 }}>
          {en
            ? "This is a live astronomical calculation done in your browser (Sun/Moon position, Lahiri ayanamsa) — not a fixed lookup table. Accuracy is close to standard Panchang apps but may differ by a few minutes near tithi/nakshatra boundaries."
            : "यह आपके ब्राउज़र में लाइव खगोलीय गणना (सूर्य/चंद्र स्थिति, लाहिड़ी अयनांश) से बना है — कोई तय टेबल नहीं। सामान्य पंचांग ऐप्स जितनी सटीकता है, पर तिथि/नक्षत्र बदलने के ठीक समय पर कुछ मिनट का अंतर हो सकता है।"}
        </p>
      </div>

      <button onClick={() => onAsk(en ? "What does today's panchang mean for me?" : "आज के पंचांग का मेरे लिए क्या मतलब है?")}
        style={{ width: "100%", marginTop: 14, padding: "13px", borderRadius: 14, border: "none", cursor: "pointer",
                 background: `linear-gradient(140deg, ${C.saffronL}, ${C.gold})`, color: C.white, fontWeight: 700, fontSize: F.base }}>
        {en ? "🙏 Ask SAARTHI to explain" : "🙏 SAARTHI से समझें"}
      </button>
    </div>
  );
}

function VedicLearnPanel({ uiLang, onAsk }) {
  const en = uiLang === "en";
  const [openId, setOpenId] = useState(null);
  return (
    <div style={{ padding: 18 }}>
      {VEDIC_LESSONS.map(lesson => {
        const open = openId === lesson.id;
        return (
          <div key={lesson.id} style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.white, marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => setOpenId(open ? null : lesson.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 15px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 22 }}>{lesson.icon}</span>
              <span style={{ flex: 1, fontSize: F.base, fontWeight: 700, color: C.ink }}>{lesson.title[uiLang] || lesson.title.hi}</span>
              <span style={{ color: C.faint, fontSize: 16, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>›</span>
            </button>
            {open && (
              <div style={{ padding: "0 15px 16px" }}>
                <p style={{ margin: "0 0 12px", fontSize: F.sm, color: C.body, lineHeight: 1.75 }}>
                  {lesson.body[uiLang] || lesson.body.hi}
                </p>
                <button onClick={() => onAsk(lesson.title[uiLang] || lesson.title.hi)}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.goldBdr}`, background: C.goldBg, color: C.gold, fontWeight: 700, fontSize: F.xs + 1, cursor: "pointer" }}>
                  {en ? "Ask SAARTHI ›" : "SAARTHI से पूछें ›"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VedicAskPanel({ uiLang, panchang, prefill, onConsumePrefill }) {
  const en = uiLang === "en";
  const { profile } = useAuth();
  const [q, setQ]           = useState(prefill || "");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState("");
  const [left, setLeft]     = useState(featureQuotaLeft("vedic", VEDIC_QUOTA_LIMIT, profile));
  const askedRef = useRef(false);

  useEffect(() => {
    if (prefill && prefill !== q) setQ(prefill);
  }, [prefill]); // eslint-disable-line

  // 6 suggestions (2026-07-24 fix: user ne 4 already + 2 more maange, taaki
  // computed panchang fields (yoga/karana/month/ritu) bhi cover ho jaayein)
  const SUGGESTIONS = en
    ? ["What is today's Nakshatra?", "Is now a good time to meditate?", "What is Brahma Muhurta?", "What is today's Tithi?", "What Yoga and Karana is it today?", "Which Hindu month and Ritu (season) is it?"]
    : ["आज कौन-सा नक्षत्र है?", "क्या अभी ध्यान का अच्छा समय है?", "ब्रह्म मुहूर्त क्या है?", "आज कौन-सी तिथि है?", "आज कौन-सा योग और करण है?", "आज हिंदू महीना और ऋतु कौन-सी है?"];

  const ask = async (question) => {
    const query = (question || q || "").trim();
    if (!query || busy) return;
    if (!hasApiKey()) { setErr(en ? "AI abhi setup nahi hai." : "AI अभी सेटअप नहीं है।"); return; }
    // ITEM #2 (server-side): asli gate Worker se — localStorage sirf fallback.
    const preQ = await serverQuotaConsume("vedic");
    if (preQ) {
      if (!preQ.allowed) {
        setErr(en ? "Today's free AI limit is over — please try again tomorrow." : "आज की मुफ़्त AI सीमा खत्म हो गई — कृपया कल फिर से कोशिश करें।");
        return;
      }
      syncLocalQuotaFromServer("vedic", preQ.limit, preQ.remaining);
    } else if (featureQuotaLeft("vedic", VEDIC_QUOTA_LIMIT, profile) <= 0) {
      setErr(en ? "Today's free AI limit is over — please try again tomorrow." : "आज की मुफ़्त AI सीमा खत्म हो गई — कृपया कल फिर से कोशिश करें।");
      return;
    }
    setBusy(true); setErr(""); setAnswer("");
    try {
      const summary = buildPanchangSummaryText(panchang, uiLang);
      const out = await askAboutVedicTime(query, summary);
      setAnswer(out);
      // Server ne (preQ truthy hone par) upar hi consume kar diya — display
      // ke liye ab bhi local helper hi call karte hain taaki `left` state
      // turant, synchronously update ho (preQ.remaining bhi wahi value hai).
      setLeft(preQ ? (typeof preQ.remaining === "number" ? preQ.remaining : Infinity) : featureQuotaUse("vedic", VEDIC_QUOTA_LIMIT, profile));
    } catch (e) {
      setErr(en ? "Kuch problem aa gayi — dobara try karein." : "कुछ समस्या आ गई — कृपया दोबारा कोशिश करें।");
    } finally {
      setBusy(false);
      onConsumePrefill?.();
    }
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ margin: "0 0 12px" }}>
        <QuotaPill left={left} uiLang={uiLang} labelHi="आज बचे मुफ़्त सवाल" labelEn="Today's free questions left" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => { setQ(s); ask(s); }}
            style={{ padding: "7px 12px", borderRadius: 18, border: `1px solid ${C.border}`, background: C.white, color: C.body, fontSize: F.xs + 1, cursor: "pointer" }}>
            {s}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") ask(); }}
          placeholder={en ? "Ask about today's Vedic time…" : "आज के वैदिक समय के बारे में पूछें…"}
          style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.borderMd}`, fontSize: F.base, outline: "none" }} />
        <button onClick={() => ask()} disabled={busy}
          style={{ padding: "0 18px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer",
                   background: busy ? C.faint : C.saffron, color: C.white, fontWeight: 700 }}>
          {busy ? "…" : (en ? "Ask" : "पूछें")}
        </button>
      </div>
      {err && <p style={{ color: C.red, fontSize: F.sm, marginBottom: 12 }}>{err}</p>}
      {answer && (
        <div style={{ padding: "16px", borderRadius: 14, background: C.white, border: `1px solid ${C.border}`, whiteSpace: "pre-wrap", fontSize: F.base, color: C.body, lineHeight: 1.8 }}>
          {answer}
        </div>
      )}
    </div>
  );
}

