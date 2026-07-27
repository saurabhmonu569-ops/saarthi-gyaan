#!/usr/bin/env python3
"""
SAARTHI v2 — Knowledge Engine
Script 02: Structure Detection + Chunking Pipeline

Reads per-page JSON from Script 01.
Detects: chapters, sections, verses, paragraphs.
Creates chunks with complete metadata.
Respects natural scripture structure — never splits verses or shlokas.

Input:  data/raw/{book_id}/page_{NNNN}.json
Output: data/chunks/{book_id}/chunk_{NNNNNN}.json
        data/chunks/chunk_manifest.json
"""

import json, re, uuid, hashlib, time, unicodedata
from pathlib import Path

BASE_DIR  = Path(__file__).resolve().parent.parent / "data"
RAW_DIR   = BASE_DIR / "raw"
CHUNK_DIR = BASE_DIR / "chunks"
CHUNK_DIR.mkdir(parents=True, exist_ok=True)

# ─── STRUCTURE DETECTORS ──────────────────────────────────────────────────────

# Chapter / Adhyaya patterns (Hindi + Sanskrit)
CHAPTER_PATTERNS = [
    re.compile(r'(?:अध्याय|अधयाय|adhyay)\s*[–\-:]?\s*([०-९\d]+)', re.IGNORECASE | re.UNICODE),
    re.compile(r'(?:chapter|CH\.?)\s*[–\-:]?\s*(\d+)', re.IGNORECASE),
    re.compile(r'(?:काण्ड|कान्ड|kanda)\s*[–\-:]?\s*([०-९\w]+)', re.IGNORECASE | re.UNICODE),
    re.compile(r'(?:सर्ग|सग|Sarga)\s*[–\-:]?\s*([०-९\d]+)', re.IGNORECASE | re.UNICODE),
    re.compile(r'(?:मण्डल|mandal)\s*[–\-:]?\s*([०-९\d]+)', re.IGNORECASE | re.UNICODE),
    re.compile(r'(?:CHAPTER|अध्याय)\s+([A-Z0-9०-९]+)', re.UNICODE),
]

# Section patterns
SECTION_PATTERNS = [
    re.compile(r'(?:खण्ड|khand|section)\s*[–\-:]?\s*([०-९\d]+)', re.IGNORECASE | re.UNICODE),
    re.compile(r'(?:पर्व|parva)\s*[–\-:]?\s*([०-९\w]+)', re.IGNORECASE | re.UNICODE),
]

# Verse / Shloka patterns
VERSE_PATTERNS = [
    # "॥ 3.14 ॥" or "3.14" or "(3-14)" Sanskrit verse notation
    re.compile(r'[।॥]\s*(?:\d+[\.\-]\d+|\d+)\s*[।॥]'),
    re.compile(r'\|\|\s*\d+\s*\|\|'),
    re.compile(r'(?:श्लोक|shlok)\s*(\d+)', re.IGNORECASE | re.UNICODE),
]

def to_int(devanagari_or_arabic: str) -> int:
    """Convert Devanagari numeral string to int."""
    DEVA_DIGITS = str.maketrans('०१२३४५६७८९', '0123456789')
    return int(devanagari_or_arabic.translate(DEVA_DIGITS).strip() or 0)

def detect_structure(text: str, current: dict) -> dict:
    """
    Detect chapter/section/verse from a line.
    Returns updated structure dict.
    """
    s = dict(current)
    for pat in CHAPTER_PATTERNS:
        m = pat.search(text)
        if m:
            try: s["chapter"] = to_int(m.group(1))
            except: s["chapter"] = (s.get("chapter") or 0) + 1
            s["section"]  = None
            s["verse"]    = None
            s["chapter_title"] = text.strip()[:120]
            return s
    for pat in SECTION_PATTERNS:
        m = pat.search(text)
        if m:
            try: s["section"] = to_int(m.group(1))
            except: s["section"] = (s.get("section") or 0) + 1
            s["verse"] = None
            return s
    for pat in VERSE_PATTERNS:
        if pat.search(text):
            s["verse"] = (s.get("verse") or 0) + 1
            return s
    return s

# ─── CHUNK SPLITTER ───────────────────────────────────────────────────────────

# Chunk rules:
#  - Max chars: 1500
#  - Min chars: 100
#  - Never split mid-verse (detected by ।। pattern)
#  - Split on double-newline (paragraph boundary) first
#  - Fall back to sentence split if paragraph too long

MAX_CHUNK_CHARS = 1500
MIN_CHUNK_CHARS = 80

def is_verse_boundary(line: str) -> bool:
    """True if this line marks the END of a complete verse."""
    return bool(re.search(r'[।॥]\s*(?:[०-९\d]+[\.\-]?[०-९\d]*\s*)?[।॥]?$', line.strip()))

def split_into_chunks(text: str) -> list[str]:
    """
    Split text into semantic chunks respecting:
    1. Natural paragraph boundaries (double newline)
    2. Verse boundaries (।। markers)
    3. Max size limit
    4. Never split mid-verse
    """
    if not text:
        return []

    # First split by paragraph (double newline)
    paragraphs = [p.strip() for p in re.split(r'\n\n+', text) if p.strip()]

    chunks    = []
    current   = ""
    in_verse  = False

    for para in paragraphs:
        # Check if this paragraph is a verse block
        verse_like = bool(re.search(r'[।॥]', para))

        # If adding this para would exceed max, flush current
        candidate = (current + "\n\n" + para).strip() if current else para
        if len(candidate) > MAX_CHUNK_CHARS and current:
            if len(current.strip()) >= MIN_CHUNK_CHARS:
                chunks.append(current.strip())
            current = para
        else:
            current = candidate

    if current.strip() and len(current.strip()) >= MIN_CHUNK_CHARS:
        chunks.append(current.strip())

    # Final safety: if any chunk is still too long, split by sentence
    result = []
    for chunk in chunks:
        if len(chunk) <= MAX_CHUNK_CHARS:
            result.append(chunk)
        else:
            # Split by sentence boundary
            sentences = re.split(r'(?<=[।.!?\n])\s+', chunk)
            sub = ""
            for sent in sentences:
                if len(sub + " " + sent) > MAX_CHUNK_CHARS and sub:
                    if len(sub.strip()) >= MIN_CHUNK_CHARS:
                        result.append(sub.strip())
                    sub = sent
                else:
                    sub = (sub + " " + sent).strip()
            if sub.strip() and len(sub.strip()) >= MIN_CHUNK_CHARS:
                result.append(sub.strip())
    return result

# ─── CHUNK ID ─────────────────────────────────────────────────────────────────

def make_chunk_id(book_id: str, page: int, chunk_idx: int) -> str:
    """Deterministic chunk ID — stable across re-runs."""
    raw = f"{book_id}::{page:04d}::{chunk_idx:04d}"
    h   = hashlib.sha256(raw.encode()).hexdigest()[:12]
    return f"ck_{h}"

# ─── MAIN CHUNKER ─────────────────────────────────────────────────────────────

def chunk_book(book_id: str, book_info: dict) -> dict:
    raw_dir   = RAW_DIR / book_id
    chunk_out = CHUNK_DIR / book_id
    chunk_out.mkdir(parents=True, exist_ok=True)

    page_files = sorted(raw_dir.glob("page_*.json"))
    if not page_files:
        return {"book_id": book_id, "status": "no_raw_pages", "chunks": 0}

    print(f"\n  [{book_id}]  {len(page_files)} pages → chunking")

    structure   = {"chapter": None, "section": None, "verse": None,
                   "chapter_title": None, "kanda": None}
    all_chunks  = []
    chunk_global_idx = 0
    chapters_seen    = set()
    sections_seen    = set()

    for pf in page_files:
        page_data = json.loads(pf.read_text(encoding="utf-8"))
        meta      = page_data.get("meta", {})
        qa        = page_data.get("qa", {})
        text      = page_data.get("text", "")

        # Skip failed / blank pages
        if qa.get("status") in ("blank", "low_conf") or not text:
            continue

        # PAGE FIX (audit): OCR ke page-JSON mein meta khaali tha, isliye har
        # chunk ka page 0/1 ban gaya tha (poore app mein "p.1" dikhta tha).
        # Ab page number FILENAME se nikalo: page_0119.json → 119.
        try:
            fname_pg = int(pf.stem.split("_")[1])
        except Exception:
            fname_pg = 0
        pg_no      = meta.get("source_page") or fname_pg
        pg_display = meta.get("page_display") or (pg_no + 1)

        # Update structure from each line
        for line in text.split('\n'):
            if line.strip():
                structure = detect_structure(line, structure)

        if structure.get("chapter") is not None:
            chapters_seen.add(structure["chapter"])
        if structure.get("section") is not None:
            sections_seen.add((structure.get("chapter"), structure["section"]))

        # Split page text into chunks
        page_chunks = split_into_chunks(text)

        for ci, chunk_text in enumerate(page_chunks):
            chunk_id = make_chunk_id(book_id, pg_no, ci)

            chunk = {
                # ── Identity ────────────────────────────────────────────
                "chunk_id":       chunk_id,
                "chunk_index":    chunk_global_idx,

                # ── Provenance ──────────────────────────────────────────
                "book_id":        book_id,
                "book_title":     meta.get("book_title", "") or book_info.get("title", ""),
                "tradition":      meta.get("tradition", ""),
                "source_pdf":     meta.get("source_pdf", ""),
                "source_page":    pg_no,
                "page_display":   pg_display,
                "language":       meta.get("language", ""),
                "script":         meta.get("script", ""),

                # ── Structure ───────────────────────────────────────────
                "chapter":        structure.get("chapter"),
                "chapter_title":  structure.get("chapter_title"),
                "section":        structure.get("section"),
                "verse":          structure.get("verse"),
                "kanda":          structure.get("kanda"),
                "paragraph":      ci + 1,

                # ── Content ─────────────────────────────────────────────
                "text":           chunk_text,
                "word_count":     len(chunk_text.split()),
                "char_count":     len(chunk_text),

                # ── QA ──────────────────────────────────────────────────
                "ocr_confidence": qa.get("confidence", 0),
                "extraction_method": meta.get("method", ""),

                # ── Embedding placeholder ────────────────────────────────
                "embedding_id":   None,   # filled by Script 03
                "embedding":      None,   # filled by Script 03
            }
            all_chunks.append(chunk)
            # Write individual chunk file
            (chunk_out / f"chunk_{chunk_global_idx:06d}.json").write_text(
                json.dumps(chunk, ensure_ascii=False, indent=2), encoding="utf-8")
            chunk_global_idx += 1

    total_words = sum(c["word_count"] for c in all_chunks)
    summary = {
        "book_id":        book_id,
        "title":          book_info.get("title",""),
        "tradition":      book_info.get("tradition",""),
        "chunks":         len(all_chunks),
        "total_words":    total_words,
        "chapters_found": sorted(list(chapters_seen)),
        "chapter_count":  len(chapters_seen),
        "section_count":  len(sections_seen),
        "status":         "complete",
    }
    # Write book-level chunk index
    (chunk_out / "book_chunk_index.json").write_text(
        json.dumps({"book_id": book_id, "chunks": [c["chunk_id"] for c in all_chunks]},
                   ensure_ascii=False), encoding="utf-8")
    print(f"    chunks={len(all_chunks)} chapters={len(chapters_seen)} words={total_words:,}")
    return summary


def main(book_ids=None):
    manifest_path = RAW_DIR / "extraction_manifest.json"
    if not manifest_path.exists():
        print("ERROR: Run 01_ocr_extract.py first")
        return

    ext_manifest  = json.loads(manifest_path.read_text(encoding="utf-8"))
    books_extracted = {b["book_id"]: b for b in ext_manifest.get("books", [])}

    targets = [bid for bid in books_extracted if not book_ids or bid in book_ids]
    print(f"\n{'='*60}")
    print(f"  SAARTHI v2 — Chunking Pipeline")
    print(f"  Books: {len(targets)}")
    print(f"{'='*60}")

    t0 = time.time(); summaries = []
    for bid in targets:
        s = chunk_book(bid, books_extracted[bid])
        summaries.append(s)

    manifest = {
        "stage":   "02_chunk",
        "books":   summaries,
        "elapsed": round(time.time()-t0, 1),
        "total_chunks": sum(s.get("chunks",0) for s in summaries),
    }
    mp = CHUNK_DIR / "chunk_manifest.json"
    mp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  Total chunks: {manifest['total_chunks']:,}")
    print(f"  Manifest → {mp}")
    return manifest

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--books", nargs="*")
    a = p.parse_args()
    main(book_ids=a.books)
