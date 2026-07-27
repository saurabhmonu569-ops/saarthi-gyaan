# SAARTHI — Setup Guide

## ⚡ FASTEST WAY TO GET REAL AI (5 minutes)

### Step 1: Get your FREE Gemini API Key
1. Go to → **https://aistudio.google.com/app/apikey**
2. Sign in with Google
3. Click **"Create API Key"**
4. Copy the key (starts with `AIzaSy...`)

### Step 2: Add the key to SAARTHI
Open the file called `.env` in your saarthi folder and change this:
```
VITE_GEMINI_API_KEY=DEMO_MODE
```
To this:
```
VITE_GEMINI_API_KEY=AIzaSyYourActualKeyHere
```

### Step 3: Restart the app
```bash
npm run dev
```

The yellow "Demo Mode" banner will disappear and you'll get real AI responses.

---

## Optional: ElevenLabs Voice (Premium audio)

For natural, warm voice instead of robotic TTS:
1. Go to → **https://elevenlabs.io** → Sign up free
2. Copy your API key
3. Add to `.env`:
   ```
   VITE_ELEVENLABS_API_KEY=your_key_here
   ```
4. Restart: `npm run dev`

Free tier: 10,000 characters/month.

---

## Optional: Full Sacred Books Ingestion

To get real text from all 18 sacred PDFs (not just 5% sample):

### Requirements
```bash
pip install pymupdf
sudo apt-get install tesseract-ocr tesseract-ocr-hin
```

### Run overnight (6-12 hours)
```bash
# Put your 18 PDFs in saarthi/pdfs/ folder first
mkdir pdfs
# Copy PDFs: BHAGVAT_GEETA.pdf, RAMAYAN.pdf, etc.

# Run with your Gemini key for embeddings:
GEMINI_API_KEY=AIzaSy... python3 scripts/run_ingestion.py

# Or without embeddings (keyword search still works):
python3 scripts/run_ingestion.py
```

This processes all 6,318 pages and replaces the sample knowledge base.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Demo mode" banner | Add Gemini API key to `.env` (see above) |
| Robot voice | Add ElevenLabs key OR your browser's TTS voices are limited |
| Search "Dharma" returns nothing | Normal — search in Hindi: "धर्म". English→Hindi transliteration is now automatic |
| Books show garbled text | OCR quality — run full ingestion pipeline for better text |
| Screen cut off | Use Chrome/Firefox on desktop or Chrome on Android |

---

## Local Development
```bash
npm install
npm run dev     # → http://localhost:3000
```

## Build for Production
```bash
npm run build   # → dist/ folder
```
