# SAARTHI GYAAN — Checklist, 11 Aug 2026

Har baat naapi hui hai. Jahan naap nahi hai, wahan saaf likha hai "abhi nahi naapa".

---

## 1. ABHI KYA HAALAT HAI (naapa hua)

| Cheez | Ank | Theek? |
|---|---|---|
| Granth | **24** (25 chaabi — Shiv Puran 2 khand) | ✅ |
| D1 me ansh | 57,484 | ✅ |
| FTS index | 57,484 (D1 se poora mel) | ✅ |
| Vectorize | 57,484 vector chadhe | ✅ |
| **Har granth apne naam par milta hai** | **25/25** | ✅ |
| **Control par jhoothi citation** | **0/38** | ✅ |
| Hinted granth sahi aata hai | 340/340 | ✅ |
| Unit test | 103/103 | ✅ |
| 298 purane sawaal (Aadhaar mila) | 95.3% | ⚠️ pehle 96.0% |
| 392 naye sawaal (Aadhaar mila) | 93.4% | ⚠️ |
| Yogasutra ke 13 sawaal | 13/13 (100%) | ✅ |
| Raftaar — beech ka | 2.4–3.8 sec | ⚠️ |
| Raftaar — p90 | 5.4–6.6 sec | ❌ dheema |

---

## 2. AAJ KYA THEEK KIYA

### 2.1 Naya granth — Patanjali Yogasutra (24va)

- 82 panne OCR (`--force-ocr` — text-layer kachra tha, tootna 0.56)
- 160 ansh, tootna 0.313, Latin kachra 0
- Vectorize + D1 dono par chadh gaya
- **Naap:** 13/13 sawaal, hinted 13/13 sahi

**Kyun jodi:** 298 sawaalon me jo fail the, wo lagbhag saare **man aur
vichaar** ke the. Baaki 23 granth *kya karna chahiye* batate hain; ye
*kaise karna hai* batata hai.

### 2.2 Baasi chunk files — 14 ansh chupchaap mit rahe the ❗

**Galti kya thi:** `02_chunk.py` dobara chalne par purani `chunk_*.json`
files mitata nahi tha. `nitya_karm_pooja` pehle 423 ansh me chunk hui thi,
baad me 408 me — 15 purani files disk par pad gayi. `03_embed_build.py`
directory ko `glob` karta tha (index nahi padhta tha), isliye wo 15 baasi
files bhi utha leta tha. Unke panne (383-396) aaj ke ansh se takra gaye,
aur D1 ke `INSERT OR REPLACE` ne **baasi paath rakh kar 14 sahi ansh mita
diye**.

**Sabse bura pehlu:** kahin koi error nahi aata tha. Sirf ginti me 14 ka
farak dikhta tha.

**Ilaaj:**
- `02_chunk.py` ab dobara chunk karne se pehle purani files mitata hai
- `03_embed_build.py` ab `book_chunk_index.json` se padhta hai, aur antar
  mile to chetavni chhaapta hai
- `make_chunk_id` me doosri parat: takraav par `#2` lagta hai (purani id
  nahi badalti)

**Jaanch:** baaki 24 granth me `disk == index`, sirf isme antar tha.

### 2.3 Char aam-shabd hint hataye ❗

Ye granth ke naam nahi the, rozmarra ke shabd the:

| hint | kya kar raha tha |
|---|---|
| `upay` | `"krodh ko jeetne ka upay kya hai"` → **lal_kitab** (jyotish) |
| `agni` | `"Rigveda me Agni ko itna mahatva kyun"` → **agni_purana** |
| `mantra` | `"Samaveda ke mantron ka purpose"` → **mantra_maha_sagar** |
| `upanishad` | `"Chandogya me Shvetaketu"` → **ishadi_upanishad** |

**Ye sirf "thoda galat granth" nahi tha.** Worker hinted granth ko
score-gate se **chhoot** deta hai (`HINTED_PAKKA = 2`), isliye galat
granth ke 2 ansh **pakke** Aadhaar me chadh jaate the — mel ho ya na ho.

**Naap:** 18 aam sawaalon par 7 seedhe jyotish ki kitab par ja rahe the.
Hatane ke baad 0.

### 2.4 Baaki

| kya | kyun |
|---|---|
| `mantra_maha_sagar` ka naam-hint joda | uske paas naam wala **koi** hint tha hi nahi — sirf wo aam shabd |
| Yogasutra `open` → `restricted` | **unit test ne pakda**, aur test sahi tha — khula hona mool paath par nahi, is sanskaran par tay hota hai |
| `gemini.js` me granth ginti 25 → 24 | prompt me "Shiva Purana Khand 1, Khand 2" alag likhe ja rahe the; user ke liye wo ek kitab hai |
| `--books` chhanni 3 script me | 160 naye ansh ke liye poore 57,499 embed karne padte the (2 ghante, ~27,000 neuron). Ab 6 second, 74 neuron |
| `15_split_questions` | Yogasutra "hamare paas nahi" wali list se hataya — 11 sawaal `bahar` se `granth` me |

### 2.5 Nayi jaanch ke auzaar

| script | kya karta hai | samay |
|---|---|---|
| `17_smoke_check.mjs` | 10 sawaal — pipeline zinda hai ya nahi | 40 sec |
| `18_book_check.mjs` | **har granth** se 2 sawaal + bahar ke 5 | 4 min |
| `14_eval_search.mjs` | ab **checkpoint** — toota run wahin se aage | — |
| | ab **fail hue sawaal naam se** chhapte hain | — |
| | nateeja **hamesha** `eval-<set>.json` me | — |

---

## 3. KYA GALAT HAI ABHI (pending)

### 🔴 3.1 `mantra` hint hatane se 6 sadhana sawaal toote

**Naapa hua** (`hint_hataye` set, 68 sawaal → 60 pass, 8 fail). Aatho
failures me **granth ka naam nahi hai**, aur 6 seedhe mantra-sadhana ke:

```
Mantra jap me mala ke 108 beads ka significance
Mantra jap ke samay count maintain karna kyu zaroori
Kya har mantra ka jap bina guru ke kiya ja sakta hai
Kisi mantra ko kitni baar japna chahiye
Mantra sadhana me brahmacharya aur diet discipline kyu
Daily devta puja me mantra ke saath dhyan ka purpose
```

**`upay` hatana sahi tha** — "krodh ka upay" ka jyotish se koi lena-dena
nahi. **`mantra` poora hatana galat tha** — "108 mala ka mahatva" ke liye
Mantra Maha Sagar sach me sahi granth hai.

Ek hi kaant-chhaant ne do ulte kaam kiye: Ved wale sawaal bachaye, sadhana
wale tod diye.

### 🔴 3.2 Naapne ka tareeka hi kamzor hai

`14_eval_search.mjs` sirf ginta hai ki **"koi Aadhaar mila"**. Ye **nahi**
dekhta ki **sahi granth mila**. Gita ka sawaal Ramcharitmanas se jawab
paaye to wo bhi "pass" hai.

Isi wajah se 93.4% ka matlab poori tarah saaf nahi hai. `18_book_check.mjs`
me sahi kasauti hai (`books.includes(id)`), par wo sirf 25 sawaal par
chalti hai.

### 🟡 3.3 Rerank har baar timeout par baith raha hai

Har set me rerank ka p90 **thik 4000ms** — yaani `RERANK_TIMEOUT_MS` par
baitha hai. Yogasutra wale set me **beech ka** hi 3002ms tha.

Matlab har das me se ek sawaal me kuch rerank-batch **chhod diye jaate
hain**, aur chunav adhoore pool par hota hai. Ye 93-95% ka ek hissa ho
sakta hai — aur ye har jagah barabar nahi girta, isliye ank bhatakta hai.

### 🟡 3.4 Bina naam wale sawaal — 3 granth khaali lautte hain

`18_book_check.mjs` ka VISHAY-wala khaana:

```
Atharvaveda       "rog nivaran ke vaidik upchar kya hain"    → khaali
Guru Granth Sahib "haumai kaise dukh ka karan banti hai"     → khaali
Nitya Karm Pooja  "pooja me kaunse patra pushp varjit hain"  → khaali
```

Teeno **naam dene par theek milte hain** — ansh corpus me hain, galti
gate/rerank ki hai. Aur asli user granth ka naam leta hi nahi.

### 🟢 3.5 Purane, jo abhi rok sakte hain

| # | kya |
|---|---|
| 19 | Mahabharata ki PDF `public/books/` me nahi (23 PDF, 24 granth) |
| 20 | Ramcharitmanas reranker par Mahabharat se 4 guna peeche — naapa hua |
| 21 | Rerank ka score **batch-sapeksh** hai — ek hi ansh ko alag saathi milne par alag score. Gate ki poori maanyata isse kamzor hoti hai |
| 10 | Read section: download band, sirf padhna |
| — | 59 MB `vectors_int8.bin` + 258 MB `public/knowledge/` abhi bhi deploy ho rahe hain, jabki P2 ke baad client inhe padhta hi nahi |

---

## 4. KAL KA KAAM — kram se

### STEP 1 — Naya session token (2 min) 🔴 sabse pehle

**Kyun:** aaj token beech me khatam ho gaya. Bina token seema 20
sawaal/minute — 392 sawaalon me **17 minute sirf rukne me** gaye. Wahi
slowness thi.

Live app → `F12` → Console →

```js
copy(JSON.parse(localStorage.SAARTHI_USER_PROFILE).sessionToken)
```

`.env` me `EVAL_SESSION=` ke aage paste (bas token — dobara
`EVAL_SESSION=` mat likhiye, wo galti pehle ho chuki hai).

**Result:** naap chalate waqt `owner token theek — … seema se chhoot`
dikhega, `⏸ raftaar-seema` nahi aayegi.

---

### STEP 2 — `mantra` hint sadhana-roop me wapas (15 min) 🔴

`src/knowledge/bookHints.js` me `mantra_maha_sagar` ke liye **sirf sadhana
wale roop** jodiye — poora `mantra` shabd **nahi**:

```
"mantra jap", "mantra sadhana", "mantra siddhi", "mala jap",
"purashcharan", "nyasa", "viniyoga", "beej mantra", "kavach mantra",
"मंत्र जप", "मन्त्र जप", "मंत्र साधना", "पुरश्चरण", "न्यास", "विनियोग"
```

Ye shabd Samaveda/Atharvaveda ke sawaalon me **kabhi nahi aate**, isliye
dono cheezein saath chal sakti hain.

---

### STEP 3 — Dono taraf jaanchiye (5 min) 🔴

```powershell
node scripts/14_eval_search.mjs --set hint_hataye
```

Teeno dekhna zaroori hai — sirf pehla dekhna adhoora hai:

- [ ] 60/68 se badhkar **~66/68**
- [ ] `"Samaveda ke mantron ka purpose"` → **samaveda** (na ki mantra_maha_sagar)
- [ ] `"Atharvaveda me raksha ke mantra"` → **atharvaveda_1**

```powershell
npm test
```

- [ ] 103/103 — khaas kar `"aam shabd par hint NAHI lagta"` wala test

Bache hue 2 (`neti neti`, `Upanishadic teachings`) hint se theek **nahi**
honge — `neti neti` Brihadaranyaka ka hai jo hamare paas hai hi nahi.

---

### STEP 4 — Rerank ka timeout (30-45 min) 🟡

`deploy/cloudflare-worker.js` me `lap()` ki ginti se dekhiye kaunsa batch
dheema hai. Aazmaiye: batch chhota karna, ya `SEARCH_QUOTA` (45/20/20)
ghatana.

Har badlav ke baad:

```powershell
node scripts/17_smoke_check.mjs
```

- [ ] rerank ka p90 4000ms se **neeche** aaye (yaani timeout par na baithe)
- [ ] 10/10 abhi bhi hara

---

### STEP 5 — Wo 3 granth jo bina naam ke khaali lautte hain (1 ghanta) 🟡

```powershell
node scripts/18_book_check.mjs
```

- [ ] VISHAY-wale khaane me Atharvaveda / Guru Granth Sahib /
      Nitya Karm Pooja `(khaali)` na dikhein
- [ ] NAAM-wale abhi bhi **25/25**
- [ ] BAHAR sakht abhi bhi **3/3**

---

### STEP 6 — Per-book 50-50 wali list 🟢 (asli kaam)

Ye #3.2 ko theek karti hai — "koi Aadhaar" se "**sahi** Aadhaar".

**File ka roop:** har granth ke 50 sawaalon se pehle ek line —
`## bhagavad_gita_shankar` (Roman naam wahi jo `bookMeta` me hai).

**Chalane ka kram:**

1. [ ] pehle **2 granth (100 sawaal)** — ye script aur file ke roop ki
       jaanch hai, granth ki nahi
2. [ ] phir baaki. 1,200 sawaal ~60 minute, quota par nazar
3. [ ] **600 par sudhaar kariye, 600 ko kabhi haath mat lagaiye**

**Teesra point sabse zaroori hai.** 298 wala set ab "yaad kiya hua" ban
chuka hai — har fail dekhkar sudhaar kiya gaya, isliye uska 95.3% thoda
jhootha hai. 1,200 me se aadhe chhoot gaye to wahi haal hoga aur phir koi
sacha aaina nahi bachega.

Split-script (`16_split_per_book.mjs`) list aate hi bana dunga.

---

## 5. EK SABAK

Aaj char asli galtiyan mili. **Teen naap ne pakdi, aur maine unme se teen
baar galat wajah bataayi thi:**

| maine kaha | asli baat |
|---|---|
| "14 ansh khaali paath ke hain" | khaali koi nahi tha |
| "us granth me panne dohre hain" | panne dohre nahi the — 15 **baasi files** thi |
| "ye asli app ki galti hai" (Roman → Devanagari) | app theek thi; **meri jaanch-script** me `normalizeQueryForSearch` chhoot gaya tha |
| "11 me se 6 Yogasutra sawaal fail hue" | sab 13 pass the; meri ginti galat thi |
| "wo 6 failures sudhaar hain" | `upay` ke liye sach, **`mantra` ke liye galat** |

**Isliye:** har naye granth ke baad `18_book_check.mjs` chalaiye (4 min).
Aaj tak jitni galtiyan chupi rahi, wo isliye chupi rahi ki **kahin koi
error nahi aata tha** — sirf ginti me farak dikhta tha.
