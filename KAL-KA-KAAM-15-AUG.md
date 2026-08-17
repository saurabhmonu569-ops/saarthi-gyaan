# KAL KA KAAM — 15 अगस्त 2026
### Kram me. Upar wala pehle.

---

## 🔴 KADAM 1 — Aadhaar aur naye prompt ki jaanch
**Kyun sabse pehle:** AI kota raat 12 baje khulta hai, aur ye ekmatra kaam
hai jise kota chahiye. Baaki sab bina kota ke ho sakta hai.

**Aur ye kaam bakaya kyun hai:** 13 Aug ki Aadhaar-jaanch **jhoothi thi**.
`24_aadhaar_check.mjs` prompt ko `` `; `` par kaat rahi thi, par SYSTEM_PROMPT
sirf `` ` `` par khatam hota hai — isliye **2,278 akshar ka JavaScript code**
system prompt me ghus raha tha. Us jaanch ka "5 me se 4 ulte" wala nateeja
ab **rad** hai. Script 14 Aug ko theek ho chuki hai.

```powershell
cd "E:\SAARTHI JULY\SAARTHI_FINAL_V6\saarthi"
node scripts\24_aadhaar_check.mjs --n 15 --jawab
```

**Kya dekhna hai — ank nahi, JAWAB padhiye:**

| | ummeed |
|---|---|
| shuru me | `SYSTEM_PROMPT: ~11,600 akshar` (13,483 aaya to script phir tooti hai) |
| jawab ki lambai | 4+ bharpoor ansh mile ho to 12-18 line, hisson me |
| ansh kam mile ho | jawab CHHOTA rahe — bhara hua nahi |
| kai granth mile ho | har granth ki baat **alag** likhi ho, mila kar ek nahi |
| lamba jawab | ant me `Saar:` line |

⚠️ **Sabse zaroori:** dekhiye ki lamba jawab **bhara hua to nahi**. Agar model
ansh me jo nahi tha wo likhne laga, to lambai ka badlaav **wapas** lena hoga.
Ye khatra asli hai — isliye prompt me saaf likha hai ki *"ansh kam hon to
chhota jawab hi sahi jawab hai."*

---

## 🔴 KADAM 2 — Netlify ke 586 MB PDF ka faisla
**Ye ruka hua hai kyunki faisla aapka hai.**

`saarthi-gyaan.netlify.app/books/rigveda_1.pdf` — koi bhi utaar sakta hai.
`copyright_findings.md` ke hisaab se usme Rigveda aur Atharvaveda (Sanskrit
Sahitya Prakashan, 2015, ISBN + ©) aur Mantra Maha Sagar (Chowkhamba,
₹525, 2017) hain — **teenon abhi bik rahi hain**.

Read tab 14 Aug ko chhup chuka hai, par wo **UI ka parda tha, suraksha nahi.**
URL abhi bhi khula hai.

| vikalp | Read/Search par asar | khatra |
|---|---|---|
| **A. PDF hata do** | Read chhupa hi hai. Search me chhota `📄 p.12` link jayega | ✅ khatam |
| **B. Worker ke peeche** | koi nahi | kam, khatam nahi |
| **C. rehne do** | koi nahi | ❌ bana rahega |

**Sujhav: A.** Read tab waise bhi band hai — wo PDF ab kisi ko dikhti hi nahi.
Sirf seedhe URL se utarna baaki hai, aur wahi khatra hai.

**Aapka jawab chahiye, tab command doonga.**

---

## 🟡 KADAM 3 — index files jodo (#32)
**~30 min, koi khatra nahi**

`chunk_index.json` (mool) + `.yoga_sutra.json` + `.nitya_karm_pooja.json` +
`.ekadashi_mahatmya.json` — chaar alag files. Isi wajah se har script me
special-case likhna padta hai (`22_routing_embed_test.mjs` me poora block).
`chunk_index.json` me nitya_karm_pooja ki **14 duplicate id** bhi hain.

Ek script se sabko jod kar ek `chunk_index.json` banani hai, aur wahi
`vectors_int8.bin` ke saath.

**⚠️ Ye sirf sthaneey safaai hai.** Production (D1 + Vectorize) 14 Aug ko
**57,432 par sync ho chuka hai** — use dobara chhune ki zaroorat nahi.
Jodne ke baad `26_anaath_safai.mjs` chala kar `ANAATH: 0` dekh lena.

---

## 🟡 KADAM 4 — meta.json sach karo (#30)
**~10 min**

```
meta.json kehti hai : models/text-embedding-004  ·  768 dim
asliyat             : @cf/baai/bge-m3            ·  1024 dim
```

Ye Gemini wali purani pipeline ka nishaan hai (`03_embed_build.py`). Asli
kaam `chunk_index.json` se chalta hai, isliye **abhi kuch tootta nahi** —
par jo bhi is file se dobara build karega, galat banayega.

`03_embed_build.py` ke `EMBED_MODEL`/`EMBED_DIM` theek karne honge, warna
agli baar phir wahi likh degi.

---

## 🟢 KADAM 5 — lexicon D1 me (#29)
**~2 ghante**

Bundle 754 kB (gzip 366 kB), usme `lexicon.js` akela **816 kB source**.
Abhi 25,000 shabd har user ke browser me jaate hain.

Sahi hal: poora **113k** lexicon D1 me, worker sirf query ke shabd dhoondhe.
Client par 0 kB, aur lexicon 25k se 113k ho jayega — jo `KHAALI` sawaalon
par aur madad karega (6k se 25k karne par KHAALI 11.9% se 10.5% hua tha).

---

## 🔵 KHULI SAMASYAYEIN — inka hal abhi pata NAHI hai

Inhe "kaam" ki tarah mat lijiye. Inme pehle sochna hai, phir naapna.

### #33 — OCR `र्` giraata hai
Ekadashi **29.5%**, Gita 8.7%, Kathopanishad 7.6%, baaki ~0%.
**OCR ki setting se hal nahi hoga** — `hin` aur `hin+san` dono naap liye.
Agla vichaar: OCR ke **baad** shabdkosh se `र्` wapas jodna.
⚠️ Khatra: sahi shabd bhi badal sakte hain. Pehle uski jaanch banani hogi.

### Niyam #2 — Aadhaar me sirf wo granth jinka ansh sach me istemaal hua
Shabd-mel wala tareeka fail (par wo jaanch dooshit prompt par chali thi —
KADAM 1 ke baad naye sire se sochna hoga).
Agla vichaar: **model se hi poochho** ki usne kaun se granth istemaal kiye,
phir us list ko grounded chunks se milaao.
⚠️ Model jhooth bol sakta hai — isliye *milaana* zaroori hai, maan lena nahi.

### Bina hint ke 35.7% — SAARTHI ki asli seema
```
hint chale     →  452/452  =  100%
hint na chale  →              35.7%
```
Poora system ek haath se likhi hint-table par khada hai.
**Teen ilaaj aazmaye, teenon fail:** shabd-ginti (58.6%), embedding (64.6%),
pool cap (ank teenon taraf bigda).
Ye 12 Aug se khuli hai. Isme naya vichaar chahiye, nayi koshish nahi.

### #25 · #20 · #21
3 granth topic-only sawaal par khaali · Ramcharitmanas reranker par 4 guna
peeche · rerank ka score batch-sapeksh. Teenon naape hue hain, teenon khule.

---

## 📌 AAJ (14 AUG) KA HISAAB — kal shuru karne se pehle ek nazar

**Theek hua:**

| | pehle | ab |
|---|---|---|
| Ekadashi ka paath | 47.4 bigaad | **1.1** |
| bigde ansh | 89.0% | **1.0%** |
| poora corpus | 0.56% | **0.32%** |
| D1 / FTS / Vectorize | mel nahi | **teenon 57,432** |
| anaath ansh | 55 | **0** |
| Read tab | dikhta tha | **chhupa** |
| prompt | "4-8 line" (12 ansh ko kaat raha tha) | anshon se tay |
| Niyam #3 | tha hi nahi | **laga** |

**Naye auzaar:** `25_paath_jaanch.mjs` (paath ka pehra, exit 1) ·
`26_anaath_safai.mjs` (anaath ansh) · `27_repha_jaanch.mjs` (repha, `--raw`)

**Commit:** `b591f3b` · `e13b05d` · `7b8e0a2` · `9e199d2` — **push nahi kiya**

**Aaj ki teen seekh — teeno ek hi baat kehti hain:**

1. Naap wo cheez naap rahi thi jo **socha** tha, wo nahi jo **asliyat** me thi.
   `confidence` field jhoothi thi, Devanagari-anupaat shuddhi nahi naapta,
   aur `19_eval_perbook` granth naapti hai — paath nahi. Isliye **89% kachra
   "96% SAHI" dikh raha tha**, 15 din tak.

2. **Anupaat sudhar sakta hai jabki uske dono hisse bigad rahe hon.**
   `hin+san` par repha galti 29.5% se 23.0% "sudhri" — par jode 112 se 87
   ho gaye the aur `र्` ka ghanatv 14.4 se 12.7 gir gaya tha. Ratio ke saath
   hamesha **asli ginti** dekhni hai.

3. **Apne banaye test se paas hona kuch saabit nahi karta.** Aadhaar wale
   badlaav ke 12 unit-test hare the; asli jawab par 4/5 ulte nikle. Aur wo
   jaanch bhi khud dooshit prompt par chal rahi thi.
