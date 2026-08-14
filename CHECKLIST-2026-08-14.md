# SAARTHI GYAAN — POORA AUDIT
### 14 अगस्त 2026, 15:10 IST

> Ye document 14 Aug ke din bhar ke kaam ke **baad** ka poora audit hai.
> Har ank naapa hua hai. Jo naapa nahi gaya, uske aage saaf likha hai
> "naapa nahi".

---

> ## ✅ 15:10 KE BAAD — EKADASHI THEEK HO GAYA
>
> Neeche §0 me jo samasya likhi hai, wo **usi din theek kar di gayi**.
> Naapa hua natija:
>
> | | pehle | ab |
> |---|---|---|
> | Ekadashi bigaad (prati-1000-shabd) | **47.4** | **1.1** |
> | bigde ansh | 138/155 = **89.0%** | 1/103 = **1.0%** |
> | poora corpus | 0.56% | **0.32%** |
> | D1 / FTS / Vectorize | 57,484 / 57,484 / 57,485 | **57,432 teenon** |
> | anaath ansh | 55 | **0** |
> | `18_book_check --naam` | 25/25 | **25/25** |
>
> Jo mila, wo ummeed se alag tha: **PDF scan hai hi nahi.** Wo born-digital
> hai, jisme `Sanskrit2003` font embed hai. Panne par akshar bilkul sahi
> bane hue hain — bas font ka glyph→Unicode naksha toota hua hai. Isliye
> 400 DPI render par OCR itna achha chala (aam scan se kahin behtar).
>
> Bacha hua: OCR `र्` (repha) girata hai — `प्रार्थना`→`प्राथना`,
> `पदार्थ`→`पदाथ`. Paath phir bhi poori tarah padhne laayak hai.
> Task **#33** me alag se rakha hai. Ye nayi naap bhi ise nahi pakadti —
> gire hue akshar "asambhav dhaancha" nahi bante.

## 0. SABSE PEHLE — EK BAAT JO AAJ TAK CHHUPI THI

Aaj ke audit me ek cheez mili jise **15 din se koi naap pakad nahi paayi**:

> **Ekadashi Vrat Mahatmya ke 155 me se 138 ansh (89%) ka paath TOOTA HUA hai.**

Ye kaisa dikhta hai (asli corpus se, panna 13):

```
परमहंससगणम स्त्रोीस प्रदक्षिपदा
ह्षा शर्रीरार स्त्रोगयदातिय वैज्ञानि्री
 वैज्ञानि गरीय एवंगा  वैज्ञानि गया भ्विष्णुप  वैज्ञानि काश्री
```

Ye kachra hai. Koi ise padh nahi sakta — model bhi nahi.

**Aur wahi kitab 50 sawaalon par 96% "SAHI" la rahi hai** — poore corpus me
doosre number par. Kyunki `19_eval_perbook.mjs` ye naapti hai ki *sahi granth
mila ya nahi*. Us granth ka paath *padhne laayak hai ya nahi*, ye sawaal humne
kabhi poochha hi nahi.

**Iska seedha matlab, aaj, LIVE site par:** koi Ekadashi ka sawaal poochhta hai,
jawab milta hai, neeche likha aata hai `📚 Aadhaar: Ekadashi Vrat Mahatmya` —
aur wo Aadhaar **jhootha** hai. Naam sacha hai, paath nahi.

Aapki sabse badi taakat — sacha Aadhaar — ek granth par abhi bhi tooti hui hai.

---

## 1. AAPKE SAWAAL KA SEEDHA JAWAB — 24 GRANTH, KITNE SHABD?

| | |
|---|---|
| **Kul shabd** | **96,93,449** (~97 lakh) |
| Kul akshar | 5,66,84,151 (~5.67 crore) |
| Kul ansh (chunks) | **57,484** |
| Kul panne | ~9,700 |
| Book-ID | 25 (Shiv Puran ke 2 khand = 1 granth → **24 granth**) |

### Granth-vaar (shabd ke kram me)

| # | granth | ansh | shabd | paath saaf? |
|---|---|---:|---:|---|
| 1 | mahabharata | 25,856 | 37,73,282 | ✅ 0.3% |
| 2 | yoga_vasishtha | 6,446 | 12,88,524 | ✅ 0.1% |
| 3 | rigveda_1 | 3,159 | 5,19,482 | ✅ 0.4% |
| 4 | shiva_purana_1 | 2,156 | 3,93,997 | ✅ 0.4% |
| 5 | shiva_purana_2 | 2,186 | 3,89,231 | ✅ 0.4% |
| 6 | guru_granth_sahib | 1,870 | 3,80,370 | ✅ 0.5% |
| 7 | agni_purana | 1,826 | 3,73,704 | ✅ 0.4% |
| 8 | ramcharitmanas | 2,070 | 3,47,910 | ✅ 0.4% |
| 9 | atharvaveda_1 | 1,706 | 3,04,240 | ✅ 0.2% |
| 10 | garuda_purana_1 | 1,305 | 2,67,456 | ✅ 0.0% |
| 11 | vishnu_purana_1 | 1,212 | 2,30,921 | ✅ 0.2% |
| 12 | mantra_maha_sagar | 1,146 | 2,11,977 | ✅ 0.3% |
| 13 | bhavishya_purana | 866 | 1,74,990 | ✅ 0.0% |
| 14 | yajurveda | 811 | 1,69,323 | ✅ 0.0% |
| 15 | bhagavad_gita_shankar | 897 | 1,51,321 | ✅ 1.0% |
| 16 | ishadi_upanishad | 877 | 1,23,853 | ✅ 0.6% |
| 17 | chanakya_neeti | 578 | 1,21,193 | ✅ 0.2% |
| 18 | samaveda | 524 | 1,05,916 | ✅ 0.6% |
| 19 | rashi_muhurt_vigyan | 460 | 84,498 | ✅ 0.2% |
| 20 | narasimha_purana | 413 | 84,196 | ✅ 0.5% |
| 21 | nitya_karm_pooja | 408 | 54,208 | ✅ 2.0% |
| 22 | lal_kitab | 211 | 49,010 | ✅ 1.9% |
| 23 | kathopanishad | 186 | 36,962 | ✅ 0.5% |
| 24 | yoga_sutra | 160 | 30,781 | ✅ 0.0% |
| 25 | **ekadashi_mahatmya** | **155** | **26,104** | **❌ 89.0%** |

### "Kya sab ingest ho gaye?" — imaandaar jawab

| kasauti | haal |
|---|---|
| Sab 24 granth corpus me hain? | ✅ **HAAN** — 25/25 book-ID, 57,484 ansh |
| Sabke ansh embed hue? | ✅ **HAAN** — 57,484 vector (1024-dim, bge-m3) |
| Sab Vectorize + D1 par hain? | ⚠️ **11 Aug ko the.** Aaj is machine se jaanch nahi ho paayi (network band) — command §5.0 me hai |
| Kisi granth me `(cid:...)` bacha? | ✅ **NAHI** — poore corpus me 0 |
| Latin-Devanagari ghalmel? | ✅ **NAHI** — poore corpus me 0 |
| **Sabka paath padhne laayak?** | ❌ **NAHI — 1 granth (Ekadashi)** |

Yaani: **ingest 25/25 hai. Paath 24/25 hai.**

---

## 2. AAJ TAK KYA SAHI HUA (naapa hua)

### 2.1 Ask section ka ank — 1,250 sawaal, 50 prati granth

```
12 Aug baseline       SAHI 77.1%   ANYA 8.8%   KHAALI 14.1%
12 Aug hint fix       SAHI 80.0%   ANYA 8.2%   KHAALI 11.8%
13 Aug pool cap       SAHI 78.9%   ANYA 9.0%   KHAALI 12.2%   ← HATAYA
14 Aug lexicon 25k    SAHI 81.0%   ANYA 8.5%   KHAALI 10.5%
14 Aug naap sudhaar   SAHI 82.3%   ANYA 7.2%   KHAALI 10.5%   ← ABHI
```
Naap ka shor: **±0.3%**. Isse chhota badlaav badlaav nahi hai.

### 2.2 Jo bana aur chal raha hai

- ✅ 24va granth **Yogasutra** joda (82 panne, 160 ansh, 13/13 test)
- ✅ **Retrieval server par** — client par 0 MB (pehle 316 MB)
- ✅ **wrangler.toml + netlify.toml** — deploy ab code me, dashboard me nahi
- ✅ **Hint table** — hint chale to **452/452 = 100%** sahi granth
- ✅ **lexicon 6,000 → 25,000** — bina-hint wale sawaal 31.7% → 35.7%
- ✅ **Naap ki do galtiyan theek** — Shiv Puran ke 2 khand ek granth, Gita Mahabharat ke andar
- ✅ **118 unit test** hare (Windows par; is Linux sandbox me rollup ka native binary nahi chalta)
- ✅ **Groq fallback** 16 Aug se pehle badla (`openai/gpt-oss-20b`)

### 2.3 Teen aazmaishein jo FAIL hui — aur wahi sabse keemti hain

| kya aazmaya | natija | kyun fail hui |
|---|---|---|
| Granth chunav — **shabd-ginti** | top-3 **58.6%** (chahiye 90%) | "अग्नि" Rigveda me hazaron baar hai. Shabd ginna *matlab* nahi samajhta |
| Granth chunav — **embedding** | top-3 **64.6%** | Puran aapas me alag kiye hi nahi ja sakte — wo wahi baat kehte hain |
| Aadhaar — **shabd-mel** | asli jawab par 5 me **4 ulte** | Model purani Hindi ko aaj ki bhasha me likhta hai. Shabd-mel *dono taraf* fail hota hai |
| Pool par **per-book cap** | SAHI 80.0 → 78.9 | Cap vector-kram se kaatta hai, par rerank-kram alag hai |

**Chaaron code me poori wajah ke saath likhi hain** — taaki koi (main bhi)
inhe dobara na aazmaye.

### 2.4 Aaj ki sabse badi seekh (ank nahi, tareeka)

Aadhaar wale badlaav ke **12 unit-test hare the**. Phir asli jawab par
5 me se 4 ulte nikle.

> **Wo 12 test maine hi likhe the — isliye wo sirf wahi pakad sakte the jo
> maine socha tha.**

`"Bhagavad Gita"` ka naam jawab me **saaf likha tha**, aur mera niyam use
hata raha tha.

**Niyam ab se:** koi bhi badlaav "ho gaya" tab kehna hai jab wo **asli data
par** naapa jaye. Apne banaye test se paas hona kuch saabit nahi karta.

Aaj ka Ekadashi wala mamla **isi seekh ka doosra roop** hai: teen pehre the,
teenon nikal gaye, kyunki teenon *wo* naap rahe the jo humne socha tha.

---

## 3. AB KYA-KYA KHARAB HAI — POORI SOOCHI

Kram: **kitna nuksaan × kitni jaldi**.

### 🔴 P0 — jo aaj live hai aur user se jhooth bol raha hai

| # | kya | naap | jad |
|---|---|---|---|
| **26** | **Ekadashi ka paath 89% bigda** | 138/155 ansh; corpus aausat 0.56% | `07_add_books.py:49` par `force_ocr` nahi tha |
| **27** | **Paath-shuddhi ki koi naap nahi thi** | `confidence` field jhoothi — rigveda ke saare 3,159 ansh par `0.00`, mahabharata ke saare 25,856 par `1.00` | Devanagari-*anupaat* shuddhi nahi naapta |
| **28** | **Netlify par 1.2 GB ja raha hai** | `dist/` = 586 MB PDF + 579 MB JSON | Retrieval Worker par ja chuki, par `public/` abhi bhi sab bhejta hai |

**#28 ka asli khatra kanooni hai.** `copyright_findings.md` khud kehta hai:
Atharvaveda, Rigveda (Sanskrit Sahitya Prakashan, 2015, ISBN + ©) aur
Mantra Maha Sagar (Chowkhamba, ISBN 978-81-218-0352-6, ₹525, 2017) —
**abhi bik rahi kitaabein**. Unki poori scan `saarthi-gyaan.netlify.app/books/rigveda_1.pdf`
par koi bhi utaar sakta hai. Ye SAARTHI ka sabse bada khatra hai, RAG ka koi
ank nahi.

### 🟡 P1 — jawab ki gunvatta

| # | kya | naap |
|---|---|---|
| **31** | **Prompt apne aap ko kaat raha hai** | `ChatView.jsx` 12 ansh / 7,000 akshar bhejta hai, par `gemini.js:623` kehta hai *"4-8 line kaafi hai"*. Aadha kaam doosre aadhe ko rok raha hai |
| **31b** | **Niyam #3 abhi laga hi nahi** | "granth alag baat kahein to alag likho" — prompt me kahin nahi |
| — | **Niyam #2 ka sahi raasta abhi nahi mila** | Shabd-mel fail. Agla vichaar: model se hi poochho ki usne kaun se granth istemaal kiye |
| **25** | 3 granth topic-only sawaal par khaali | Atharvaveda, Guru Granth Sahib, Nitya Karm Pooja |
| **20** | Ramcharitmanas reranker par 4 guna peeche | naapa hua |
| **21** | Rerank ka score **batch-sapeksh** | do baar pakka hua. Pool badalte hi saare score khisak jaate hain |

**Sabse zaroori nidaan, jo abhi bhi khada hai:**

```
hint chale     →  452/452  =  100%  sahi granth
hint na chale  →              35.7%
```

> Poora system ek **haath se likhi hint-table** par chal raha hai.
> Wo table jitni achhi hai, SAARTHI utna achha hai — aur usse ek kadam bhi aage nahi.

Aaj iske teen ilaaj aazmaye, teenon fail. **Ye abhi khuli samasya hai.**

### 🟢 P2 — safaai

| # | kya |
|---|---|
| **29** | JS bundle 1.10 MB — usme **816 KB akela `lexicon.js`** (74%) |
| **32** | `chunk_index.json` me nitya_karm_pooja ke 423 entry = 409 vishisht → **14 duplicate + 1 phantom**; yoga_sutra ki alag file |
| **19** | 2 PDF gayab — `mahabharata.pdf`, `yoga_sutra.pdf` (23 PDF / 25 ID) |
| **10** | Read section — download band karna, naam dikhte rehna |
| **30** | `meta.json` kehti hai `text-embedding-004` / 768-dim. Asliyat: `bge-m3` / 1024. **Sirf dikhawe me** — asli kaam `chunk_index.json` se chalta hai |
| **23** | Yogasutra jud jaane ke baad poori dobara naap |

### Jo pehle "kami" lagti thi, par nahi hai

- **ANYA 7.2% poori tarah galti nahi.** 15 namoone padhe — lagbhag **aadhe
  galti hain hi nahi**: doosri kitab, par jawab sahi aur Aadhaar sacha.
  Asli galti ~3.5–4% hai.
- **`.gitattributes` ka line-ending churn** — 3 Aug ko jaan-boojhkar chhoda
  gaya tha, file me wajah likhi hai. Ye kami nahi, faisla hai.

---

## 4. PROCESS KA FIX — jo aaj ban gaya ✅

Har baar galti ka roop alag tha, **jad ek hi thi**:

> Naap wo cheez naap rahi thi jo humne SOCHA tha, wo nahi jo ASLIYAT me thi.

- `\b` Devanagari par nahi chalta → pehra kabhi laga hi nahi
- `\p{L}` matra chhod deta hai → shabd-mel 0% aa gaya
- JS `.length` akshar nahi ginta → "राम" chhant jaata
- Devanagari-**anupaat** shuddhi nahi naapta → **Ekadashi 15 din chhupa raha**
- `19_eval_perbook` granth naapti hai, paath nahi → 89% kachra "96% SAHI"

**Aaj do cheezein badli:**

**1. Nayi naap — `scripts/25_paath_jaanch.mjs`** ✅ *(ban gaya, chal gaya)*

Wo dhaanche ginta hai jo Devanagari vyakaran me **asambhav** hain — matra se
shuru hone wale shabd, do matra ek saath, do halant ek saath. Ye raay nahi,
niyam hai.

Seema sochkar nahi, **naap kar** rakhi:
```
24 granth  →  0.0% se 2.0%
ekadashi   →  89.0%
beech me kuch nahi hai
```
Seema **5%** — har asli granth se 2.5 guna oopar, Ekadashi se 17 guna neeche.

`exit 1` deta hai — isliye pipeline me pehre ki tarah lag sakta hai.

**2. `07_add_books.py:49` par `force_ocr: True`** ✅ *(lag gaya)* — poori wajah
saath me likhi hai.

**Ab se pipeline ka niyam:**
```
OCR → chunk → 25_paath_jaanch.mjs (PEHRA) → embed → Vectorize → D1
                        ↑
              yahan ruka to aage kuch nahi jaata
```

---

## 5. AB KYA KARNA HAI — KADAM DAR KADAM

> Sab kuch **local** — `git push` aur Netlify deploy tab tak nahi jab tak
> aap na kahein. (Aapka niyam, 13 Aug.)

### 5.0 — PEHLE: production sach me kya hai? (2 min)

Is Linux sandbox se Cloudflare tak network nahi hai, isliye ye **aap
Windows par** chalayein:

```powershell
cd "E:\SAARTHI JULY\SAARTHI_FINAL_V6\saarthi"
npx wrangler d1 execute saarthi-knowledge --remote --command "SELECT COUNT(*) n FROM chunks"
npx wrangler vectorize info saarthi-chunks
```
**Dekhna kya hai:** dono me **57,484** aana chahiye.
Kam aaye → kuch granth adhoore chadhe hain. Zyada aaye → purane vector pade hain.

---

### 5.1 — P0 #26: Ekadashi dobara OCR (~40 min, zyadatar intzaar)

```powershell
# 1. dobara nikaalo — force_ocr ab lag chuka hai
#    ⚠️ --pdf-dir ZAROORI hai, aur --force ke bina script bane hue panne
#       SKIP kar degi (resumable design) — yaani force_ocr lagta hi nahi.
python scripts\07_add_books.py --pdf-dir "<EKADASHI PDF ka folder>" --books ekadashi_mahatmya --force

# 2. dobara ansh banao
python scripts\02_chunk.py --books ekadashi_mahatmya

# 3. ⚠️ PEHRA — yahi wo kadam hai jo pehle tha hi nahi
node scripts\25_paath_jaanch.mjs --granth ekadashi_mahatmya --namoone 3
```

**Ruk kar dekhiye.** Aage tabhi badhna hai jab:
- `theek` likha aaye (bigde ansh 5% se kam), **aur**
- neeche chhapa paath aap **khud padh sakein**

Agar abhi bhi bigda hai → tesseract ne bhi nahi padha. Tab batayiye, alag
raasta sochna hoga (PDF re-render, DPI, ya kitab badalna).

```powershell
# 4. sirf tabhi jab pehra pass ho
node scripts\embed-corpus.mjs --books ekadashi_mahatmya
node scripts\11_upload_vectorize.mjs --books ekadashi_mahatmya
node scripts\12_load_d1.mjs --load --books ekadashi_mahatmya

# 5. asli jaanch
node scripts\18_book_check.mjs --book ekadashi_mahatmya
```

---

### 5.2 — P0 #27: pehra poore corpus par (1 min)

```powershell
node scripts\25_paath_jaanch.mjs
```
Sab `theek` → paath ka kaam poora. Ye ab har ingest ke baad chalega.

---

### 5.3 — P0 #28: Netlify se 1.2 GB hatao (~30 min)

⚠️ **Ye Read section ko chhoota hai — pehle faisla chahiye.**

Abhi `dist/` me: 586 MB PDF + 579 MB knowledge JSON. **Ask ko inme se kuch
nahi chahiye** (retrieval Worker par hai). Sirf **Read** aur **Search** tab
maangte hain.

Teen raaste:

| | kya hota hai | Read section | khatra khatam? |
|---|---|---|---|
| **A** | `public/books/*.pdf` hata do | PDF-mode band, chapter-text chalta rahe | ✅ **poora** |
| **B** | PDF Worker ke peeche, sirf login user | Read waisa hi | ✅ zyadatar |
| **C** | `knowledge/*` hata do, PDF rehne do | Read/Search toot jayenge | ❌ nahi |

**Mera sujhav: A.** Wajah — task #10 me aap pehle hi tay kar chuke hain ki
"download band, naam dikhte rahein". A wahi cheez hai, bas ek kadam aage:
naam, adhyay aur paath sab dikhte rehte hain; sirf **poori scan** utarni band
ho jaati hai. Aur ye 586 MB **aur** kanooni khatra dono ek saath khatam karta hai.

**Aapka faisla chahiye — main is par abhi kuch nahi chhed raha.**

---

### 5.4 — P1 #31: Prompt (~20 min likhna, jaanch kal)

Ek hi jagah do cheez, kyunki dono `SYSTEM_PROMPT` me hain:

1. **Lambai ka virodhabhas hatao** — `gemini.js:623` `"4-8 line kaafi hai"`.
   12 ansh bhej kar 4 line maangna aadha kaam hai.
2. **Niyam #3 lagao** — *"do granth alag baat kahein to dono alag likho.
   Mila kar ek baat mat banao."*

⚠️ **Kram maayne rakhta hai.** MAX_ANSH=12 pehle se laga hai (aaj jaancha) —
isliye prompt ab surakshit roop se lamba jawab maang sakta hai. Ulta kram —
pehle prompt, phir ansh — model ko **bhar kar likhne** par majboor karta,
aur wo gadhna (fabrication) hota.

**Jaanch (AI kota kal 00:00 IST par khulega):**
```powershell
node scripts\24_aadhaar_check.mjs --n 15 --jawab
```
Sirf ank mat dekhiye — **jawab padhiye**, aur GPT wale jawab se milaiye.

---

### 5.5 — P1: Niyam #2 ka agla vichaar (abhi sirf soch)

Shabd-mel fail ho chuka. Agla vichaar:

> Model se hi kehna: *"jawab ke ant me likho ki tumne kaun se granth ke ansh
> sach me istemaal kiye"* — phir us list ko grounded chunks se milaana.

**Kyun ye behtar ho sakta hai:** model ko *pata* hai usne kya istemaal kiya.
Shabd-mel bahar se andaza laga raha tha.
**Kyun ye bhi fail ho sakta hai:** model jhooth bol sakta hai ya sab gina
sakta hai. Isiliye **milaana** zaroori hai, seedha maan lena nahi.

**Ye tab tak nahi lagega jab tak 25 asli sawaalon par naapa na jaye.** Aaj ki
seekh yahi thi.

---

### 5.6 — P2 (jab P0/P1 nipat jayein)

| kram | # | kaam | samay |
|---|---|---|---|
| 1 | 32 | index files jodo — 14 duplicate + 1 phantom | 30 min |
| 2 | 29 | lexicon D1 me → bundle 1.10 MB se ~300 KB | 2 ghante |
| 3 | 23 | poori 1,250 sawaalon ki naap | 1 ghanta |
| 4 | 19 | 2 gayab PDF (#28 par nirbhar) | — |
| 5 | 30 | `meta.json` sach karo | 10 min |
| 6 | 20/21 | reranker ka batch-sapeksh vyavhaar | naap chahiye |

---

## 6. ⚠️ JO NAAPA NAHI GAYA — imaandaari se

Ye maine **nahi** jaancha. Inhe "theek hai" mat maaniye:

1. **Production D1 / Vectorize ki asli ginti** — sandbox se network band. §5.0.
2. **OCR ne sahi SHABD padha ya nahi.** `25_paath_jaanch.mjs` sirf ye kehti hai
   ki *akshar theek jude hain*. Ekadashi ka sabse "saaf" ansh bhi
   `प्राथना` (←`प्रार्थना`) aur `कितु` (←`किंतु`) dikhata hai — **र्** aur
   **anusvara** gir rahe hain. Ye naap ise nahi pakadti.
   👉 Iska matlab: **doosre granthon me bhi ye kismat ki galti ho sakti hai
   aur 0.4% dikh rahi ho.** Alag naap chahiye.
3. **Jawab ki gunvatta** GPT ke muqable — 5 namoone dekhe the, 25 nahi.
4. **Accessibility / security** — is audit me nahi chhue.
5. **`npm test`** is sandbox me nahi chala (rollup ka Windows binary). Windows
   par 118/118 the.

---

## 7. EK LINE ME

**SAARTHI ka RAG dhaancha theek hai — 97 lakh shabd, 57,484 ansh, 24 granth,
82.3% sahi.** Do cheezein khuli hain:

1. **Ek granth ka paath kachra hai aur wo abhi live hai** — jad mil gayi, fix
   likh diya, chalana baaki (§5.1).
2. **Bina hint ke system 35.7% par hai.** Teen ilaaj aazmaye, teenon fail. Ye
   SAARTHI ki asli seema hai, aur ye abhi khuli hai.

Baaki sab — bundle, index, PDF — safaai hai. **Netlify wala 1.2 GB safaai
nahi, khatra hai** (§5.3), aur uspar aapka faisla chahiye.

---

### Aaj ke naye task
`#26` Ekadashi OCR · `#27` paath-pehra ✅ · `#28` Netlify 1.2 GB ·
`#29` bundle · `#30` meta.json · `#31` prompt · `#32` index

### Aaj bane files
- `scripts/25_paath_jaanch.mjs` — nayi naap ✅ chal chuki
- `scripts/07_add_books.py` — `force_ocr` Ekadashi par ✅
- `CHECKLIST-2026-08-14.md` — yahi file
