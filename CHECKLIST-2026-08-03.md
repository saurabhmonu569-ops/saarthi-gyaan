# SAARTHI — Checklist

**Updated:** 03 Aug 2026

---

## ✅ FIX HO GAYA — verified

### Push notifications (item #15)

| # | Kaam | Saboot |
|---|---|---|
| 1 | KV namespace `saarthi-push-subs` + binding `PUSH_SUBS` | dashboard |
| 2 | VAPID pair — `VAPID_PRIVATE_JWK` + `VAPID_PUBLIC_KEY` | `self-check: PASS` |
| 3 | Bekaar `VAPID_PRIVATE_KEY` delete | dashboard |
| 4 | Cron `30 2,8,13 * * *` = 8AM / 2PM / 7PM IST | Trigger events |
| 5 | Netlify `VITE_VAPID_PUBLIC_KEY` + rebuild | deploy log |
| 6 | **Notification asli me deliver hui** | `bheje: 1, fail: 0` |
| 7 | `vapid-keys.txt` delete + `.gitignore` | filesystem |

### Semantic search zinda ki (item #16)

| # | Galti kya thi | Kya kiya |
|---|---|---|
| 8 | **Embedding model 134-byte ka Git LFS pointer tha** — kabhi load hi nahi hua, `semanticSearch()` chup-chaap `[]` laut rahi thi, app mahino se sirf keyword search pe chal rahi thi | Client se model poora hataya; query embedding ab Workers AI `bge-m3` se |
| 9 | Corpus vectors 26.5 MB float32, 694 chunks bina vector ke | 18,777 chunks dobara embed, int8 → **18.4 MB** |
| 10 | Pehli visit pe **171 MB** download (model+tokenizer+wasm+vectors) — aur wo kaam bhi nahi karta tha | **18.4 MB** — 90% kam |
| 11 | Fail-soft design ne failure chhupaya | Fail-**loud**: `console.error` + `getSemanticStatus()` |
| 12 | `@xenova/transformers` + 80 MB dead assets | Repo se hataye |

### Jhoothi citations band ki (item #17)

| # | Galti kya thi | Kya kiya |
|---|---|---|
| 13 | Threshold **relative** tha (`topScore × 0.35`) — poora result-set kachra ho to kuch reject kar hi nahi sakta tha | Cross-encoder reranker gate, `MIN_RERANK_SCORE = 0.5` |
| 14 | **Pehle 3 results ko koi jaanch nahi** (`diverse.length >= 3`) — isiliye HAR jawab me granth cite hote the | Chhoot hataai |
| 15 | Keyword aur cosine ke **alag paimane** `>` se tole ja rahe the | Source-balanced merge; faisla reranker par |
| 16 | Aadhaar footer grounding se juda hi nahi tha | Footer sirf `grounded` chunks se |
| 17 | Devanagari `आधार:` / `आदार:` strip nahi hoti thi → ek jawab me do alag source-lists | Regex me joda |
| 18 | Hinglish sawaal shor jaise score karte the (0.48 vs 0.58) | Corpus se bana 6,000-shabd lexicon translit — **96% recovery** |

**Naapa hua farak:** cosine gap `+0.0059` → reranker gap `+0.8878` (150×)

### Bhasha + output (03 Aug)

| # | Galti kya thi | Kya kiya |
|---|---|---|
| 19 | Devanagari me poocha, toggle EN tha → **English jawab** | Script saaf ho to script jeete; Hinglish me toggle jeete. Detector 16/16 |
| 20 | Garuda Purana ka best ansh (rerank 0.9406) **cap ki wajah se phenka ja raha tha** — jawab me sirf Kathopanishad | Diversity ab rerank ke **baad**, pehle nahi |
| 21 | Cyrillic corruption (`नарам`) | `stripCyrillic` — `नарам` → `नरम` |
| 22 | बवासीर pe **ilaaj bata diya** (neem, हरितकी) — prompt me mana tha | Health guard: sawaal ke saath dobara sakht niyam |

### Security / release

| # | Galti kya thi | Kya kiya |
|---|---|---|
| 23 | Cron **saari** KV keys pe ghoomta tha — `rl:` counters jhoothe "failed push" gin rahe the | `list({ prefix: "sub:" })` |
| 24 | Subscription ka email client ke body se, jabki verified session maujood tha | Ab session se; `emailVerified` flag |
| 25 | 1000+ line worker **haath se paste** hota tha — na rollback, na history | `wrangler.toml` + npm scripts |

### Tests

| # | Galti kya thi | Kya kiya |
|---|---|---|
| 26 | ~8,900 lines ke liye 3 test files; retrieval ka ek bhi test nahi | `translit.test.js` — 20 tests |
| 27 | **`devanagariRatio` 1.5 laut raha tha** — numerator matras ginta tha, denominator nahi | Dono taraf `\p{L}+\p{M}` |
| 28 | **`quota.test.js` ke 8 tests chup-chaap fail** — Node 22 ka experimental `localStorage` jsdom wale ko block kar raha tha | `vitest.setup.js` |

---

## ⏳ PENDING

### Abhi karna hai — aap

| # | Kaam | Command |
|---|---|---|
| P1 | Tests confirm — 44/44 pass hone chahiye | `npm run test` |
| P2 | Code push | `git add -A && git commit -m "..." && git push` |

### Kal — quota reset ke baad

| # | Kaam |
|---|---|
| P3 | `मृत्यु के बाद आत्मा का क्या होता है?` bhejo → console me `[Aadhaar]` line padho. **Yahi batayegi ki footer kyun nahi lag raha.** Retrieval to sahi hai (`grounded=3`, dono granth) |

### Baad me — priority ke kram me

| # | Kaam | Kyun |
|---|---|---|
| P4 | **Gemini 429 quota** dekho | Sabse bada lever. Groq primary hone se hi nakli shloka, galat facts, `by` girna, Cyrillic — sab ho rahe hain |
| P5 | Test set badhao (abhi 14 sawaal), threshold dobara naapo | `MIN_RERANK_SCORE = 0.5` chhote sample se hai |
| P6 | `npx wrangler login` + pehla `npm run worker:deploy` | Copy-paste deploy khatam. **Pehle dashboard code ka backup lena** |
| P7 | `netlify.toml` | Build config sirf dashboard me hai. Netlify ki build command + publish dir chahiye |
| P8 | Colour tokens (64 hardcoded hex) | Dark mode aur contrast audit block hai |
| P9 | `engine.js:186` duplicate keys (`yamraj`, `sleep`) | Build warnings |
| P10 | Push fan-out batching (`MAX_PER_RUN = 300`, sequential) | Subscriber badhne par ceiling |

---

## ❌ CODE SE THEEK NAHI HOGA

| # | Samasya | Kyun |
|---|---|---|
| N1 | Angrezi jawabon me **`by` gir jaata hai** ("influenced the karma") | Groq `llama-3.3-70b` ka token-level corruption. Koi filter ise wapas nahi la sakta — engine badalna hi hal hai (**P4**) |
| N2 | Nakli shloka, galat facts (Lal Kitab ka lekhak) | Prompt me saaf mana hai; Groq lambe niyam follow nahi kar pata (**P4**) |
| N3 | English content-shabd wale Hinglish sawaal (`Ek IAS aspirant…`) source nahi paate | Transliteration **anuvaad** nahi kar sakti. LLM normalize bhi naapa — lexicon se kharab nikla (gap −0.009). Filhaal ye sawaal bina source ke jawab paate hain — jo aapka apna niyam hai |

---

## 🔄 AUDIT ME MERI GALTIYAN — withdraw ki

| # | Maine kya kaha tha | Sach |
|---|---|---|
| W1 | `<html lang="hi">` hardcoded, toggle se sync nahi | **Galat.** `i18n.jsx:42` pehle se sync karta hai (25 July ka fix) |
| W2 | "Sirf 8 aria-label — icon-only controls unlabeled" | **Galat.** Har icon-only control labelled hai; baaki 57 buttons me visible text hai |
| W3 | Reranker Hindi pe kamzor hai | **Galat.** Script ka min/max verdict crude tha. Reranker bimodal hai (0.90+ vs ~0) aur bahut achha kaam karta hai |
| W4 | `lal_kitab` "hub chunk" hai | **Galat.** Uski hubness sabse **kam** hai (0.4727). Asli baat: out-of-distribution query out-of-distribution chunks se match karti hai |
| W5 | z-score se threshold banega | **Galat.** Naapne pe ulta nikla (gap −0.47) |
| W6 | Syllable transliteration se Hinglish theek ho jayega | **Aadha galat.** 89% signal wapas aaya par kachre ka score bhi utna hi chadha (gap −0.057) |

---

## 📊 Ek nazar me

| | Pehle | Ab |
|---|---|---|
| Semantic search | ❌ kabhi chali nahi | ✅ 18,777 vectors |
| Pehli visit download | 171 MB | 18.4 MB |
| Relevance gap | +0.0059 | +0.8878 |
| Har jawab me citation | haan (galat bhi) | sirf jab sach me grounded ho |
| Bhasha | toggle hi sab kuch | script saaf ho to script |
| Tests | 3 files, 35 pass / 9 fail | 4 files, 44 pass (P1 pe confirm) |
| Worker deploy | haath se paste | `wrangler.toml` (P6 pe chalu) |
