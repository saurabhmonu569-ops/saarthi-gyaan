/**
 * SAARTHI — retrieval ab SERVER par (P2, 2026-08-10)
 * =====================================================================
 * Ye file wo sab kuch REPLACE karti hai jo ChatView.jsx browser mein
 * karta tha: keyword search, cross-book search, semantic search, rerank,
 * gate, per-book cap, padosi ansh.
 *
 * KYUN BADLA: wo saara kaam browser mein isliye hota tha ki poora corpus
 * browser mein utarta tha — books 165 MB + keyword index 93 MB + vectors
 * 59 MB = 316 MB (gzip ke baad bhi ~122 MB). Bharat mein mobile par koi
 * itna intezaar nahi karta. Yaani 298 sawaalon par jo 80% naapa gaya tha,
 * wo kisi ASLI user tak pahunchta hi nahi tha.
 *
 * Ab wahi kaam Worker ke /search par hota hai (Vectorize + D1 + Workers
 * AI). Client par download: 0 MB.
 *
 * ⚠️ JO CLIENT PAR HI RAHTA HAI, AUR KYUN:
 *   translit / paryay / stripMetaFraming / isOutOfScope / detectHintedBook
 * Ye sab SIRF CODE hain — inka data kuch KB ka lexicon hai, MB ka corpus
 * nahi. Inhe client par rakhne se ek round-trip bachta hai, aur — zyada
 * zaroori — inke 200+ unit test bina kisi network ke chalte rehte hain.
 *
 * ⚠️ SANKHYAYEIN YAHAN NAHI HAIN. MIN_RERANK 0.30, per-book cap 3, keep 12,
 * quota 45/20/20 — sab Worker mein hain, ek hi jagah. Client unhe dohrata
 * nahi, warna do jagah badalni padti aur ek din wo alag ho jaati.
 */

const AI_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");

/**
 * Session token — verified owner ko rate-limit se chhoot milti hai.
 * Bilkul wahi jagah se jahan se quota.js aur gemini.js uthate hain
 * (profile ke ANDAR, apni key mein nahi) — teeno ek hi jagah dekhein,
 * warna ek din chup-chaap alag ho jaate hain.
 */
function sessionHeader() {
  try {
    const raw = localStorage.getItem("SAARTHI_USER_PROFILE");
    if (!raw) return {};
    const t = JSON.parse(raw)?.sessionToken;
    return t ? { "X-Saarthi-Session": t } : {};
  } catch { return {}; }
}

/**
 * Ek sawaal par poora retrieval — Worker se.
 *
 * @param {{findQ:string, rerankQ?:string, hintedBook?:string|null}} q
 * @returns {Promise<{chunks:Array, stats:Object}>}
 *
 * FAIL-SOFT: network gira ya Worker ne 5xx diya to KHAALI lautata hai,
 * throw nahi karta. Khaali matlab "koi granth nahi mila" — aur user ka
 * apna niyam yahi hai: "agar 1% bhi jawab nahi mila toh saada jawab dena,
 * source ke bina bhi chalega." Throw karne se poora chat toot jaata.
 */
export async function serverRetrieve({ findQ, rerankQ, hintedBook = null }) {
  if (!AI_PROXY_URL) {
    console.warn("[ServerSearch] VITE_AI_PROXY_URL set nahi hai — bina granth ke jawab");
    return { chunks: [], stats: null };
  }
  if (!findQ || !findQ.trim()) return { chunks: [], stats: null };

  const t0 = performance.now();
  try {
    const res = await fetch(`${AI_PROXY_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sessionHeader() },
      body: JSON.stringify({ findQ, rerankQ: rerankQ || findQ, hintedBook }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[ServerSearch] /search HTTP ${res.status} — ${body.slice(0, 200)}`);
      return { chunks: [], stats: null };
    }
    const j = await res.json();
    const chunks = Array.isArray(j?.chunks) ? j.chunks : [];
    const stats = j?.stats || null;

    console.log(
      `[ServerSearch] pool=${stats?.pool ?? "?"} → gate-paar=${stats?.passed ?? "?"}`
      + ` → rakhe=${stats?.kept ?? "?"} (+${stats?.padosi ?? 0} padosi)`
      + ` | granth: ${[...new Set(chunks.map(c => c.book))].join(", ") || "koi nahi"}`
      + ` | best=${stats?.best ?? "?"} | server ${stats?.ms ?? "?"}ms`
      + ` | kul ${Math.round(performance.now() - t0)}ms`
    );

    // POOL KA HISAAB — alag line, kyunki isi se pata chalta hai ki galti
    // KAHAN hui. Do bilkul alag bimariyan ek jaisi dikhti hain:
    //   sahi ansh pool mein aaya hi nahi   → dhoondhne ka masla
    //   aaya par gate paar nahi kar paya   → aankne ka masla
    // Inka ilaaj ulta hai, isliye pehle ye jaanna zaroori hai.
    if (stats?.poolByBook) {
      const spread = Object.entries(stats.poolByBook).map(([b, n]) => `${b} ${n}`).join(" · ");
      console.log(`[ServerSearch] pool ka batwara: ${spread}`
        + (stats.hinted
            ? `  ||  user ne granth kaha: ${stats.hinted}`
              + ` — pool mein ${stats.hintedInPool}, gate paar ${stats.hintedPassed}`
            : ""));
    }
    return { chunks, stats };
  } catch (e) {
    console.warn("[ServerSearch] fail:", e?.message || e);
    return { chunks: [], stats: null };
  }
}

/**
 * Worker ko jagao — ChatView mount par ek baar.
 *
 * Pehle sawaal par naapa gaya 3,028 ms tha, jisme cold start shaamil hai:
 * Worker isolate, Vectorize ka pehla connection, aur AI model ka warmup.
 * Ye chhota-sa call wo teeno pehle hi kara deta hai, taaki user ka PEHLA
 * sawaal bhi utna hi tez lage jitna doosra.
 *
 * (Yehi kaam pehle preloadSemanticSearch() karta tha, par wo 59 MB vectors
 * utaarne ke liye tha — ab utarne ko kuch hai hi nahi.)
 */
export function warmServerSearch() {
  if (!AI_PROXY_URL) return;
  serverRetrieve({ findQ: "धर्म", rerankQ: "धर्म" }).catch(() => {});
}
