# 🔑 SAARTHI — AI Enable Karne Ke Steps

## Aapka Problem
"Demo mode" dikh raha hai — matlab API key `.env` file mein sahi nahi hai, ya `npm run dev` restart nahi hua.

---

## ✅ RECOMMENDED: Groq API (FREE + FAST)

Google AI Studio ab kai logon ko `AQ.` wale OAuth tokens deta hai jo Gemini API ke saath **kaam nahi karte**. Isliye Groq best hai.

### Step 1: Groq key banao
1. → https://console.groq.com/keys
2. Sign in karo (Google account chalega)
3. "Create API Key" dabaao
4. Key copy karo — **`gsk_` se shuru hogi**

**BILKUL FREE — credit card ki zaroorat nahi!**

### Step 2: .env file open karo
`saarthi` folder mein `.env` file kholo (hidden ho sakti hai — "Show hidden files" on karo).

### Step 3: Key paste karo
```
VITE_GEMINI_API_KEY=gsk_TumhariActualKeyYahan
```
> Haan, variable ka naam `VITE_GEMINI_API_KEY` hi rahega — app khud detect kar leta hai ki key Groq ki hai (`gsk_`) ya Gemini ki (`AIzaSy`).

### Step 4: Save karo (Ctrl+S)

### Step 5: Dev server RESTART karo
```bash
# Terminal mein Ctrl+C dabao, phir:
npm run dev
```
> ⚠️ Vite `.env` ko sirf startup pe padhta hai — restart zaroori hai.

### Step 6: Browser mein http://localhost:3000 reload karo

---

## Kaise pata chalega ki kaam kiya?
- "Demo mode" wala yellow banner **gayab** ho jaayega
- Chat header mein **green dot** aur "Connected" dikhega
- Ab real AI (Llama 3.3 70B via Groq) jawab dega ✅

---

## Gemini bhi chalega (agar AIzaSy key hai)
```
VITE_GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXX
```
⚠️ Lekin agar aapki key `AQ.` se shuru hoti hai — woh OAuth token hai, API key nahi. Woh kaam **nahi** karegi. Groq use karo.

---

## Agar phir bhi nahi chala:
- Key `gsk_` ya `AIzaSy` se shuru honi chahiye
- Key ke aage-peeche koi space nahi
- `.env` file `saarthi` folder ke andar ho (same level as `package.json`)
- Server restart kiya ho
