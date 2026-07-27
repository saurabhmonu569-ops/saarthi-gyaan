# SAARTHI v1.0.0 — Release Notes
## Guide To Lost Divine Knowledge

Release Date: June 2026  
Build: Vite v5.4.21 · React 18.3.1 · 39 modules · 2.82s

---

## What is SAARTHI?

SAARTHI (सारथी) is a spiritual AI companion that combines ancient wisdom from the Bhagavad Gita, Upanishads, Ramayana, Vedas, and Guru Granth Sahib with modern AI to help people navigate life's real questions — career confusion, emotional difficulty, relationship challenges, and the search for purpose.

---

## Features Completed in v1.0.0

### AI Chat
- Gemini 1.5 Flash integration with request queue and exponential backoff
- Rate limit auto-recovery: silent fallback to offline responses when quota hit
- Chat history persisted in localStorage — AI retains conversation context across page refreshes
- historyRef seeded from restored messages — AI remembers previous exchanges after reload
- Mic input (Hindi/English) via Web Speech API
- Copy and Listen controls on every AI message
- Typing indicator with phase labels (Thinking / Writing / Retrying)
- Demo mode with smart offline fallback responses when no API key configured

### PDF Intelligence
- Real PDF text extraction via PDF.js (loaded from CDN — no npm package needed)
- Concurrent upload protection via parse token — latest upload always wins
- Scanned PDF detection with helpful error guidance
- Password-protected PDF detection
- 50MB file size guard before parsing begins
- Semantic chunking and section detection
- Up to 25,000 characters of document context passed to Gemini
- PDF worker destroyed after parsing to prevent memory accumulation
- Document Q&A with 6 quick-action chips

### Sacred Books Library
- Bhagavad Gita (all 18 chapters with full text)
- Valmiki Ramayana (7 Kandas)
- Upanishads (Principal texts)
- Vedas (Selected hymns and teachings)
- Guru Granth Sahib (Selected shabads)
- Chapter-level bookmarks persisted in localStorage
- Reading progress tracked and visualised per book
- Continue Reading — resumes at last read chapter
- A− / A+ font size controls (13–24px, persisted in localStorage, NaN-safe)
- Listen to any chapter via TTS

### Audio System
- ElevenLabs integration when VITE_ELEVENLABS_API_KEY is set
- Browser Web Speech API fallback (female voice preferred)
- Real play / pause / resume / stop controls
- Per-sentence progress bar
- Audio stopped automatically on tab navigation
- UI state synchronised with AudioEngine via _stopCallback pattern
- Sentence-level splitting prevents browser TTS cutoff on long texts

### Navigation
- 5-tab bottom navigation: Home · Ask · Books · Listen · Upload
- CSS visibility pattern — all views permanently mounted, zero state loss on tab switch
- Persistent Home button on all non-home tabs
- Chat messages, PDF state, and book position survive navigation
- Back navigation in all sub-views

### Security
- XSS protection: escapeHtml() applied before all dangerouslySetInnerHTML
- All 5 HTML-dangerous characters escaped (&, <, >, ", ')
- Gemini API key loaded only via Vite env vars — never hardcoded
- No API keys in committed files
- ErrorBoundary on every view — prevents white-screen crashes

### State and Persistence
- Chat history: last 60 messages saved, error/loading messages excluded
- Book progress: per-book chapter progress in localStorage
- Bookmarks: per-chapter bookmark state in localStorage
- Font size: reader font preference in localStorage
- Return visit detection: session timestamp for personalised greeting
- Daily streak tracking
- All localStorage reads wrapped in try/catch — corrupted data fails gracefully

### Mobile
- Mobile-first layout, max-width 680px, centered on desktop
- 100dvh for correct height on mobile browsers
- safe-area-inset-bottom for iPhone notch
- Two-row ChapterReader header for readability at 375px
- Touch-friendly tap targets (≥36px)
- Word-break protection on chat bubbles

### UX Improvements
- Bilingual bottom nav: English label + Hindi sub-label
- Mood-based time-aware greetings (6 time slots, Hindi/English)
- Wisdom card with prev/next navigation across all traditions
- Continue conversation card on Home (last user message as chip)
- Splash screen skipped on return visits (after first boot)
- Daily streak with spiritual framing
- Font size indicator in reader header

---

## Security Improvements

| Area | Implementation |
|------|---------------|
| XSS | escapeHtml() before all AI content rendering |
| API Keys | Vite env vars only, .env in .gitignore |
| Error Boundaries | Class component wrapping each view |
| LocalStorage | All reads in try/catch, type validation on font size |
| PDF Parsing | File type check, 50MB size limit, password detection |

---

## Known Limitations

### Gemini API
- Free tier: 15 requests/minute, 1,500/day. Rate limit triggers silent fallback.
- No API key = demo mode with static fallback responses.
- Conversation context limited to last 60 messages (by design — localStorage cap).

### PDF
- Scanned image PDFs (no text layer) not supported — requires OCR pre-processing.
- PDFs > 50MB rejected before parsing.
- Context passed to Gemini capped at 25,000 characters (~12 pages of dense text).
- Very large PDFs (200+ pages) may take 10–20 seconds to parse on slow connections.
- PDF.js worker not preloaded — first upload has 2–3 second CDN download delay.

### Audio
- Without ElevenLabs key: browser TTS sounds robotic (by design — disclosed to user).
- Browser TTS pause during inter-sentence gap (80ms) may not pause immediately.
- Hindi text read via `en-IN` voice — native Hindi TTS requires ElevenLabs multilingual.
- iOS Safari: `speechSynthesis.pause()` not supported — stop/play only.

### Accessibility
- ARIA labels added to critical icon buttons but full WCAG AA not certified.
- Keyboard navigation for bottom tabs requires manual Tab key usage.
- Color contrast for muted text (#C4B8AC on white) is 1.9:1 — below WCAG AA threshold.
  Fix planned for v1.1.

### General
- No backend — all data stays in browser localStorage.
- Two-tab sync: Last write wins if app open in multiple tabs simultaneously.
- No account system, no cloud sync, no sharing.

---

## Upgrade Path to v1.1

- Full ARIA compliance (WCAG AA)
- Swipe navigation between tabs
- Share chat message as image card
- ElevenLabs voice with Hindi Devanagari support
- Move API keys to a backend proxy (eliminates browser bundle exposure)

---

## Setup

```bash
unzip SAARTHI_v1_RELEASE.zip
cd saarthi
npm install
cp .env.example .env
# Add VITE_GEMINI_API_KEY from https://aistudio.google.com/app/apikey
npm run dev
```

See README.md for full setup instructions.
