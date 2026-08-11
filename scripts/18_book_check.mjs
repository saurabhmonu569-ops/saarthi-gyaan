/**
 * SAARTHI — HAR GRANTH ki jaanch (2026-08-11)
 * =====================================================================
 * KYUN: 17_smoke_check.mjs sirf 10 sawaal poochta hai. Usme 24 me se 6
 * granth aate hain — baaki 18 ka kuch pata nahi chalta. Ek granth ingest
 * hone ke baad bhi khoj se bahar ho sakta hai (galat hint, FTS me na
 * milna, rerank par gir jaana), aur wo aisi khamoshi se hota hai ki
 * kahin koi error nahi aata.
 *
 * Ye script har granth se do sawaal poochti hai:
 *   NAAM   — sawaal me granth ka naam hai. Yahi sabse sakht jaanch hai:
 *            naam dene par bhi wo granth na aaye to wo granth app ke
 *            liye maujood hi nahi hai.
 *   VISHAY — sawaal me naam NAHI hai, sirf us granth ka vishay hai.
 *            Yahan wo granth aana zaroori nahi; ye sirf dikhata hai ki
 *            bina naam ke khoj kahan jaati hai.
 *
 * NAAM wale sawaal FAIL = asli galti. VISHAY wale sirf jaankari ke liye.
 *
 * Saath me 5 "bahar" ke sawaal — jinka jawab KHAALI aana chahiye. Ek bhi
 * Aadhaar aaya to wo jhoothi citation hai, jo sabse badi galti hai.
 *
 * CHALAO:
 *   node scripts/18_book_check.mjs                 # sab (55 sawaal, ~4 min)
 *   node scripts/18_book_check.mjs --naam          # sirf naam wale (25)
 *   node scripts/18_book_check.mjs --book yoga_sutra
 *
 * Ye Netlify par kuch nahi bhejta — seedha Worker ke /search par jaata hai.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = {};
if (existsSync(join(ROOT, ".env"))) {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const API = (env.VITE_AI_PROXY_URL || "").trim().replace(/\/+$/, "");
if (!API) { console.error("❌ .env me VITE_AI_PROXY_URL chahiye"); process.exit(1); }
const ORIGIN = (env.EVAL_ORIGIN || "https://saarthi-gyaan.netlify.app").trim();
const SEARCH = API + "/search";

const { BOOK_META } = await import("../src/data/bookMeta.js");
const { detectHintedBook } = await import("../src/knowledge/bookHints.js");
const { normalizeQueryForSearch, expandQueryWithParyay, questionToTopic, stripMetaFraming } =
  await import("../src/knowledge/translit.js");

/** ChatView.jsx jo karta hai, bilkul wahi — 17_smoke_check.mjs dekho */
function queryBanao(q) {
  const { query: searchQ } = normalizeQueryForSearch(q);
  const baseQ = stripMetaFraming(searchQ);
  return {
    findQ:      expandQueryWithParyay(baseQ),
    rerankQ:    questionToTopic(baseQ),
    hintedBook: detectHintedBook(q),
  };
}

/**
 * [book_id, NAAM wala sawaal, VISHAY wala sawaal]
 *
 * Sawaal us granth ke apne vishay se chune hain, kisi aam soochi se nahi —
 * warna jaanch sirf naam-milan ki ho jaati, granth ke bheetar kya hai
 * iski nahi.
 */
const SAWAAL = [
  ["bhagavad_gita_shankar", "Bhagavad Gita me karmayog ka saar kya hai",              "nishkam karm ka arth kya hota hai"],
  ["ramcharitmanas",        "Ramcharitmanas me Hanuman ji ka Lanka gaman kaise hua",  "Hanuman ji ko Jambavan ne kya yaad dilaya"],
  ["mahabharata",           "Mahabharat me Yaksha Prashna kya tha",                   "Vidur ne raja ko kaisi neeti batayi"],
  ["yoga_sutra",            "Yoga Sutra me kleshas kitne hain",                       "chittavritti nirodh ka arth kya hai"],
  ["yoga_vasishtha",        "Yoga Vasishtha me vairagya prakaran kya kehta hai",      "man ko vash me kaise kiya jaye"],
  ["rigveda_1",             "Rigveda me Agni sukt ka varnan kya hai",                 "Usha devi ki stuti kaise ki gayi hai"],
  ["samaveda",              "Samaveda me gaayan ki paddhati kya hai",                 "saam gaan ka mahatva kya hai"],
  ["yajurveda",             "Yajurveda me yajna vidhan kaise bataya gaya hai",        "adhvaryu ka kaam kya hota hai"],
  ["atharvaveda_1",         "Atharvaveda me raksha ke sukt kaunse hain",              "rog nivaran ke vaidik upchar kya hain"],
  ["shiva_purana_1",        "Shiv Puran me Shiv ji ke vivah ka varnan kya hai",       "Daksh yagya me kya hua tha"],
  ["shiva_purana_2",        "Shiv Puran Khand 2 me jyotirlinga ka varnan kya hai",    "baarah jyotirlinga kaunse hain"],
  ["vishnu_purana_1",       "Vishnu Puran me Dhruv ki katha kya hai",                 "Vishnu ke avataron ka uddeshya kya hai"],
  ["garuda_purana_1",       "Garud Puran me mrityu ke baad ki gati kya batayi gayi",  "shraddh karm ka vidhan kya hai"],
  ["narasimha_purana",      "Narsimha Puran me Prahlad ki katha kya hai",             "Hiranyakashipu ka vadh kaise hua"],
  ["bhavishya_purana",      "Bhavishya Puran me surya upasana ka varnan kya hai",     "kalyug ke lakshan kya bataye gaye hain"],
  ["agni_purana",           "Agni Puran me vastu ka varnan kya hai",                  "mandir nirman ki vidhi kya hai"],
  ["ishadi_upanishad",      "Ishavasya Upanishad ka pehla mantra kya kehta hai",      "aatma aur Brahma ka sambandh kya hai"],
  ["kathopanishad",         "Kathopanishad me Nachiketa ne Yam se kya poocha",        "shreya aur preya me kya antar hai"],
  ["guru_granth_sahib",     "Guru Granth Sahib me Hukam ka arth kya hai",             "haumai kaise dukh ka karan banti hai"],
  ["chanakya_neeti",        "Chanakya Neeti me mitra ki pehchan kaise batayi gayi",   "dhan ka sadupyog kaise karna chahiye"],
  ["ekadashi_mahatmya",     "Ekadashi Mahatmya me vrat ka phal kya bataya gaya hai",  "nirjala ekadashi ka mahatva kya hai"],
  ["mantra_maha_sagar",     "Mantra Maha Sagar me Gayatri mantra ka vidhan kya hai",  "beej mantra kaise kaam karte hain"],
  ["nitya_karm_pooja",      "Nitya Karm Pooja me sandhya vandan ki vidhi kya hai",    "pooja me kaunse patra pushp varjit hain"],
  ["lal_kitab",             "Lal Kitab me Shani ke upay kya bataye gaye hain",        "kundli ke bhaav ka kya arth hota hai"],
  ["rashi_muhurt_vigyan",   "Rashi aur Muhurt Vigyan me shubh muhurt kaise dekha jata hai", "vivah ka muhurt kaise nikala jata hai"],
];

/**
 * BAHAR ke sawaal DO kism ke hain — aur dono ke liye "sahi" alag hai.
 *
 * SAKHT: naam bhi hamara nahi, aur VISHAY bhi hamare kisi granth me nahi.
 *        Jawab KHAALI aana chahiye. Aadhaar aaya = jhoothi citation.
 *
 * NARM:  granth hamara nahi, par us sawaal ka VISHAY hamare granthon me
 *        sach me maujood hai. Jaise "Bhagavatam me Gopiyon ki bhakti" —
 *        Bhagavatam hamare paas nahi, par Gopi-bhakti Vishnu Puran aur
 *        Mahabharat dono me hai.
 *
 *        Yahan ansh aana GALAT NAHI hai. Saarthi ka kaam user ke sawaal
 *        ka jawab dena hai, use khaali haath lautana nahi. Galti tab hai
 *        jab jawab KAHE ki "Bhagavatam me likha hai" — yaani us granth ka
 *        naam le jo hamare paas hai hi nahi.
 *
 *        Wo prompt ka kaam hai (gemini.js ki granth-soochi), khoj ka nahi.
 *        Ye script sirf khoj tak dekhti hai, isliye NARM wale sawaal
 *        FAIL nahi ginne chahiye — sirf dikhaye jaate hain, taaki jaanch
 *        aage prompt par ki ja sake.
 */
const BAHAR_SAKHT = [
  "Dhammapada me krodh ko jeetne ka upay kya hai",
  "Tao Te Ching me wu wei ka arth kya hai",
  "SAARTHI GYAAN app kis technology par bana hai",
];
const BAHAR_NARM = [
  ["Srimad Bhagavatam me Gopiyon ki bhakti kaisi thi",     "Gopi-bhakti Vishnu Puran/Mahabharat me hai"],
  ["Chandogya Upanishad me Shvetaketu ko kya sikhaya gaya", "Shvetaketu sirf Chandogya me — hamare paas nahi"],
];

const onlyBook = (() => { const i = process.argv.indexOf("--book"); return i > -1 ? process.argv[i + 1] : null; })();
const naamOnly = process.argv.includes("--naam");

async function poochho(q) {
  const body = queryBanao(q);
  const t0 = Date.now();
  try {
    const r = await fetch(SEARCH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      // 429 = raftaar-seema. Ye galti nahi hai; ruk kar dobara poochho.
      if (r.status === 429) { await new Promise(s => setTimeout(s, 12000)); return poochho(q); }
      throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 100)}`);
    }
    const j = await r.json();
    return { ch: j.chunks || [], stats: j.stats || null, ms: Date.now() - t0, body };
  } catch (e) { return { ch: [], stats: null, ms: Date.now() - t0, err: e.message, body }; }
}

const naam = id => (BOOK_META[id]?.en || BOOK_META[id]?.title || id);

console.log(`\n  ${SEARCH}`);
console.log(`  ${SAWAAL.length} granth × ${naamOnly ? 1 : 2} sawaal`
  + (naamOnly ? "" : ` + ${BAHAR_SAKHT.length} sakht + ${BAHAR_NARM.length} narm bahar ke`) + "\n");
console.log(`  ${"GRANTH".padEnd(23)} NAAM-wala        VISHAY-wala`);
console.log(`  ${"─".repeat(72)}`);

const der = [], nateeja = [];
let naamPass = 0, naamFail = 0;

for (const [id, qNaam, qVishay] of SAWAAL) {
  if (onlyBook && id !== onlyBook) continue;

  const a = await poochho(qNaam);
  der.push(a.ms);
  const aBooks = [...new Set(a.ch.map(c => c.book))];
  const aOk = aBooks.includes(id);
  aOk ? naamPass++ : naamFail++;

  let bTxt = "";
  let b = null;
  if (!naamOnly) {
    b = await poochho(qVishay);
    der.push(b.ms);
    const bBooks = [...new Set(b.ch.map(c => c.book))];
    bTxt = bBooks.length ? (bBooks.includes(id) ? `✓ ${id}` : bBooks.slice(0, 2).join(",")) : "(khaali)";
  }

  console.log(`  ${aOk ? "✅" : "❌"} ${naam(id).slice(0, 21).padEnd(21)} `
    + `${(a.err ? "ERR" : `${a.ch.length} ansh`).padEnd(16)} ${bTxt}`);

  if (!aOk) {
    console.log(`       sawaal : ${qNaam}`);
    if (a.err) console.log(`       ERROR  : ${a.err}`);
    else {
      console.log(`       mila   : ${aBooks.join(", ") || "(kuch nahi)"}`);
      console.log(`       findQ  : ${a.body.findQ.slice(0, 100)}`);
      if (a.stats) {
        const k = ["hinted", "poolSize", "hintedInPool", "hintedPassed", "skipped", "kept"];
        console.log(`       worker : ` + k.filter(x => a.stats[x] !== undefined)
          .map(x => `${x}=${JSON.stringify(a.stats[x])}`).join("  "));
      }
    }
  }
  nateeja.push({ id, qNaam, aOk, aBooks, ansh: a.ch.length, ms: a.ms, stats: a.stats });
}

let baharPass = 0;
if (!naamOnly && !onlyBook) {
  console.log(`\n  BAHAR — SAKHT (vishay bhi hamare paas nahi, jawab KHAALI aana chahiye)`);
  console.log(`  ${"─".repeat(72)}`);
  for (const q of BAHAR_SAKHT) {
    const r = await poochho(q); der.push(r.ms);
    const books = [...new Set(r.ch.map(c => c.book))];
    const ok = r.ch.length === 0;
    if (ok) baharPass++;
    console.log(`  ${ok ? "✅" : "❌"} ${q.slice(0, 52).padEnd(54)} ${ok ? "khaali" : `${r.ch.length} ansh — ${books.join(", ")}`}`);
    if (!ok) console.log(`       ⚠️ JHOOTHI CITATION — hinted=${r.stats?.hinted ?? "—"}`);
  }

  console.log(`\n  BAHAR — NARM (granth hamara nahi, par vishay hai — ansh aana theek hai)`);
  console.log(`  ${"─".repeat(72)}`);
  for (const [q, kyun] of BAHAR_NARM) {
    const r = await poochho(q); der.push(r.ms);
    const books = [...new Set(r.ch.map(c => c.book))];
    console.log(`  •  ${q.slice(0, 52).padEnd(54)} ${r.ch.length ? `${r.ch.length} ansh — ${books.slice(0, 3).join(", ")}` : "khaali"}`);
    console.log(`     ${kyun}`);
    console.log(`     ⇒ dekhna: jawab me "${q.split(" me ")[0]}" ka naam NAHI aana chahiye (prompt ka kaam)`);
  }
}

der.sort((a, b) => a - b);
console.log(`\n  ${"═".repeat(72)}`);
console.log(`  NAAM-wale  : ${naamPass}/${naamPass + naamFail} granth apne naam par milte hain`);
if (!naamOnly && !onlyBook) console.log(`  BAHAR sakht: ${baharPass}/${BAHAR_SAKHT.length} theek se khaali laute`);
console.log(`  der        : madhya ${der[Math.floor(der.length / 2)]}ms  |  p90 ${der[Math.floor(der.length * 0.9)]}ms  |  sabse zyada ${der[der.length - 1]}ms`);
if (naamFail) console.log(`\n  ⚠️  ${naamFail} granth apne naam par bhi nahi milte — upar unka byora hai.`);
else console.log(`\n  ✅ Har granth apne naam par milta hai.`);

writeFileSync(join(ROOT, "book-check.json"), JSON.stringify(nateeja, null, 1), "utf8");
console.log(`  byora → book-check.json\n`);
