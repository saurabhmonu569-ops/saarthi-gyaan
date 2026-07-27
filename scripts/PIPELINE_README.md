# SAARTHI v2 — Knowledge Engine Pipeline

## Prerequisites

```bash
pip install pymupdf pdfplumber
sudo apt-get install tesseract-ocr tesseract-ocr-hin tesseract-ocr-script-deva
```

## Step 1: OCR + Text Extraction

```bash
# Full corpus (6,318 pages — takes 6-12 hours)
python3 scripts/01_ocr_extract.py

# Single book
python3 scripts/01_ocr_extract.py --books bhagavad_gita_shankar

# Test mode (15 pages per book)
python3 scripts/01_ocr_extract.py --max-pages 15

# Output: data/raw/{book_id}/page_NNNN.json
```

## Step 2: Chunking + Structure Detection

```bash
python3 scripts/02_chunk.py

# Output: data/chunks/{book_id}/chunk_NNNNNN.json
#         data/chunks/chunk_manifest.json
```

## Step 3: Embedding + Knowledge Store

```bash
# With real Gemini embeddings:
GEMINI_API_KEY=AIza... python3 scripts/03_embed_build.py

# Without embeddings (keyword search only):
python3 scripts/03_embed_build.py --skip-embeddings

# Output: data/knowledge/knowledge.json
#         data/knowledge/book_manifest.json
#         data/knowledge/chapter_manifest.json
#         data/knowledge/search_manifest.json
```

## Step 4: Deploy to App

```bash
cp data/knowledge/*.json /path/to/saarthi/public/knowledge/
```

## Architecture

```
Sacred PDFs (18 files, 6,318 pages)
    ↓
01_ocr_extract.py (Tesseract hin+eng @ 300 DPI)
    ↓
data/raw/{book_id}/page_{NNNN}.json
    - source_page, language, confidence, devanagari_pct
    ↓
02_chunk.py (Structure detection + semantic chunking)
    ↓
data/chunks/{book_id}/chunk_{NNNNNN}.json
    - chunk_id (deterministic SHA-256)
    - book, chapter, section, verse, page
    - text (1500 char max, never splits verses)
    ↓
03_embed_build.py (Gemini text-embedding-004, 768-dim)
    ↓
public/knowledge/
    knowledge.json       — All chunks + embeddings (browser search store)
    book_manifest.json   — Book catalogue
    chapter_manifest.json— Chapter index
    search_manifest.json — Keyword inverted index

    ↓
src/knowledge/engine.js  — Browser retrieval layer
    loadKnowledge()      — Load knowledge.json at startup
    keywordSearch()      — Fast inverted index search
    semanticSearch()     — Cosine similarity over embeddings
    hybridSearch()       — Merged keyword + semantic
    crossBookSearch()    — Search across all traditions
    getBooks()           — Book catalogue
    getChapters()        — Chapter list for a book
    getChapterChunks()   — Chunks for a chapter
```

## Book Registry (18 books)

| ID | Title | Pages | OCR |
|----|-------|-------|-----|
| bhagavad_gita_shankar | Shrimad Bhagavad Gita (Shankar Bhashya) | 529 | YES |
| bhagavad_gita_smbg1 | Srimad Bhagavad Gita Part 1 | 20 | YES |
| bhagavad_gita_smbg2 | Srimad Bhagavad Gita Part 2 | 18 | YES |
| valmiki_ramayana | Valmiki Ramayana | 564 | YES |
| rigveda_1 | Rigveda Part 1 | 369 | YES |
| rigveda_2 | Rigveda Part 2 | 370 | YES |
| samaveda | Samaveda | 328 | YES |
| yajurveda | Yajurveda | 420 | YES |
| atharvaveda_1 | Atharvaveda Part 1 | 470 | YES |
| shiva_purana_1 | Shiva Purana Part 1 | 406 | YES |
| shiva_purana_2 | Shiva Purana Part 2 | 406 | YES |
| garuda_purana_1 | Garuda Purana Part 1 | 264 | YES |
| garuda_purana_2 | Garuda Purana Part 2 | 264 | YES |
| vishnu_purana_1 | Vishnu Purana Part 1 | 267 | YES |
| vishnu_purana_2 | Vishnu Purana Part 2 | 268 | YES |
| narasimha_purana | Narasimha Purana | 298 | YES |
| bhavishya_purana | Bhavishya Purana | 448 | YES |
| guru_granth_sahib | Guru Granth Sahib (Hindi) | 609 | YES |

## Future: Supabase Migration

When migrating to pgvector, only change `03_embed_build.py` to write to Supabase
and replace `engine.js::semanticSearch()` with a `fetch("/api/retrieve")` call.
Chunk schema is identical — no changes to callers.

```sql
-- Supabase pgvector table (identical chunk schema)
CREATE TABLE saarthi_chunks (
  chunk_id    TEXT PRIMARY KEY,
  book_id     TEXT,
  book_title  TEXT,
  tradition   TEXT,
  page        INT,
  chapter     INT,
  section     INT,
  verse       INT,
  language    TEXT,
  text        TEXT,
  word_count  INT,
  confidence  FLOAT,
  embedding   vector(768)
);
CREATE INDEX ON saarthi_chunks USING ivfflat (embedding vector_cosine_ops);
```
