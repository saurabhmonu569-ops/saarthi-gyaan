/**
 * SAARTHI — Ask section ki poori parakh, SEEDHE /search par (2026-08-10)
 * =====================================================================
 * KYUN YE NAYA BANA (aur eval-ask.mjs kyun kaafi nahi):
 * eval-ask.mjs browser wale engine.js ko fetch-shim se chalata hai. P2 ke
 * baad app us code ko CHHOOTI BHI NAHI — retrieval poori tarah Worker par
 * hai. Yaani wo harness ab ek MARE HUE raaste ko naapta hai. Uspar 300 ya
 * 500 sawaal chalane se number to aayega, par wo jhootha hoga.
 *
 * Aur ek wajah, jo aaj hi pata chali: rerank ka score BATCH-SAPEKSH hai
 * (ek ansh ko alag saathiyon ke saath alag score milta hai). Isliye naap
 * usi raaste par hona chahiye jispar asli jawab banta hai — warna batching
 * alag hogi aur number app se mel nahi khayenge.
 *
 * YE SCRIPT sirf Worker ke /search ko bulati hai — wahi endpoint jo asli
 * app bulati hai. NETLIFY KA KOI BUILD NAHI, koi deploy nahi.
 *
 * KYA-KYA NAAPTA HAI (aapki maang ke hisaab se):
 *   1. AADHAR MILA?      kitne sawaalon par koi granth juda
 *   2. JHOOTHI CITATION  control sawaal (jinka jawab corpus me hai hi
 *                        nahi) par koi granth juda kya — ye 0 rehna
 *                        chahiye, ye is app ki sabse badi jeet hai
 *   3. GRANTH-VITARAN    kitni alag kitaabein istemal hui, aur kya ek hi
 *                        kitab baar-baar aa rahi hai
 *   4. HINTED SAHI?      jab user ne granth ka naam liya, wo granth
 *                        jawab me aaya ya nahi
 *   5. RAFTAAR           har sawaal ka samay
 *
 * CHALAO:
 *   node scripts/14_eval_search.mjs --set hindi_100
 *   node scripts/14_eval_search.mjs --set hinglish_300 --limit 50
 *   node scripts/14_eval_search.mjs --set control
 *   node scripts/14_eval_search.mjs --all
 *
 * --limit N   sirf pehle N sawaal (quota bachane ke liye)
 * --save x    nateeja JSON me likho (baad me tulna ke liye)
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Client ka query-prep — WAHI code jo ChatView chalata hai. Ye zaroori hai:
// agar yahan alag query banegi to naap asli app ka naap nahi rahega.
const { normalizeQueryForSearch, expandQueryWithParyay, stripMetaFraming, questionToTopic, isOutOfScope }
  = await import("../src/knowledge/translit.js");
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { BOOK_META } = await import("../src/data/bookMeta.js");

function loadEnv() {
  const out = { ...process.env };
  const p = join(ROOT, ".env");
  if (existsSync(p)) for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv();

const WORKER = (env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
// Origin bhejna ZAROORI hai — Worker bina Origin ke 403 deta hai (aur ye
// theek hai, wahi guard app ko bahar ke istemal se bachata hai).
const ORIGIN = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
if (!WORKER) {
  console.error("❌ .env me VITE_AI_PROXY_URL chahiye (Worker ka pata).");
  process.exit(1);
}

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};

/**
 * OWNER KA SESSION TOKEN — raftaar-seema se chhoot ke liye (vaikalpik).
 *
 * Worker har IP ko 20 request prati minute deta hai (RATE_PER_MIN). 300
 * sawaal ka naap us hisaab se ~30 minute lega. Par Worker `verifiedOwner`
 * ko is seema se chhoot deta hai — aur wo aap hi hain.
 *
 * KAISE LEIN (ek baar):
 *   1. Live app kholein, Google se sign-in karein
 *   2. F12 → Console → ye chalayein:
 *        JSON.parse(localStorage.SAARTHI_USER_PROFILE).sessionToken
 *   3. Jo lamba token mile, use .env me daalein:
 *        EVAL_SESSION=eyJ...
 *
 * Ye token Worker ke apne HMAC se signed hai aur samay ke saath expire
 * hota hai — isliye kabhi-kabhi dobara lena pad sakta hai. .env git me
 * nahi jaati, isliye ye surakshit hai.
 *
 * Na ho to bhi sab chalta hai, bas dheema — script apne aap 3.2s ka antar
 * rakh leti hai.
 */
const SESSION = (env.EVAL_SESSION || "").trim();

/**
 * Token sach me theek hai? — chalane se PEHLE jaancho.
 *
 * KYUN: pehli baar .env me galti se "EVAL_SESSION=EVAL_SESSION=eyJ..."
 * likha gaya tha. Script ne dekha ki value khaali nahi hai, "owner token
 * mila" chhaap diya, pace 250ms kar diya — aur phir raftaar-seema se
 * takra kar 80 second bekaar rukti rahi. Yaani galat token CHUP-CHAAP
 * kaam karta dikhta hai, bas dheema ho jaata hai.
 *
 * Token do hisson ka hai: payload.signature (base64url). Signature to
 * yahan verify nahi ho sakti (secret Worker ke paas hai), par payload
 * padha ja sakta hai — email aur maiyaad dono usme hain. Itna kaafi hai
 * ki galat/purana token pehle hi pakda jaye.
 */
function checkSession(tok) {
  if (!tok) return { ok: false, why: "set nahi hai" };
  if (tok.startsWith("EVAL_SESSION=")) {
    return { ok: false, why: ".env me naam DO BAAR likha hai — 'EVAL_SESSION=' hata dein, sirf token rakhein" };
  }
  const parts = tok.split(".");
  if (parts.length !== 2) return { ok: false, why: `shakl galat (${parts.length} hisse, 2 chahiye) — token adhoora copy hua?` };
  try {
    const b = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(Buffer.from(b, "base64").toString("utf8"));
    if (!claims.exp) return { ok: false, why: "payload me maiyaad (exp) nahi hai" };
    const baaki = claims.exp - Date.now();
    if (baaki <= 0) {
      return { ok: false, why: `maiyaad khatam ho chuki (${Math.abs(baaki / 3600000).toFixed(1)} ghante pehle) — naya token lein` };
    }
    return { ok: true, email: claims.email || "?", hours: (baaki / 3600000).toFixed(1) };
  } catch (e) {
    return { ok: false, why: "payload padha nahi ja saka — token toota hua hai" };
  }
}

const SESS = checkSession(SESSION);
if (SESSION && !SESS.ok) {
  console.error(`\n⚠️  EVAL_SESSION theek nahi: ${SESS.why}`);
  console.error(`   Bina token bhi chalega, bas dheema (20 sawaal/minute ki seema).`);
  console.error(`   Naya token: live app → F12 → Console →`);
  console.error(`     copy(JSON.parse(localStorage.SAARTHI_USER_PROFILE).sessionToken)\n`);
}
const SESSION_OK = SESS.ok;

const QFILE = join(ROOT, "scripts", "eval-questions.json");
const QS = JSON.parse(readFileSync(QFILE, "utf8"));

// Worker ki seema RATE_PER_MIN = 20 hai (deploy/cloudflare-worker.js).
// 3200ms => ~18.7 req/min, thoda hashiya. --pace se badal sakte hain.
// Owner ka token ho to seema lagti hi nahi — 250ms kaafi hai (Worker ko
// saans lene dene ke liye). Warna 3200ms (~18.7/min, seema 20/min).
const PACE_MS = parseInt(arg("pace", SESSION_OK ? "250" : "3200"), 10);

const wantAll = process.argv.includes("--all");
const setName = arg("set", wantAll ? null : "hinglish_300");
const LIMIT   = parseInt(arg("limit", "0"), 10) || 0;

const sets = wantAll ? Object.keys(QS) : [setName];
for (const s of sets) {
  if (!QS[s]) {
    console.error(`❌ "${s}" nahi mila. Maujood: ${Object.keys(QS).join(", ")}`);
    process.exit(1);
  }
}

/** Ek sawaal ko wahi shakl do jo ChatView deta hai, phir /search ko bhejo */
async function ask(question) {
  // DAAYRE SE BAHAR — client par hi ruk jaata hai, server tak jaata hi nahi.
  // Isko naap me shaamil karna zaroori hai, warna control ka number jhootha
  // ho jayega (wo sawaal to kabhi search hote hi nahi).
  if (isOutOfScope(question)) {
    return { chunks: [], stats: null, skipped: "daayre-se-bahar", ms: 0 };
  }
  const { query: searchQ } = normalizeQueryForSearch(question);
  // ChatView jaisa hi — prashn sirf rerankQ par vishay-vaakya banta hai
  const baseQ   = stripMetaFraming(searchQ);
  const rerankQ = questionToTopic(baseQ);
  const findQ   = expandQueryWithParyay(baseQ);
  const hintedBook = detectHintedBook(question);

  const t0 = Date.now();
  const res = await fetch(`${WORKER}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Origin: ORIGIN,
      ...(SESSION_OK ? { "X-Saarthi-Session": SESSION } : {}),
    },
    body: JSON.stringify({ findQ, rerankQ, hintedBook }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text().catch(() => "");

    // ⚠️ DO ALAG 429 HAIN — inhe ek jaisa maanna bhaari galti hai:
    //
    //   (a) RAFTAAR-SEEMA  "Bahut tez! Thoda dheere" — Worker ka apna
    //       per-IP pehra, 20 request prati minute (RATE_PER_MIN). Ye
    //       ASTHAYI hai. Thoda ruk kar wahi request phir chal jaati hai.
    //       Ise "quota khatam" samajh kar ruk jaana matlab 300 sawaal ka
    //       naap 21 par hi mar jaana — pehli baar yahi hua.
    //
    //   (b) QUOTA KHATAM   Workers AI ke neuron khatam. Ye din bhar ke
    //       liye hai. Yahan RUKNA hi sahi hai — warna wahi hoga jo pichli
    //       baar hua: 35 minute tak wahi error 298 baar chhapta raha aur
    //       ant me ek JHOOTHA "0/298" nikla.
    const rateLimited = res.status === 429 && /bahut tez|rate limit/i.test(body);

    if (rateLimited) return { retry: true };

    if (res.status === 429 || /quota|neuron|exceeded/i.test(body)) {
      console.error(`\n\n❌ QUOTA KHATAM (HTTP ${res.status}) — yahin rok raha hoon.`);
      console.error(`   ${body.slice(0, 200)}`);
      console.error(`   Kal dobara chalayein, ya --limit se chhote hisse me.`);
      process.exit(2);
    }
    return { chunks: [], stats: null, error: `HTTP ${res.status}`, ms, hintedBook };
  }
  const j = await res.json();
  return { chunks: j.chunks || [], stats: j.stats || null, ms, hintedBook, findQ };
}

// ── chalao ────────────────────────────────────────────────────────────
const ALL_BOOKS = Object.keys(BOOK_META);
const out = [];

for (const s of sets) {
  let list = QS[s];
  if (LIMIT) list = list.slice(0, LIMIT);
  console.log(`\n${"═".repeat(66)}`);
  console.log(`  ${s}  —  ${list.length} sawaal`);
  console.log(`  andaazan samay: ${Math.ceil(list.length * (PACE_MS + 3000) / 60000)} minute`
    + (SESSION_OK ? `   (owner token theek — ${SESS.email}, ${SESS.hours}h baaki — seema se chhoot)`
              : `   (bina token: seema 20/min, isliye ${PACE_MS}ms ka antar — .env me EVAL_SESSION daalein to tez hoga)`));
  console.log(`${"═".repeat(66)}\n`);

  /**
   * CHECKPOINT — 2026-08-11
   * ------------------------
   * KYUN: naye_granth me 392 sawaal hain, ~22 minute lagte hain. Beech me
   * raftaar-seema lag jaaye, ya session token khatam ho jaaye, ya laptop
   * so jaaye — to ab tak ka poora kaam chala jaata tha aur shuru se
   * chalana padta tha. Ek baar aisa hua bhi.
   *
   * Ab har sawaal ke baad nateeja file me likh diya jaata hai. Wahi
   * command dobara chalane par jahan chhoda tha wahin se aage badhta hai.
   *
   * Sawaal ka POORA PAATH chaabi hai, uska number nahi — kyunki soochi
   * badal sakti hai (aaj hi naye_granth 381 se 392 hui). Number chaabi
   * hota to soochi badalte hi purana checkpoint galat sawaal par jud
   * jaata, aur wo galti chupchaap nateeje me chali jaati.
   *
   * --naya-shuru  se checkpoint anadekha karke shuru se chalta hai.
   */
  const CKPT = join(ROOT, `.eval-ckpt.${s}.json`);
  let rows = [];
  if (!process.argv.includes("--naya-shuru") && existsSync(CKPT)) {
    try {
      const saved = JSON.parse(readFileSync(CKPT, "utf8"));
      if (Array.isArray(saved)) rows = saved;
    } catch { /* kharab file — shuru se */ }
  }
  const hoChuke = new Set(rows.map(r => r.q));
  if (rows.length) console.log(`  ⏩ checkpoint: ${rows.length}/${list.length} pehle se ho chuke
`);

  let waited = 0;
  for (let i = 0; i < list.length; i++) {
    const q = typeof list[i] === "string" ? list[i] : (list[i].q || list[i].question);
    if (hoChuke.has(q)) continue;

    // Worker 20 request/minute deta hai (RATE_PER_MIN). 3.2s ka antar
    // rakhte hain — thoda hashiya, kyunki KV ki ginti 60s ki khidki par
    // chalti hai aur bilkul kinare par chalna baar-baar takraata hai.
    if (i > 0) await new Promise(r => setTimeout(r, PACE_MS));

    let r = await ask(q);
    // Raftaar-seema par ruk kar dobara — QUOTA se alag baat hai (upar dekho)
    for (let t = 1; r.retry && t <= 5; t++) {
      const back = 8000 * t;                 // 8s, 16s, 24s… seema 60s ki khidki hai
      waited += back;
      process.stdout.write(`\r  ⏸  raftaar-seema — ${back / 1000}s ruk raha hoon (koshish ${t}/5)   `);
      await new Promise(x => setTimeout(x, back));
      r = await ask(q);
    }
    if (r.retry) {
      console.error(`\n❌ 5 koshish ke baad bhi raftaar-seema. Ruk raha hoon — abhi tak ka naap upar hai.`);
      break;
    }
    const books = [...new Set(r.chunks.map(c => c.book))];
    rows.push({ q, set: s, books, n: r.chunks.length, ms: r.ms,
                best: r.stats?.best ?? 0, hinted: r.hintedBook, skipped: r.skipped,
                t: r.stats?.t || null });
    // Har sawaal ke baad likho. 392 chhoti likhaayi 22 minute me kuch nahi
    // hai, aur isi se poora run bachta hai.
    writeFileSync(CKPT, JSON.stringify(rows), "utf8");

    const mark = r.skipped ? "○" : books.length ? "✓" : "✗";
    process.stdout.write(`\r  ${mark} ${i + 1}/${list.length}  `
      + `${(100 * (i + 1) / list.length).toFixed(0)}%   `);
  }
  console.log("\n");
  if (waited) console.log(`  (raftaar-seema ke kaaran kul ${(waited / 1000).toFixed(0)}s ruka)\n`);
  // Poora set ho gaya — checkpoint ki ab zaroorat nahi. Use rakhe rehne
  // dena khatarnak hai: agli baar wahi purana nateeja utha liya jaata aur
  // naya naap chalta hi nahi, jabki dikhta ki chal gaya.
  if (rows.length >= list.length) { try { unlinkSync(CKPT); } catch {} }
  out.push(...rows);

  // ── is set ki report ────────────────────────────────────────────────
  const isControl = /control/i.test(s);
  const withBooks = rows.filter(r => r.books.length);
  const skipped   = rows.filter(r => r.skipped);

  if (isControl) {
    // Control par koi bhi granth = JHOOTHI CITATION
    console.log(`  JHOOTHI CITATION : ${withBooks.length}/${rows.length}`
      + (withBooks.length ? "   ⚠️ ZERO HONI CHAHIYE" : "   ✅"));
    for (const r of withBooks.slice(0, 8)) {
      console.log(`     • "${r.q.slice(0, 52)}" → ${r.books.join(", ")} (best ${r.best})`);
    }
    console.log(`  daayre-se-bahar pakde gaye: ${skipped.length}`);
  } else {
    console.log(`  AADHAR MILA     : ${withBooks.length}/${rows.length}`
      + `  (${(100 * withBooks.length / rows.length).toFixed(1)}%)`);
    console.log(`  koi granth nahi : ${rows.length - withBooks.length - skipped.length}`);
    console.log(`  daayre se bahar : ${skipped.length}`);

    /**
     * FAIL HUE SAWAAL DIKHAO — 2026-08-11
     * -----------------------------------
     * Pehle report sirf ginti deti thi: "26 ko granth nahi mila". Us ek
     * ank se kuch nahi hota — 26 ek hi wajah se fail ho sakte hain, ya
     * 26 alag wajah se. Pata karne ke liye 22 minute ka poora run dobara
     * chalana padta tha, aur beech me main andaaze lagata tha.
     *
     * Ab wahi sawaal chhapte hain, aur unke saath do cheezein jo wajah
     * batati hain: hinted granth (laga ya nahi) aur best rerank score
     * (pool tak pahuncha par gate se gira, ya pool me aaya hi nahi).
     */
    const fail = rows.filter(r => !r.books.length && !r.skipped);
    if (fail.length) {
      console.log(`\n  ── jinhe koi granth nahi mila (${fail.length}) ──`);
      for (const r of fail.slice(0, 40)) {
        console.log(`     • ${r.q.slice(0, 66)}`);
        console.log(`       hinted=${r.hinted || "—"}  best=${(r.best ?? 0).toFixed?.(3) ?? r.best}  ${r.ms}ms`);
      }
      if (fail.length > 40) console.log(`     … aur ${fail.length - 40}`);
    }
  }

  // GRANTH-VITARAN — "bar bar same book aadhar me na aaye" ki jaanch
  const cnt = {};
  for (const r of rows) for (const b of r.books) cnt[b] = (cnt[b] || 0) + 1;
  const used = Object.keys(cnt).length;
  const top  = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const totalCite = top.reduce((a, [, n]) => a + n, 0) || 1;

  console.log(`\n  GRANTH-VITARAN  : ${used}/${ALL_BOOKS.length} kitaabein istemal hui`);
  for (const [b, n] of top.slice(0, 8)) {
    const pct = 100 * n / totalCite;
    console.log(`     ${b.padEnd(24)} ${String(n).padStart(4)}  ${(pct).toFixed(1).padStart(5)}%  `
      + "█".repeat(Math.round(pct / 2)));
  }
  const unused = ALL_BOOKS.filter(b => !cnt[b]);
  if (unused.length) console.log(`     kabhi nahi aayi (${unused.length}): ${unused.join(", ")}`);
  if (top.length && top[0][1] / totalCite > 0.30) {
    console.log(`     ⚠️ "${top[0][0]}" akela ${(100 * top[0][1] / totalCite).toFixed(0)}% citation le raha hai`);
  }

  // HINTED SAHI? — user ne granth ka naam liya, wo granth aaya?
  const hintedRows = rows.filter(r => r.hinted && !r.skipped);
  if (hintedRows.length) {
    const ok = hintedRows.filter(r => r.books.includes(r.hinted)).length;
    console.log(`\n  HINTED GRANTH   : ${ok}/${hintedRows.length} sahi`
      + `  (user ne naam liya, wahi granth jawab me aaya)`);
    for (const r of hintedRows.filter(x => !x.books.includes(x.hinted)).slice(0, 6)) {
      console.log(`     ✗ "${r.q.slice(0, 46)}"  chahiye ${r.hinted}, mila ${r.books.join(",") || "kuch nahi"}`);
    }
  }

  const times = rows.filter(r => !r.skipped).map(r => r.ms).sort((a, b) => a - b);
  if (times.length) {
    const p = k => times[Math.floor(times.length * k)] ?? 0;
    console.log(`\n  RAFTAAR         : beech ${p(0.5)}ms · 90% ${p(0.9)}ms · sabse dheema ${times.at(-1)}ms`);

    // SAMAY KAHAN JA RAHA HAI — kul samay se koi sudhaar nahi soch sakte.
    // Ye ginti batati hai ki dosh embed ka hai, Vectorize ka, D1 ka ya
    // rerank ka. Bina iske har "tez karne" ka upay tukka hai.
    const withT = rows.filter(r => r.t);
    if (withT.length) {
      const keys = [...new Set(withT.flatMap(r => Object.keys(r.t)))];
      console.log(`  samay kahan gaya (beech ka):`);
      for (const k of keys) {
        const v = withT.map(r => r.t[k] ?? 0).sort((a, b) => a - b);
        const med = v[Math.floor(v.length / 2)] ?? 0;
        const p90 = v[Math.floor(v.length * 0.9)] ?? 0;
        console.log(`     ${k.padEnd(11)} ${String(med).padStart(6)}ms   (90% par ${p90}ms)`);
      }
    }
  }
}

// Nateeja HAMESHA likho. Pehle sirf --save par likhta tha, aur aaj 22
// minute ka run bina byore ke khatam ho gaya — 26 fail hue, par kaunse,
// ye jaanne ka koi tareeka nahi bacha. Naapne ka kaam dobara karwane se
// mehnga kuch nahi.
writeFileSync(join(ROOT, `eval-${sets.join("-")}.json`), JSON.stringify(out, null, 1), "utf8");
console.log(`  poora byora: eval-${sets.join("-")}.json`);

const saveTo = arg("save");
if (saveTo) {
  writeFileSync(join(ROOT, saveTo), JSON.stringify(out, null, 1), "utf8");
  console.log(`\n  nateeja likha: ${saveTo}`);
}

console.log(`\n${"═".repeat(66)}`);
console.log(`  kul ${out.length} sawaal · Netlify ka koi build nahi hua`);
console.log(`${"═".repeat(66)}\n`);
