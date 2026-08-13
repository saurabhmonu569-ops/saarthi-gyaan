# SAARTHI GYAAN — Checklist, 13 Aug 2026

Har ank naapa hua hai. Jahan naap nahi, wahan saaf likha hai.

---

## 1. ABHI KI HAALAT — 1,250 sawaal (25 granth × 50)

| | 12 Aug | **13 Aug (aaj)** |
|---|---|---|
| **SAHI** (jo granth chahiye tha, wahi mila) | 80.0% | **80.2%** |
| **ANYA** (Aadhaar mila, par galat granth ka) | 8.2% | **7.9%** |
| **KHAALI** (koi Aadhaar nahi) | 11.8% | **11.9%** |
| purana tareeka hota to "pass" dikhta | 88.1% | 88.1% |

**Aaj ka din net-net barabar raha.** Ek bada badlav aazmaya, wo bigaad
gaya, wapas le liya. Par nidaan me badi pragati hui — neeche #4.

### Granth-vaar

| ✅ 90%+ | 🟡 70-89% | 🔴 70% se neeche |
|---|---|---|
| Agni Puran 100% | Rigveda 88% | Bhavishya Puran 68% |
| Atharvaveda 100% | Rashi-Muhurt 88% | Patanjali Yoga Sutra 68% |
| Samaveda 98% | Kathopanishad 78% | Gita **66%** |
| Yajurveda 98% | Vishnu Puran 78% | Nitya Karm Pooja **66%** |
| Chanakya Neeti 96% | Ishadi / Mahabharat 76% | **Mantra Maha Sagar 46%** |
| Ekadashi 96% | Shiv Puran Kh.1 74% | |
| Garud Puran 94% | Yoga Vasishtha 74% | |
| Ramcharitmanas 90% | Guru Granth / Lal Kitab / Shiv Kh.2 72% | |
| | Narsimha Puran 70% | |

---

## 2. SABSE ZAROORI ANK — jo poore project ka rukh tay karta hai

```
hint SAHI laga   452 sawaal  →  100.0% sahi granth
hint NAHI laga   353 sawaal  →   31.7% sahi granth
```

**SAARTHI abhi lagbhag poori tarah hint-soochi par chal raha hai.** Jahan
user granth ka naam leta hai aur hamara hint use pehchan leta hai, wahan
galti hoti hi nahi. Jahan naam nahi hai, wahan teen me se ek sahi.

Ye 1,250 sawaal jaan-boojhkar granth ka naam lete hain, isliye ye kami
chhup jaati hai. App par aane wala aadmi "Yoga Vasishta mein…" nahi
likhta — wo likhta hai "man kaabu me kaise aaye".

**Us user ke liye hamare paas abhi 31.7% hai.**

---

## 3. AAJ KYA AAZMAYA AUR HATAYA — pool me per-book cap ❌

**Soch:** bina naam wale sawaalon me pool par ek granth chha jaata hai —
`pool=85 → mahabharata 62 (73%)`. Aur unka best rerank score 0.032 tha,
yaani sahi ansh reranker ke saamne aate hi nahi the.

**Tark tha:** "aakhri jawab me kisi granth ke zyada se zyada 3 ansh ja
sakte hain, isliye pool me 62 rakhna bekaar hai — 59 kabhi istemal ho
hi nahi sakte."

**Kiya:** semantic 45→100, aur pool me prati granth 8 ka cap.

**NAAPA GAYA — teenon ank galat taraf gaye:**

```
SAHI     80.0% → 78.9%
ANYA      8.2% →  9.0%
KHAALI   11.8% → 12.2%
Mahabharat        76% → 70%
Shiv Puran Kh.1   74% → 68%
Mantra Maha Sagar 46% → 44%   ← jiske liye kiya tha, wahi gira
```

**Tark me chhed kahan tha:** cap har granth ke pehle 8 ansh **vector ke
kram** se rakhta hai. Par **vector ka kram aur reranker ka kram ek nahi
hote** — jo ansh vector me 30ve number par hai, wo reranker ke liye pehla
ho sakta hai. Cap ne aise ansh us ekmatra bharosemand judge tak pahunchne
se **pehle hi** phenk diye.

Doosri baat (task #21 se judi): rerank ka score **batch-sapeksh** hai.
Pool se kuch bhi hataiye, baaki sabke score hil jaate hain. "Sirf bekaar
hissa hataya" jaisi koi cheez hoti hi nahi.

**Wapas le liya.** Worker phir 45/20/20 par. Wajah worker me tippani me
likhi hai; poora byora `eval-perbook-poolcap-FAIL.json` me (git me nahi,
sirf aapke computer par).

**SEEKH: pool chhedna raasta nahi hai.**

---

## 4. AAJ KI ASLI KAMAI — sahi nidaan

149 KHAALI sawaalon ko kholkar dekha. Do bilkul alag kismein nikli:

```
127 / 149   SHABDKOSH ki kami   (85%)
 22 / 149   KHOJ ki galti       (15%)
```

### A. Shabdkosh ki kami — 127 sawaal

Roman me likhe shabd **Devanagari me badle hi nahi ja rahe**:

```
Kathopanishad:  "Chariot analogy mein senses ka role?"
                granth me रथ hai, sawaal me "Chariot"

Yoga Sutra:     "Viparyaya aur correct knowledge ka difference?"
                granth me विपर्यय hai, sawaal me Roman

Lal Kitab:      "Second house ka sambandh family se?"
                granth me द्वितीय भाव hai, sawaal me "house"

Narsimha Puran: "prahlad", "hiranyakashipu"  →  badle hi nahi
```

Query Devanagari me pahunchne tak usme **koi asli shabd bachta hi nahi**
— isliye `best = 0.000`. FTS ko kuch nahi milta, vector ko kuch nahi.

### JAD MIL GAYI: `TOP_N = 6000`

`scripts/build-lexicon.mjs` corpus ke **sabse aam 6,000 shabd** rakhta hai.

```
shabd            corpus me kram    6,000 me?
प्रह्लाद              13,130        nahi
हिरण्यकशिपु            9,882        nahi
विपर्यय               30,373        nahi
विकल्प                 4,623        HAAN — phir bhi nahi badla
मेरु                   3,418        HAAN — phir bhi nahi badla
```

**Do alag galtiyan:**

1. **6,000 bahut kam hai.** Aur ye ulta hai: aam shabd (`है`, `में`) ko
   lipyantaran ki madad chahiye hi nahi — user unke baare me nahi
   poochta. **Rare shabd — vyakti ke naam, paribhashik shabd — wahi user
   poochta hai, aur wahi soochi se bahar hain.**

2. **`विकल्प` aur `मेरु` seema ke ANDAR hain, phir bhi nahi badle** —
   `fuzzyKey` par takraav hua aur koi zyada aam shabd unki jagah le gaya.
   Wo chupchaap gir jaate hain, kahin koi chetavni nahi.

### B. Khoj ki galti — 22 sawaal

Inme shabd Devanagari me hain, granth me **mile bhi**, phir bhi khaali:

```
Gita: "Shri Krishna ne Arjun ke shok ko kis tarah samjhaya?"
      granth me MILE: श्री, कृष्ण, अर्जुन, समझाया
      phir bhi KHAALI
```

Ye asli retrieval/gate ki kami hai. Iska ilaaj alag hoga.

---

## 5. AAJ MAINE JO GALTIYAN KI

| # | galti | kaise pakdi gayi |
|---|---|---|
| 1 | `topK: 120` — Vectorize ki seema 100 hai | worker 502 diya, 10/10 smoke fail |
| 2 | D1 me 120 bound parameter — seema 100 hai | wahi 502 |
| 3 | **Pool cap ka poora tark** | 1,250 sawaal ki naap |
| 4 | Regex `[^\p{L}\p{N}]` — matra `\p{M}` hoti hai, `\p{L}` nahi. `"कृष्ण"` teen tukdon me toot gaya | jaanch ne 0% mel dikhaya, jo namumkin tha |

Chauthi wali khaas hai: **wahi galti pehle `\b` ke saath ho chuki thi**
(`\b` Devanagari par kaam nahi karta). Devanagari me regex likhte waqt
matra ka dhyan rakhna zaroori hai.

Teesri sabse mehngi thi — 79 minute ki naap. Par **smoke-check ne pehli
do 40 second me pakad li**, isiliye wo 79 minute barbaad nahi hue.

---

## 6. KAL KA KAAM — kram se

### STEP 1 — Naya session token (2 min) 🔴 hamesha pehle

Live app → `F12` → **Console** →

```js
JSON.parse(localStorage.SAARTHI_USER_PROFILE).sessionToken
```

Lambi line chhapegi (`"eyJ...`). Us par **right-click → Copy string
contents**. `.env` me `EVAL_SESSION=` ke aage purana mita kar paste. `Ctrl+S`.

⚠️ Ye aapke account ki chaabi hai — screenshot me kisi ko mat bhejiye.

---

### STEP 2 — Lexicon 6,000 → 25,000 (5 min) 🔴 aaj ka asli agla kadam

**Iski sabse achhi baat: koi deploy nahi chahiye.** Lipyantaran client par
hota hai (`translit.js`), worker par nahi — aur naap wali script wahi file
seedha import karti hai. **Na Netlify, na Cloudflare.**

`scripts/build-lexicon.mjs` me line 39:

```js
const TOP_N   = 6000;    →    const TOP_N   = 25000;
```

Phir:

```powershell
npm run embed:lexicon
```

**Jaanch — ye shabd ab badalne chahiye:**

```powershell
node --input-type=module -e "const T=await import('./src/knowledge/translit.js'); for(const w of ['prahlad','hiranyakashipu','viparyaya','vikalpa','meru','chariot']) console.log(w.padEnd(18), T.toDevanagari(w))"
```

`prahlad → प्रह्लाद` aur `hiranyakashipu → हिरण्यकशिपु` aana chahiye.
`viparyaya` (kram 30,373) **nahi** aayega — wo 25,000 se bahar hai.
`chariot` bhi nahi (wo angrezi hai, alag mamla — STEP 4).

---

### STEP 3 — Poori naap, aur faisla (80 min) 🔴

```powershell
node scripts/19_eval_perbook.mjs --naya-shuru
```

**Kasauti — pehle se tay:**

| natija | matlab | kya karna |
|---|---|---|
| SAHI **81% se upar** | nidaan sahi | aage badho — bundle ka behtar hal sochenge |
| SAHI **80.2 ± 0.5%** | koi faayda nahi | `TOP_N` wapas 6,000, doosra raasta |
| **ANYA badha** | nuksaan | turant wapas |

⚠️ **`0.5%` se chhota badlav sudhaar nahi mana jaayega.** Aaj naapa gaya:
ek hi cheez do baar chalane par ank ~0.3% hilta hai (80.0 vs 80.2, 8.2 vs
7.9). Ye rerank ke batch-sapeksh hone ka shor hai. Usse chhota kuch bhi
sach nahi mana ja sakta.

---

### STEP 4 — Agar STEP 3 kaam kare 🟡

**4a. Bundle ka asli hal.** 25,000 shabd se `lexicon.js` ~704 KB ho jaati
hai (gzip ~197 KB), aur ye har user ke browser me jaati hai. Behtar
raasta: **poora 113,000 wala lexicon D1 me daalo**, aur worker se sirf
query ke 3-5 anjaan shabd poochho. Bundle bilkul nahi badhega. Ye bada
badlav hai — pehle STEP 3 se nidaan pakka karna zaroori hai.

**4b. `fuzzyKey` ka takraav.** `विकल्प` aur `मेरु` seema ke andar hokar
bhi gir gaye. `build-lexicon.mjs` takraav par zyada aam shabd rakhta hai
aur doosra chupchaap chhod deta hai. Kam se kam wo chetavni to de.

**4c. Angrezi shabd** (`chariot → रथ`, `house → भाव`, `senses → इन्द्रियाँ`).
Ye lexicon se hal nahi honge — `EN_CONCEPT` me jodne padenge. Par pehle
ginna hoga ki kitne sawaal sirf isi wajah se fail hain.

---

### STEP 5 — Wo 22 "khoj ki galti" wale sawaal 🟡

Ye lexicon se theek **nahi** honge. Inme shabd sahi hain, granth me mile
bhi, phir bhi khaali. Sabse saaf namoona:

```
Gita: "Shri Krishna ne Arjun ke shok ko kis tarah samjhaya?"
```

`eval-perbook.json` me un 22 ke `best` score dekhiye, aur
`scripts/13_probe_rerank.mjs` se jaanchiye ki wahi ansh alag se score
karne par kya paate hain. **Pool mat chhediye** — aaj wo aazmaya ja chuka
hai (#3).

---

## 7. AB BHI PENDING (purane)

| # | kya |
|---|---|
| — | **Jawab ki gunvatta / GPT se tulna** — prompt me dhaancha, udaharan, nichod. ⚠️ Pehle retrieval sudhre, warna model bharti karega ya gadhega |
| 25 | Bina naam wale sawaal — Atharvaveda / Guru Granth / Nitya Karm Pooja topic-sawaal par khaali |
| 20 | Ramcharitmanas reranker par Mahabharat se 4 guna peeche |
| 21 | Rerank ka score batch-sapeksh — **aaj ye poori tarah pakka ho gaya** (pool badalte hi sab hila) |
| 19 | Mahabharat ki PDF `public/books/` me nahi (23 PDF, 24 granth) |
| 10 | Read section: download band, sirf padhna |
| — | 59 MB `vectors_int8.bin` + 258 MB `public/knowledge/` abhi bhi deploy ho rahe hain |

---

## 8. NIYAM JO TAY HO CHUKE HAIN

1. **Sabse sasti jaanch pehle, bada badlav baad me.** Aaj pool cap ne 79
   minute liye aur bigaad gaya. Lexicon wali jaanch 5 minute me ho jaati
   hai aur usme deploy bhi nahi chahiye.

2. **Har worker badlav ke baad `17_smoke_check.mjs`** (40 second). Aaj
   isne do galtiyan pakdi.

3. **0.5% se chhota badlav sudhaar nahi hai** — naap ka apna shor 0.3%
   hai.

4. **Retrieval/gate ka kaam 12 granth par, 13 ko chhuenge nahi.** Hint me
   saaf niyam hai ("naam liya hai to wahi granth"), wahan tuning ghus nahi
   sakti. Threshold aur score me aisa koi niyam nahi — wahin tuning chupke
   se ghusti hai.

5. **Naap sirf ye na dekhe ki "koi Aadhaar mila"** — dekhe ki **sahi**
   granth mila. `19_eval_perbook.mjs` yahi karta hai; purani
   `14_eval_search.mjs` nahi karti thi.
