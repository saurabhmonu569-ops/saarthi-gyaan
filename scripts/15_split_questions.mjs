/**
 * SAARTHI — naye sawaalon ko TEEN jhund me baanto (2026-08-11)
 * =====================================================================
 * KYUN: 500 naye sawaal aaye. Unhe ek saath naapna GALAT nateeja deta,
 * kyunki unme teen bilkul alag kism ke sawaal hain aur teenon ke liye
 * "sahi vyavhaar" alag hai:
 *
 *   1. GRANTH  — jinka jawab hamari 24 kitaabon mein hona chahiye.
 *                Sahi = Aadhaar mile. Fail = asli galti.
 *
 *   2. BAHAR   — jinme aise granth ka naam hai jo hamare paas HAI HI
 *                NAHI (Srimad Bhagavatam, Yoga Sutras, Dhammapada, Tao
 *                Te Ching, aur wo teen jo hataye ja chuke hain — Mantra
 *                Shakti, Nitya Devta Archana, Valmiki Ramayan).
 *                Sahi = KOI Aadhaar na mile. Aadhaar mila = JHOOTHI
 *                citation, yaani sabse badi galti.
 *
 *   3. DESIGN  — "RAG ko kaise karna chahiye", "metadata me kaunse
 *                fields", "SAARTHI ko clarification kab maangni chahiye".
 *                Inka jawab kisi granth mein hai hi nahi — ye hamare
 *                liye hain, app ke user ke liye nahi. Inhe retrieval se
 *                naapna bemani hai.
 *
 * Sab ek saath chalane par ~200 sawaal "fail" dikhte, jinka fail hona
 * BILKUL SAHI hai. Aur us jhoothe number ko theek karne ki koshish mein
 * asli galtiyan chhup jaati.
 *
 * CHALAO:
 *   node scripts/15_split_questions.mjs                # sirf dikhao
 *   node scripts/15_split_questions.mjs --write        # eval-questions.json me likho
 *
 * INPUT: scripts/naye-500.txt  — ek line mein ek sawaal ("Q1. ..." theek hai)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(ROOT, "scripts", "naye-500.txt");
const QF   = join(ROOT, "scripts", "eval-questions.json");

if (!existsSync(SRC)) {
  console.error(`❌ ${SRC} nahi mili.`);
  console.error(`   VS Code me "scripts/naye-500.txt" banaiye aur 500 sawaal paste kijiye.`);
  process.exit(1);
}

const { BOOK_META } = await import("../src/data/bookMeta.js");

/**
 * GRANTH JO HAMARE PAAS NAHI HAIN.
 *
 * Ye list soch-samajh kar banayi hai — har naam ka corpus se milaan kiya
 * gaya hai. Teen naam khaas hain kyunki wo KABHI THE aur ab nahi hain:
 *   valmiki_ramayana     — OCR kachra tha (tootna 0.50), 7 Aug ko hataya
 *   mantra_shakti        — corpus/PDF/chunks kahin nahi
 *   nitya_devta_archana  — corpus/PDF/chunks kahin nahi
 * Baaki wo granth hain jo kabhi ingest hi nahi hue.
 */
const NAHI_HAI = [
  // kabhi the, ab nahi
  [/valmiki\s*ramayan|वाल्मीकि/i,                    "Valmiki Ramayan (hataya ja chuka)"],
  [/mantra\s*shakti/i,                               "Mantra Shakti (hataya ja chuka)"],
  [/nitya\s*devta\s*archana/i,                       "Nitya Devta Archana (hataya ja chuka)"],
  // kabhi ingest hi nahi hue
  [/bhagavatam|bhagwatam|श्रीमद्भागवत|bhagavat\s*tradition|uddhava\s*gita/i, "Srimad Bhagavatam"],
  [/yoga\s*sutra|patanjali|पतंजलि|kleshas?\b|abhyasa\s*aur\s*vairagya|asmita/i, "Yoga Sutras (Patanjali)"],
  [/dasam\s*granth/i,                                "Dasam Granth"],
  [/dhammapada/i,                                    "Dhammapada"],
  [/majjhima\s*nikaya/i,                             "Majjhima Nikaya"],
  [/lotus\s*sutra|bodhisattva|burning\s*house/i,     "Lotus Sutra"],
  [/tattvartha\s*sutra|acharanga\s*sutra/i,          "Jain Sutras"],
  [/tao\s*te\s*ching|wu\s*wei/i,                     "Tao Te Ching"],
  [/analects|confucius|\bren\b/i,                    "Analects"],
  [/meditations|marcus\s*aurelius/i,                 "Meditations"],
  [/the\s*prophet|almustafa/i,                       "The Prophet"],
  [/imitation\s*of\s*christ/i,                       "The Imitation of Christ"],
  // Upanishad jo hamare paas nahi (hamare paas sirf Ishadi aur Katho hain)
  [/chandogya|shvetaketu/i,                          "Chandogya Upanishad"],
  [/brihadaranyaka|yajnavalkya|maitreyi/i,           "Brihadaranyaka Upanishad"],
  [/mandukya/i,                                      "Mandukya Upanishad"],
];

/**
 * DESIGN ke sawaal — ye app ke user ke nahi, hamare hain.
 *
 * Pehchan do tarah se: takneeki shabd (RAG, metadata, retrieval), aur
 * "SAARTHI ko kya karna chahiye" jaisa dhaancha. Doosra zyada zaroori
 * hai — "SAARTHI ko source kaise select karna chahiye" mein koi takneeki
 * shabd nahi hai, par wo bhi design ka sawaal hai.
 */
const DESIGN = [
  /\bRAG\b|retrieval|metadata|semantic\s*search|fuzzy\s*search|indexing|embedding/i,
  /SAARTHI\s*(?:GYAAN\s*)?ko\s+.*(?:chahiye|karna|karni|dena|identify|select|retrieve|distinguish)/i,
  /(?:AI|system)\s*ko\s+.*(?:chahiye|karna chahiye)/i,
  /hallucination/i,
  /source\s*(?:attribution|confusion|difference|kaise identify)/i,
  /kaise\s*test\s*karenge|testing\s*ke\s*liye/i,
  /volume\s*(?:transition|identify|kaunse)|kis\s*volume\s*me/i,
];

const lines = readFileSync(SRC, "utf8")
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean)
  .filter(l => !l.startsWith("##"))   // madad wali tippani chhodo
  .map(l => l.replace(/^Q?\s*\d+\s*[.):\-]\s*/, "").trim())   // "Q1." hatao
  .filter(l => l.length > 8);

console.log(`${lines.length} sawaal padhe\n`);

const granth = [], bahar = [], design = [];
const baharKyun = new Map();

for (const q of lines) {
  // KRAM ZAROORI: pehle "granth hai hi nahi" dekho, phir design.
  // Kyunki "Bhagavatam me X kaise retrieve kare" DONO hai — par wahan
  // asli baat ye hai ki wo granth hamare paas nahi. Use bahar hi maano.
  const na = NAHI_HAI.find(([re]) => re.test(q));
  if (na) { bahar.push(q); baharKyun.set(na[1], (baharKyun.get(na[1]) || 0) + 1); continue; }
  if (DESIGN.some(re => re.test(q))) { design.push(q); continue; }
  granth.push(q);
}

const pct = n => `${n} (${(100 * n / lines.length).toFixed(0)}%)`;
console.log(`  naye_granth : ${pct(granth.length)}   ← asli imtihaan, Aadhaar milna chahiye`);
console.log(`  naye_bahar  : ${pct(bahar.length)}   ← Aadhaar NAHI milna chahiye`);
console.log(`  naye_design : ${pct(design.length)}   ← retrieval se naapna bemani\n`);

console.log("BAHAR wale kis granth ki wajah se:");
for (const [k, v] of [...baharKyun].sort((a, b) => b[1] - a[1])) {
  console.log(`   ${String(v).padStart(3)}  ${k}`);
}

const dikhao = (naam, arr, n = 6) => {
  console.log(`\n─── ${naam} — pehle ${Math.min(n, arr.length)} ───`);
  for (const q of arr.slice(0, n)) console.log(`   ${q.slice(0, 88)}`);
};
dikhao("naye_granth", granth);
dikhao("naye_bahar", bahar);
dikhao("naye_design", design);

if (process.argv.includes("--write")) {
  const qs = JSON.parse(readFileSync(QF, "utf8"));
  qs.naye_granth = granth;
  qs.naye_bahar  = bahar;
  qs.naye_design = design;
  writeFileSync(QF, JSON.stringify(qs, null, 1), "utf8");
  console.log(`\n✅ eval-questions.json me likh diya (naye_granth, naye_bahar, naye_design)`);
} else {
  console.log(`\n(sirf dikhaya hai — likhne ke liye:  node scripts/15_split_questions.mjs --write)`);
}
