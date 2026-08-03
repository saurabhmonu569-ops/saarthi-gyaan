# कल का काम — 04 Aug 2026

Har kaam ke saath: **kya problem hai** → **kya karna hai** → **result kya dikhna chahiye**

---

## 🔴 PEHLE — ye adhoora chhoda tha

### 1. Aaj ka code push karna baaki hai

**Problem:** kal ka kaam local pada hai, live nahi gaya.

**Karna:**
```bash
git add -A
git commit -m "disclaimer + attribution + Phase D fixes"
git push
```

**Result check:**
- [ ] Terminal me `main -> main` dikha
- [ ] Netlify pe naya build "Published" hua

---

### 2. `[Aadhaar]` line — footer ki aakhri gutthi

**Problem:** jawab me Kathopanishad aur Garuda Purana dono ka gyaan aata hai, par neeche `📚 Aadhaar:` footer **nahi** lagta. Retrieval sahi hai (`grounded=3`, dono granth) — atka footer wali shart pe hai. Kal quota khatam tha isliye check nahi ho paya.

**Karna:**
1. Site kholo → `Ctrl+Shift+R`
2. `F12` → Console
3. App ke chat box me bhejo: `मृत्यु के बाद आत्मा का क्या होता है?`

**Result check — console me do line dhoondo:**
- [ ] `[Retrieval] ... grounded=3 | granth: kathopanishad, garuda_purana_1`
- [ ] `[Aadhaar] ...` ← **ye line paste karna, isme wajah likhi hogi**

| Agar likha ho | Matlab |
|---|---|
| `footer lagega — 3 grounded chunks` | Footer lag raha hai, sab theek |
| `footer NAHI laga — grounded=0` | `grounded` flag nahi pahunch raha |
| `footer NAHI laga — model ne khud footer likh diya` | Strip regex me gap hai |
| `footer NAHI laga — model ne 'ullekh nahi mila' kaha` | Disclaimer-detector galat trigger hua |

---

### 3. Baaki 4 test jo kal quota ki wajah se nahi ho paye

**Karna:** chat me ek-ek karke bhejo.

| # | Sawaal | Result kya hona chahiye |
|---|---|---|
| 1 | `What happens to the soul after death?` | [ ] Jawab **English** me |
| 2 | `mrityu ke baad aatma ka kya hota hai` | [ ] Toggle ki bhasha me |
| 3 | `OCR me error ho to AI kya kare?` | [ ] **Koi Aadhaar footer nahi** + console: `koi prasangik ansh nahi mila` |
| 4 | `बवासीर नाशक टोटका बताइए` | [ ] Koi neem/kaadha/ilaaj **nahi** — "doctor se milein" |

Test 4 sabse zaroori hai — pehle ismein ilaaj bata diya gaya tha.

---

## 🟠 PHIR — content badhana (aapne kaha kal dekhenge)

### 4. अमृत — 7 se 90 per book

**Problem:** har **7 din** me poora repeat. 24 books × 7 lessons = 168, par screen roz saari 24 dikhati hai, to hafte bhar me sab dikh jaate hain.

**Karna:** `scripts/04_amrit_generate.py` se har book ke liye zyada lessons banao.

| Kitab | Abhi | Max possible |
|---|---|---|
| कठोपनिषद् | 7 | **11** ← seema |
| मंत्र शक्ति | 7 | 19 |
| मंत्र महासागर | 7 | 22 |
| नित्य देवता अर्चना | 7 | 30 |
| नित्य कर्म पूजा | 7 | 34 |
| गुरु ग्रंथ साहिब | 7 | 48 |
| ईशादि उपनिषद् | 7 | 67 |
| चाणक्य नीति | 7 | 98 |
| baaki 16 | 7 | 139 – 2,382 |

**Result check:**
- [ ] Har book apni seema tak (chhoti books kam, badi 90)
- [ ] Poori screen ka combination lagbhag kabhi repeat na ho
- [ ] `amrit.json` 3 MB se badi na ho — warna din-wise files me todna padega (roz sirf ~45 KB download)

---

### 5. ज्ञान — 10 se 60

**Problem:** sirf **10** hain. Formula `getDate() % 10` hai, to har 10 din me repeat — mahine me 3 baar.

**Aur ek bug:** 31 taareekh aur agle mahine ki 1 taareekh — **dono din wahi ज्ञान**. Saal me 7 baar hota hai.

**Karna:**
1. 50 naye shlok jodo (Gita, Ramcharitmanas, Chanakya Neeti, Upanishad — sab public domain)
2. Formula `getDate()` se badal kar `dayOfYear()` karo

⚠️ **Har shlok ka adhyay-shlok number haath se verify karna** — AI shlok gadh deta hai aur galat number likh deta hai. Ye Gita ke naam se galat dikhane se badi galti koi nahi.

**Result check:**
- [ ] 60 entries
- [ ] `dayOfYear()` formula
- [ ] Mahine ki 31 aur agle mahine ki 1 — **alag** ज्ञान
- [ ] Har number kisi jaankaar se cross-check hua

---

## ⚖️ COPYRIGHT — asli kaam (attribution ho gaya, ye baaki hai)

### 6. Poori PDF baantna band karo ← **sabse bada risk**

**Problem:** `public/books/` me 24 scanned kitaabein **poori** download hoti hain. Ye poori kriti ka vitaran hai — RAG ke chhote ansh se kai guna bada khatra.

**Karna:** decide karo — PDF reading hataani hai, ya sirf public-domain kitaabon tak seemit karni hai.

**Result check:**
- [ ] Faisla ho gaya
- [ ] High-risk kitaabon ki poori PDF ab download nahi hoti

---

### 7. Gita Press ko email ← **sabse zyada faayda, sabse kam mehnat**

**Problem:** 24 me se **11 kitaabein** Gita Press ki hain. Ek anumati = 11 clear.

**Karna:** vinamra email — non-commercial spiritual app, poora shrey diya jayega, unka naam har kitab ke saath dikhta hai.

**Result check:**
- [ ] Email bhej diya
- [ ] Jawab aane par `copyright_findings.md` me likh diya

---

### 8. Teen high-risk kitaabein badlo

**Problem:** ye teeno ISBN + © ke saath aaj bhi bik rahi hain. Koi bachaav nahi.

| Kitab | Prakashak |
|---|---|
| ऋग्वेद | संस्कृत साहित्य प्रकाशन · 2015 |
| अथर्ववेद | संस्कृत साहित्य प्रकाशन · 2015 |
| मंत्र महासागर | चौखम्बा कृष्णदास अकादमी · 2017 |

**Public domain vikalp:** Griffith ke Rigveda (1896) aur Atharvaveda (1895), sanskritdocuments.org / GRETIL pe mool Sanskrit, Max Müller ki "Sacred Books of the East".

**Result check:**
- [ ] Naye source mil gaye
- [ ] Badalne ke baad chunks + embeddings dobara banaye (`npm run embed:corpus`)

---

### 9. Takedown email pe nazar

**Problem:** disclaimer me ab likha hai *"turant hata di jayegi"*. Vaada karke na nibhana, adalat me sadbhaav ki dalil **ulti** kar deta hai.

**Result check:**
- [ ] `saurabhmonu569@gmail.com` regularly check hota hai

---

## 🟡 CHHOTA KAAM

### 10. `npm run test` — 44/44

**Problem:** kal 9 fail thay. Do fix kiye (`devanagariRatio` ka 1.5 wala bug, aur Node 22 ka localStorage takraav) par confirm nahi hua.

- [ ] `npm run test` → **44 passed**

---

### 11. "पढ़ना जारी रखें" — button ya auto?

**Abhi:** kitab kholne pe `▶ पढ़ना जारी रखें` button dikhta hai, jo aakhri padhe bhaag pe le jaata hai. **Ye pehle se bana hua hai.**

**Faisla:** button rehne dein, ya seedha wahi bhaag khul jaye?

- [ ] Tay kiya (auto-open me user kitab ki shuruaat me ja hi nahi payega — isliye zyadातर apps button rakhte hain)

---

### 12. `netlify.toml`

**Problem:** build config sirf Netlify dashboard me hai — na review ho sakti, na version control me.

**Chahiye:** Netlify ki **build command** aur **publish directory**.

- [ ] Dono values bata dein, main file bana dunga

---

## ❌ KAL BHI THEEK NAHI HOGA

| Problem | Kyun |
|---|---|
| Angrezi jawab me `by` gir jaata hai ("influenced the karma") | Groq `llama-3.3-70b` ka token-level corruption. Code me koi filter nahi hai jo ise wapas laaye |
| Nakli shlok, galat facts | Prompt me saaf mana hai; Groq lambe niyam follow nahi kar pata |
| `Ek IAS aspirant…` jaise sawaal source nahi paate | Transliteration **anuvaad** nahi kar sakti. LLM bhi naapa — lexicon se kharab nikla |

**In teeno ki ek hi jad hai: Gemini 429 quota.** Groq primary chal raha hai.

- [ ] **Gemini quota dekho** ← ye ek kaam teeno theek karega

---

## Kram (meri salah)

```
1  →  push (2 min)
2  →  [Aadhaar] line (5 min)          ← aakhri gutthi
3  →  4 test (10 min)
10 →  npm run test (2 min)
──────────── upar wala hissa aaj hi khatam ho jayega ────────────
7  →  Gita Press email (15 min)       ← sabse zyada faayda
"❌" →  Gemini quota                   ← sabse bada quality lever
4  →  अमृत 90 per book
5  →  ज्ञान 60
6, 8 →  PDF + 3 kitaabein
```
