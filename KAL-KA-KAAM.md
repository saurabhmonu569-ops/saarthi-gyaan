# कल का काम — 12 Aug 2026

Aaj (11 Aug) ka kaam poora ho chuka hai aur commit ho gaya hai. Ye file
sirf ye batati hai ki **kal kahan se shuru karna hai**.

---

## Aaj kya hua — ek nazar me

| | |
|---|---|
| Granth | **24** (25 chaabi — Shiv Puran do khand me) |
| D1 / FTS | 57,484 / 57,484 — poora mel |
| Har granth apne naam par milta hai | **25/25** |
| Control par jhoothi citation | **0/38** ✅ |
| 298 purane sawaal | 95.3% (pehle 96.0%) |
| 392 naye sawaal | 93.4%, hinted **340/340** sahi |
| Yogasutra ke 13 sawaal | **13/13** (100%) |
| Unit test | **103/103** |

Char asli galtiyan pakdi gayin — **teen naap ne pakdi, andaaze ne nahi**:

1. **Baasi chunk files** — `nitya_karm_pooja` ki 15 purani files disk par
   padi thi. `03_embed_build` directory ko glob karta tha, isliye wo bhi
   utha leta tha; unke panne aaj ke ansh se takra gaye aur D1 ke
   `INSERT OR REPLACE` ne **14 sahi ansh mita diye**.
   Ilaaj: `02_chunk` ab purani files mitata hai, `03_embed_build` ab
   `book_chunk_index.json` se padhta hai.

2. **Char aam-shabd hint hataye** — `upay`, `agni`, `mantra`/`मंत्र`,
   `upanishad`. Ye granth ke naam nahi, rozmarra ke shabd the:
   - `"krodh ko jeetne ka upay kya hai"` → **lal_kitab** (jyotish!)
   - `"Rigveda me Agni ko itna mahatva kyun"` → **agni_purana**
   - `"Chandogya me Shvetaketu"` → **ishadi_upanishad**

   Ye sirf "thoda galat granth" nahi tha: worker hinted granth ko
   score-gate se **chhoot** deta hai (`HINTED_PAKKA=2`), isliye galat
   granth ke 2 ansh **pakke** Aadhaar me chadh jaate the.

3. **`mantra_maha_sagar` ka naam-hint tha hi nahi** — sirf wo aam shabd.
   Hatane par uska darwaza band ho jaata, isliye poora naam joda.

4. **Yogasutra ko maine `open` likh diya tha** — ye **unit test ne pakda**,
   aur test sahi tha. Khula hona mool paath par nahi, **is sanskaran** par
   tay hota hai. Ab band hai.

---

## 🔴 KAL — sabse pehle ye

### 1. Naya session token lein (2 minute — baaki sab isi par tika hai)

**Problem:** aaj ka token beech me khatam ho gaya. Bina token seema
20 sawaal/minute ho jaati hai — 392 sawaalon ki naap me **17 minute sirf
rukne me chale gaye**.

**Karna:** live app kholiye → `F12` → Console →

```js
copy(JSON.parse(localStorage.SAARTHI_USER_PROFILE).sessionToken)
```

`.env` me `EVAL_SESSION=` ke aage paste kijiye (bas token, dobara
`EVAL_SESSION=` mat likhiye — wo galti pehle ho chuki hai).

**Result:** naap chalate waqt `owner token theek — … seema se chhoot`
dikhega, aur `⏸ raftaar-seema` waali line nahi aayegi.

---

### 2. `mantra` hint wapas laiye — par sirf sadhana wale roop me (~15 min)

**Ye jaanch ho chuki hai (11 Aug shaam).** `hint_hataye` set — 68 wo sawaal
jinpar aaj hint hataya gaya — chalaya: **60/68 pass, 8 fail**. Aur aatho
failures ek hi kism ke nikle:

```
Upanishads me "neti neti" ka meaning
Upanishadic teachings me rituals se realization
Daily devta puja me mantra ke saath dhyan ka purpose
Mantra jap me mala ke 108 beads ka significance
Mantra jap ke samay count maintain karna kyu zaroori
Kya har mantra ka jap bina guru ke kiya ja sakta hai
Kisi mantra ko kitni baar japna chahiye
Mantra sadhana me brahmacharya aur diet discipline kyu
```

**Sabme granth ka naam nahi hai, aur 6 seedhe mantra-sadhana ke hain.**

Maine tab kaha tha ki ye failures "sudhaar" hain. **`upay` ke mamle me wo
sach tha** — "krodh ka upay" ka jyotish se koi lena-dena nahi, aur ab wo
theek se khaali lautta hai. **Par `mantra` ke mamle me wo galat tha.**
"Mantra jap me 108 mala ka mahatva" ke liye Mantra Maha Sagar sach me
sahi granth hai; wahan purana hint theek kaam kar raha tha.

Ek hi kaant-chhaant ne do ulte kaam kiye: Ved wale sawaal bachaye
(`"Samaveda ke mantron ka purpose"` ab samaveda par jaata hai), aur
sadhana wale tod diye.

**Karna:** `src/knowledge/bookHints.js` me `mantra_maha_sagar` ke liye
sirf SADHANA wale roop jodiye — poora `mantra` shabd nahi:

```
"mantra jap", "mantra sadhana", "mantra siddhi", "purashcharan",
"nyasa", "viniyoga", "beej mantra", "kavach mantra", "mala jap",
"मंत्र जप", "मन्त्र जप", "मंत्र साधना", "पुरश्चरण", "न्यास", "विनियोग"
```

Ye shabd Samaveda/Atharvaveda ke sawaalon me **kabhi nahi aate**, isliye
dono cheezein saath chal sakti hain.

**Result check — dono taraf dekhna zaroori hai:**
```powershell
node scripts/14_eval_search.mjs --set hint_hataye
```
- 60/68 se badhkar **66/68** ke aas-paas aana chahiye
- **aur** ye abhi bhi sahi rehna chahiye (warna faayda nahi):
  `"Samaveda ke mantron ka purpose"` → samaveda,
  `"Atharvaveda me raksha ke mantra"` → atharvaveda_1
- `npm test` — `bookHints.test.js` me "aam shabd par hint NAHI lagta"
  wala test abhi bhi hara rehna chahiye

Bache hue 2 (`neti neti`, `Upanishadic teachings`) hint se theek nahi
honge — `neti neti` Brihadaranyaka ka hai jo hamare paas hai hi nahi, aur
doosra gate ka mamla hai (neeche #5 dekhiye).

---

### 2b. (ho chuka) Wo 6 nayi failures — sudhaar hain ya kami?

**Problem:** 381 sawaalon par pehle 20 fail the, ab **26**. Naye 11
Yogasutra sawaal sab pass hue, isliye ye 6 unhi purane sawaalon par hain
— aur lagbhag zaroor aaj ke hint hatane se aayi hain.

**Par ye "fail" shayad sudhaar hai.** Ye naap sirf itna dekhti hai ki
"koi Aadhaar mila ya nahi" — **ye nahi dekhti ki SAHI granth mila ya
nahi**. Pehle `upay` wala sawaal Lal Kitab se 2 pakke ansh utha laata tha
aur "pass" gina jaata tha, jabki jawab jyotish ki kitab se aa raha tha.
Ab wo khaali lautta hai — ginti me bura, sach me behtar.

**Ye maan-kar mat chaliye. Jaanchiye:**

```powershell
node -e "const q=require('./scripts/eval-questions.json');const y=q.naye_granth.filter(x=>/\bupay\b|\bagni\b|\bmantra|upanishad/i.test(x));q.hint_hataye=y;require('fs').writeFileSync('./scripts/eval-questions.json',JSON.stringify(q,null,1));console.log(y.length+' sawaal');y.forEach((x,i)=>console.log(' '+(i+1)+'. '+x))"
```

```powershell
node scripts/14_eval_search.mjs --set hint_hataye
```

**Result kaise padhein:**
- Failures **isi soochi se** nikle → baat pakki, wo pehle galat granth se
  "pass" ho rahe the. Kuch ulatna nahi hai; naapne ka tareeka sudharna hai
  (neeche #4).
- Failures **kahin aur se** nikle → wajah kuch aur hai, aur uske peeche
  jaana hoga. `eval-naye_granth.json` me har sawaal ka `hinted` aur `best`
  likha hai.

---

## 🟡 PHIR — ye teen, isi kram me

### 3. Rerank har baar timeout par baith raha hai

**Problem naapa gaya:** har set me rerank ka p90 **thik 4000ms** hai —
yaani `RERANK_TIMEOUT_MS` par baitha hai. Yogasutra wale set me to
**beech ka** hi 3002ms tha.

Matlab har das me se ek sawaal me kuch rerank-batch **chhod diye jaate
hain**, aur chunav adhoore pool par hota hai. Ye 93-95% ka ek hissa ho
sakta hai — aur ye har jagah barabar nahi girta, isliye ank bhatakta hai.

**Karna:** `deploy/cloudflare-worker.js` me `lap()` ki ginti se dekhiye ki
kaunsa batch dheema hai; batch chhota karna ya `SEARCH_QUOTA` ghatana
aazmaiye. Har badlav ke baad `17_smoke_check.mjs` (40 second).

---

### 4. Naapne ka tareeka sakht kariye — "koi Aadhaar" se "SAHI Aadhaar"

**Problem:** aaj ki sabse badi seema. `14_eval_search.mjs` sirf ye ginta
hai ki Aadhaar mila ya nahi. Gita ka sawaal Ramcharitmanas se jawab paaye
to wo bhi "pass" hai. Isi wajah se #2 wala sawaal uthana pada.

`18_book_check.mjs` me sahi kasauti pehle se hai (`books.includes(id)`) —
wahi 500/1200 wali list par laani hai.

**Aapki per-book 50-50 wali list yahi cheez theek karti hai.** Uske liye:
- file ka roop: har granth ke 50 sawaalon se pehle `## bhagavad_gita_shankar`
- **aadhe sawaal kabhi mat chhuiye** — 298 wala set ab "yaad kiya hua" ban
  chuka hai (har fail dekhkar sudhaar kiya gaya). 1,200 me se 600 par
  sudhaar, 600 ko haath mat lagaiye. Wahi asli aaina rahega.
- pehle **2 granth (100 sawaal)** chalaiye — wo script aur file ke roop ki
  jaanch hai, granth ki nahi

Script (`16_split_per_book.mjs`) main bana dunga jab list taiyaar ho.

---

### 5. Bina naam wale sawaal — teen granth khaali lautte hain

**Naapa gaya** (`18_book_check.mjs` ka VISHAY-wala khaana):

```
Atharvaveda       "rog nivaran ke vaidik upchar kya hain"    → khaali
Guru Granth Sahib "haumai kaise dukh ka karan banti hai"     → khaali
Nitya Karm Pooja  "pooja me kaunse patra pushp varjit hain"  → khaali
```

Teeno **naam dene par theek milte hain** — yaani ansh corpus me hain,
galti gate/rerank ki hai. Aur asli user prayah granth ka naam leta hi
nahi; wo seedha "haumai kya hai" poochta hai. **Ye seedha uski takleef
hai.**

---

## 🟢 BAAD ME — jo abhi rok sakte hain

- **#19** Mahabharata ki PDF `public/books/` me nahi hai (23 PDF, 24 granth)
- **#20** Ramcharitmanas reranker par Mahabharat se 4 guna peeche — naapa hua
- **#21** Rerank ka score **batch-sapeksh** hai — ek hi ansh ko alag saathi
  milne par alag score milta hai. Isse gate ki poori maanyata kamzor hoti hai
- **#10** Read section: download band, sirf padhna
- 59 MB `vectors_int8.bin` aur 258 MB `public/knowledge/` abhi bhi deploy
  ho rahe hain, jabki P2 ke baad client inhe padhta hi nahi

---

## Aaj banayi nayi cheezein (kal kaam aayengi)

| script | kya karti hai | samay |
|---|---|---|
| `17_smoke_check.mjs` | 10 sawaal — pipeline zinda hai ya nahi | 40 sec |
| `18_book_check.mjs` | **har granth** se 2 sawaal + bahar ke | 4 min |
| `14_eval_search.mjs` | ab **checkpoint** hai — toota to wahin se aage | — |
| | ab **fail hue sawaal naam se** chhapte hain | — |
| | nateeja **hamesha** `eval-<set>.json` me | — |
| `--books` chhanni | `embed-corpus`, `11_upload`, `12_load_d1` — sirf naya granth | — |

**Sabak jo aaj teen baar dohraya gaya:** har naye granth ke baad
`18_book_check.mjs` chalaiye. Aaj tak jitni bhi galtiyan chupi rahi, wo
isliye chupi rahi ki kahin koi error nahi aata tha — sirf ginti me farak
dikhta tha.
