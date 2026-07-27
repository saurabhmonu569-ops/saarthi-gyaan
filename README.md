# SAARTHI — सारथी
## Guide To Lost Divine Knowledge

> *"When you are confused about what to do, when the mind is troubled — Saarthi is there."*

SAARTHI is a spiritual AI companion that brings together the wisdom of the Bhagavad Gita, Upanishads, Ramayana, Vedas, and Guru Granth Sahib — combined with modern AI — to help you navigate life's real questions.

---

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env — add your Gemini API key
npm run dev
```

Open http://localhost:3000

---

## Enable Real AI (Required for full experience)

SAARTHI works in Demo Mode without an API key, but real AI responses require Gemini:

### Step 1 — Get your free Gemini API key
Visit **https://aistudio.google.com/app/apikey**
- Sign in with Google → Create API Key
- Free tier: 15 requests/minute · 1,500/day · No credit card

### Step 2 — Configure .env
```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_GEMINI_API_KEY=AIza...your_key_here
```

### Step 3 — Restart
```bash
npm run dev
```

The status indicator in chat will show green "Connected".

---

## Enable Premium Voice (Optional)

For natural, warm narration instead of browser TTS:

1. Visit **https://elevenlabs.io** → create free account
2. Copy your API key
3. Add to `.env`:
   ```
   VITE_ELEVENLABS_API_KEY=your_key_here
   ```
4. Restart with `npm run dev`

Free tier: 10,000 characters/month.

---

## Features

| Feature | Description |
|---------|-------------|
| 💬 AI Chat | Life guidance, spiritual wisdom, study help |
| 📚 Sacred Books | Bhagavad Gita · Ramayana · Vedas · Upanishads · Guru Granth Sahib |
| 🎧 Audio | Listen to wisdom — ElevenLabs or browser TTS |
| 📄 PDF Chat | Upload any PDF, ask questions, get summaries |

---

## Project Structure

```
saarthi/
├── src/
│   ├── App.jsx                    # Complete UI — all 5 views
│   ├── components/
│   │   └── ErrorBoundary.jsx      # Crash protection for all views
│   ├── context/
│   │   └── AppContext.jsx         # Shared state: lang, book progress, bookmarks
│   ├── data/
│   │   └── index.js               # Sacred books, wisdoms, audio lessons
│   ├── hooks/
│   │   ├── useChat.js             # AI chat state, history, persistence
│   │   └── useNotes.js            # AI notes generation
│   ├── services/
│   │   ├── gemini.js              # Gemini API: queue, retry, fallback
│   │   ├── fallback.js            # Offline response engine
│   │   └── pdfParser.js           # PDF.js text extraction + chunking
│   ├── styles/
│   │   └── globals.css            # Tailwind base + keyframes
│   └── main.jsx                   # App entry point
├── public/
│   ├── favicon.svg
│   └── manifest.json
├── .env.example                   # Environment variable template
├── RELEASE_NOTES.md               # Full changelog
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Build

```bash
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
```

---

## Deploy

**Netlify (easiest):**
1. `npm run build`
2. Drag `dist/` to netlify.com/drop
3. Add environment variables in Site Settings

**Vercel:**
```bash
npx vercel --prod
```
Add `VITE_GEMINI_API_KEY` in Vercel dashboard → Environment Variables.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Yes* | Gemini API key from aistudio.google.com |
| `VITE_GEMINI_MODEL` | No | Default: `gemini-1.5-flash` |
| `VITE_ELEVENLABS_API_KEY` | No | ElevenLabs for premium voice |
| `VITE_ELEVENLABS_VOICE_ID` | No | Default: Rachel (21m00Tcm4TlvDq8ikWAM) |

*Without Gemini key, app runs in Demo Mode with static fallback responses.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Demo mode only | Add `VITE_GEMINI_API_KEY` to `.env` and restart `npm run dev` |
| "Model not available" | Try setting `VITE_GEMINI_MODEL=gemini-1.5-flash-latest` |
| PDF won't parse | File must have selectable text (not a scanned image). Max 50MB. |
| No audio | Tap "Begin Your Journey" on splash to unlock browser audio |
| Robotic voice | Add ElevenLabs key for natural voice |
| Rate limit errors | Normal on free tier — app auto-falls back, retries after cooldown |

---

## License

MIT License — free to use, modify, and distribute.

Built with React 18 · Vite 5 · Google Gemini · ElevenLabs · PDF.js
