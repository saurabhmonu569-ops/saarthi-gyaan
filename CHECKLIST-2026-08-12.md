# SAARTHI GYAAN — Checklist, 12 Aug 2026

Har ank naapa hua hai. Jahan naap nahi, wahan saaf likha hai.

---

## 1. AAJ KA SABSE BADA BADLAV — naapne ka tareeka

Kal tak hamari naap sirf ye ginti thi ki **"koi Aadhaar mila"**. Wo ye
**nahi** dekhti thi ki **sahi granth mila**. Gita ka sawaal Ramcharitmanas
se jawab paaye — wo bhi "pass".

Aaj `19_eval_perbook.mjs` bana, jo **teen alag natije** deta hai:

| | matlab |
|---|---|
| **SAHI** | jo granth chahiye tha, wahi mila — asli pass |
| **ANYA** | Aadhaar mila, par **kisi aur granth ka** — purani naap ise pass ginti thi |
| **KHAALI** | koi Aadhaar nahi |

**ANYA sabse khatarnak hai.** User ko jawab bhi milta hai aur granth ka
naam bhi — par naam galat. Galat Aadhaar, koi Aadhaar na hone se bura hai,
kyunki wahi ek cheez hai jispar GPT par hamari poori jeet tiki hai.

---

## 2. AAJ KE ANK — 1,250 sawaal (25 granth × 50)

| | baseline (subah) | ab | |
|---|---|---|---|
| **SAHI** | 77.1% | **80.0%** | +36 sawaal |
| **ANYA** | 8.8% | **8.2%** | ghata ✅ |
| **KHAALI** | 14.1% | **11.8%** | ghata ✅ |
| purana tareeka hota to | 85.9% | 88.2% | — |

**Dono ghatna zaroori tha.** Sirf SAHI badhna kaafi nahi hota — agar ANYA
badh jaata to matlab hum ek galti ki jagah doosri kar rahe hain.

### Granth-vaar

| granth | subah | ab |
|---|---|---|
| Agni Puran | 100% | 100% ✅ |
| Atharvaveda | 100% | 100% ✅ |
| Chanakya Neeti | 98% | 98% ✅ |
| Samaveda / Yajurveda | 98% | 98% ✅ |
| Ekadashi | 96% | 96% ✅ |
| Garud Puran | 92% | 92% ✅ |
| Ramcharitmanas | 90% | 90% ✅ |
| Rigveda / Rashi-Muhurt | 88% | 88% |
| **Yoga Vasishtha** | **12%** | **74%** ← +62 |
| Kathopanishad | 78% | 78% |
| Vishnu Puran / Mahabharat / Ishadi | 76% | 76% |
| Shiv Puran Khand 1 | 70% | 74% |
| Shiv Puran Khand 2 | 68% | 72% |
| Lal Kitab | 72% | 72% |
| Guru Granth Sahib | 72% | 70% |
| Narsimha Puran | 70% | 70% |
| **Patanjali Yoga Sutra** | 66% | **68%** 🔴 |
| **Bhavishya Puran** | 68% | **68%** 🔴 |
| **Gita** | 66% | **66%** 🔴 |
| **Nitya Karm Pooja** | 66% | **66%** 🔴 |
| **Mantra Maha Sagar** | 44% | **46%** 🔴 |

---

## 3. SABSE ZAROORI BAAT JO AAJ NAAPI GAYI

```
hint SAHI laga   452 sawaal  →  100.0% sahi granth
hint NAHI laga   283 sawaal  →   29.3% sahi granth
```

**SAARTHI abhi lagbhag poori tarah hint-soochi par chal raha hai.** Jahan
hint lagta hai, galti hoti hi nahi — 452 me se 452. Jahan nahi lagta,
das me se sirf teen sahi.

Ye ank do baatein kehta hai:

1. **Turant faayda hint ke chhed bharne me hai** — aaj ka +2.9% wahi tha.
2. **Par asli kami retrieval me hai.** Ye 1,250 sawaal jaan-boojhkar granth
   ka naam lete hain, isliye kami chhup jaati hai. App par aane wala aadmi
   "Yoga Vasishta mein…" nahi likhta — wo likhta hai "man kaabu me kaise
   aaye". Uske liye hamare paas 29.3% hai.

---

## 4. AAJ KYA THEEK KIYA

### 4.1 Yoga Vasishtha — ek `h` se 50 me se 49 sawaal chhoot rahe the

```
hamara hint : "yoga vasishtha"   (t-h-a)
sawaal me   : "Yoga Vasishta"    (t-a)
```

Milaan seedha substring hai. **12% → 74%.**

Ab `sh`/`s`, `th`/`t`, `v`/`w` — teenon aam farak ke roop hain, aur akela
`vasishtha` bhi (kyunki sawaal aksar "Vasishta ji Ram ko kya samjhate
hain" jaisa hota hai).

### 4.2 `maharamayan` ka jaal — granth ka apna naam use galat kitab par le ja raha tha

```
"Yoga Vasishtha MAHARAMAYANA"  →  ramcharitmanas
```

`maha-**ramayan**-a` ke andar `ramayan` chhupa hai, aur uska hint
Ramcharitmanas hai. Ab `maharamayan` us hint se **pehle** hai.

### 4.3 Shiv Puran Khand 2 ka sawaal Khand 1 par ja raha tha

```
"shiva puran khand 2"  →  shiva_purana_1
```

Hamara hint `"shiv puran khand 2"` tha (`shiv`, `shiva` nahi). `shiva`
likhne par wo chook jaata aur generic `"shiv puran"` use Khand 1 par bhej
deta.

### 4.4 Hindi ka bahuvachan — `mantra` → `mantron`

```
hint    "beej mantra"
sawaal  "Beej mantroN ko powerful kyun maana jata hai?"
```

Ab mool roop (`beej mantr`) rakha hai, jo dono me hai.

### 4.5 Naye auzaar

| script | kya karta hai | samay |
|---|---|---|
| `16_pdf_to_perbook.py` | PDF se per-book sawaal nikalta hai. Ligature (`ti`, `tt`, `tti`, `ft`) theek karta hai — bina iske "Chitta Vritti" → "Chia Vri" ban jaata tha | 1 min |
| `19_eval_perbook.mjs` | **SAHI / ANYA / KHAALI** wali naap. Checkpoint hai | 79 min |
| `20_hint_coverage.mjs` | naam ke kaunse hijje chhoot rahe hain — bhasha ke niyam se roop banata hai, **kisi test-file se nahi** | turant |

---

## 5. AAJ MAINE JO DO GALTIYAN KI, AUR PAKDI

1. **`vasishtha` do baar jud gaya** — dohri chaabi. Object me baad wali
   jeetti hai, isliye chal raha tha, par sirf ittefaq se.

2. **Use galat jagah rakha** — Ramcharitmanas ke naam wale hint se
   **pehle**. Nateeja: `"Ramcharitmanas me Vasishtha ji ka updesh"` bhi
   Yoga Vasishtha par ja raha tha, jabki granth ka naam saaf likha tha.

   Ab kram ulta hai: **naam liya hai → wahi granth. Naam nahi liya →
   Yoga Vasishtha.**

`BOOK_HINTS` me kram hi sab kuch tay karta hai — pehla match jeetta hai.
Koi bhi nayi entry jodte waqt sabse pehle ye poochhna hai ki wo **kiske
upar** ja rahi hai.

---

## 6. KAL KA KAAM — kram se

### STEP 1 — Naya session token (2 min) 🔴 hamesha pehle

Live app → `F12` → Console →

```js
copy(JSON.parse(localStorage.SAARTHI_USER_PROFILE).sessionToken)
```

`.env` me `EVAL_SESSION=` ke aage paste (sirf token, dobara
`EVAL_SESSION=` nahi).

---

### STEP 2 — Mantra Maha Sagar: 46% (~1 ghanta) 🔴

**Sabse kamzor granth.** Aur khaas baat: **hijje theek karne se sirf
44% → 46% hua** — yaani iski wajah hint nahi hai.

```
16 ANYA — jagah le raha hai: agni_purana(9), mahabharata(8), ishadi_upanishad(7)
11 KHAALI
```

Fail hue sawaal aise hain:

```
"Om ko sabse fundamental mantron mein se ek kyun maana jata hai?"
"Gayatri mantra ka basic spiritual purpose kya hai?"
"Panchakshari mantra ka kya significance hai?"
"Meru bead ko cross na karne ki parampara ka kya context hai?"   best=0.000
```

Ye **saahitya ka mel** hai, hint ka nahi: Gayatri Rigveda me bhi hai, Om
Upanishad me bhi, mantra Agni Puran me bhi. Reranker sahi se chun nahi
paa raha.

**Karna:** `eval-perbook.json` se un 27 sawaalon ke `best` score dekhiye.
`scripts/13_probe_rerank.mjs` se jaanchiye ki Mantra Maha Sagar ke ansh
kis score par aate hain jab wahi sawaal poocha jaye. Agar ansh pool me
aa hi nahi rahe — FTS/vector ki dikkat. Agar aa rahe hain par gir rahe
hain — gate/rerank ki.

---

### STEP 3 — Gita: 66%, aur 10 sawaal Mahabharat par (~1 ghanta) 🔴

```
"Arjun ko yudh se pehle sabse bada confusion kis baat ko lekar tha?"
"Shri Krishna ne Arjun ke shok ko kis tarah samjhaya?"
```

`arjun` aur `krishna` hamare kisi hint me nahi hain. Bina hint ke
Mahabharat (25,856 ansh) pool par chha jaata hai.

**Ye hint se theek NAHI hoga**, aur wahi is step ki asli baat hai. Dono
naam Gita aur Mahabharat **dono** ke hain:

- `"Arjun ka Chakravyuh"` → Mahabharat
- `"Arjun ka vishad"` → Gita

Ek shabd se ye faisla nahi ho sakta. Iska hal ya to **Mahabharat ke pool
ko rokna** hai (task #17 ka agla kadam), ya rerank ko sudharna.

---

### STEP 4 — Bhavishya (68%) aur Nitya Karm Pooja (66%) 🟡

```
Bhavishya Puran   — jagah le raha hai: mahabharata(8), agni_purana(8), garuda_purana_1(6)
Nitya Karm Pooja  — jagah le raha hai: ishadi_upanishad(4), garuda_purana_1(3), mahabharata(3)
```

Dono me Puran aapas me ghul rahe hain — vishay ek jaisa hai (vrat, daan,
pooja-vidhi, shraddh). Ye STEP 2 ke saath hi hal hoga.

---

### STEP 5 — Jawab ki gunvatta (GPT se tulna) 🟡

`ANS QUALITY TEST.pdf` se naapa gaya (26 jawab):

| | GPT | hamara prompt |
|---|---|---|
| lambai (beech ka) | **1,335 akshar** | "4-8 line kaafi hai" (~400) |
| sheershak wale hisse | 24/26 me | nahi maanga |
| rozmarra ka udaharan | haan | nahi maanga |
| ant me nichod | `Ek line mein:` | nahi maanga |
| **Aadhaar** | **nahi** | **haan** ← hamari jeet |

**Do hisse, aur pehla retrieval ka hai:**

1. **Model ko zyada maal do** — abhi `MAX_ANSH = 12`, `MAX_AKSHAR = 7000`
2. **Phir prompt** — dhaancha, udaharan, nichod, lambai ki chhoot

**Kram ulta karna khatarnak hai.** GPT lamba likh sakta hai kyunki uspar
koi bandhan nahi. Hum sirf utna keh sakte hain jitna anshon me hai. Agar
sirf prompt me "lamba likho" likh dein aur ansh utne hi rahein, to model
**bharti karega ya gadhega** — aur wahi ek cheez toot jaayegi jispar
hamari poori jeet tiki hai.

---

## 7. AB BHI PENDING (purane)

| # | kya |
|---|---|
| 25 | Bina naam wale sawaal — Atharvaveda / Guru Granth Sahib / Nitya Karm Pooja topic-sawaal par khaali |
| 20 | Ramcharitmanas reranker par Mahabharat se 4 guna peeche |
| 21 | Rerank ka score **batch-sapeksh** hai — ek hi ansh ko alag saathi milne par alag score |
| 19 | Mahabharat ki PDF `public/books/` me nahi (23 PDF, 24 granth) |
| 10 | Read section: download band, sirf padhna |
| — | 59 MB `vectors_int8.bin` + 258 MB `public/knowledge/` abhi bhi deploy ho rahe hain |

---

## 8. NIYAM JO TAY HO CHUKA HAI

**Retrieval/gate ka kaam 12 granth par karenge, 13 ko kabhi nahi chhuenge.**

Wajah: hint me saaf niyam hai ("naam liya hai to wahi granth"), isliye
wahan tuning ghus nahi sakti. Par threshold, score aur rerank me aisa koi
niyam nahi — wahin tuning chupke se ghusti hai, aur phir ank sudharta hai
jabki app nahi.

298 wala purana set is tarah pehle hi "yaad kiya hua" ban chuka hai — har
fail dekhkar sudhaar kiya gaya, isliye uska 95.3% thoda jhootha hai. 1,250
ke saath wo galti dobara nahi karni.
