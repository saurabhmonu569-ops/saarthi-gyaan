#!/usr/bin/env python3
"""
SAARTHI v2 — Knowledge Engine
Script 03: Gemini Embedding Generation

Reads chunks from Script 02.
Calls Gemini text-embedding-004 for each chunk.
Rate-limits to stay within free-tier: 1500 RPD, 100 RPM.
Writes embedding to chunk files and builds knowledge.json.

Input:  data/chunks/{book_id}/chunk_{NNNNNN}.json
Output: data/knowledge/knowledge.json   (browser search store)
        data/knowledge/book_manifest.json
        data/knowledge/chapter_manifest.json
        data/knowledge/search_manifest.json
"""

import json, os, time, hashlib, sys, re
from pathlib import Path

# Gemini REST — no SDK needed, avoids browser-vs-Node env issues
import urllib.request, urllib.error

BASE_DIR      = Path(__file__).resolve().parent.parent / "data"
CHUNK_DIR     = BASE_DIR / "chunks"
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)

# ─── GEMINI CONFIG ────────────────────────────────────────────────────────────
GEMINI_API_KEY  = os.environ.get("GEMINI_API_KEY", "")
EMBED_MODEL     = "models/text-embedding-004"
EMBED_ENDPOINT  = (f"https://generativelanguage.googleapis.com/v1beta/"
                   f"{EMBED_MODEL}:embedContent?key={GEMINI_API_KEY}")
EMBED_DIM       = 768

# Rate limits (free tier)
RPM_LIMIT       = 100   # requests per minute
RPD_LIMIT       = 1500  # requests per day
RPM_DELAY       = 60.0 / (RPM_LIMIT * 0.85)  # 0.85 safety factor


def embed_text(text: str) -> list[float] | None:
    """
    Call Gemini text-embedding-004 for a single text string.
    Returns 768-dim float list or None on failure.
    task_type=SEMANTIC_SIMILARITY → optimised for retrieval comparison.
    """
    if not GEMINI_API_KEY:
        # Demo mode: return zero vector (browser search falls back to keyword)
        return [0.0] * EMBED_DIM

    # Gemini embedding max: 2048 tokens ≈ 8000 chars
    truncated = text[:8000]

    payload = json.dumps({
        "model": EMBED_MODEL,
        "content": {"parts": [{"text": truncated}]},
        "taskType": "SEMANTIC_SIMILARITY",
    }).encode()

    req = urllib.request.Request(
        EMBED_ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
                return data["embedding"]["values"]
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 429:
                wait = 60 * (attempt + 1)
                print(f"      429 rate limit — waiting {wait}s")
                time.sleep(wait)
                continue
            print(f"      HTTP {e.code}: {body[:200]}")
            return None
        except Exception as ex:
            print(f"      Error: {ex}")
            time.sleep(5)
    return None


def load_all_chunks() -> list[dict]:
    chunks = []
    for book_dir in sorted(CHUNK_DIR.iterdir()):
        if not book_dir.is_dir(): continue
        for cf in sorted(book_dir.glob("chunk_*.json")):
            try:
                c = json.loads(cf.read_text(encoding="utf-8"))
                c["_file"] = str(cf)
                chunks.append(c)
            except: pass
    return chunks


def build_knowledge_store(chunks: list[dict]) -> dict:
    """
    Build the final knowledge.json structure for browser consumption.
    This is what the React app loads at startup.
    Schema is forward-compatible with Supabase/Pinecone migration.
    """
    store = {
        "version":       "2.0.0",
        "schema":        "saarthi-knowledge-v2",
        "embed_model":   EMBED_MODEL,
        "embed_dim":     EMBED_DIM,
        "total_chunks":  len(chunks),
        "chunks":        [],
    }

    for c in chunks:
        store["chunks"].append({
            # These fields are loaded into browser memory for search
            "id":          c["chunk_id"],
            "book":        c["book_id"],
            "book_title":  c["book_title"],
            "tradition":   c["tradition"],
            "page":        c["page_display"],
            "chapter":     c.get("chapter"),
            "chapter_title": c.get("chapter_title"),
            "section":     c.get("section"),
            "verse":       c.get("verse"),
            "language":    c.get("language"),
            "text":        c["text"],
            "word_count":  c["word_count"],
            "confidence":  c.get("ocr_confidence", 0),
            "embedding":   c.get("embedding"),  # 768-dim list or None
        })
    return store


def build_book_manifest(chunks: list[dict]) -> dict:
    books = {}
    for c in chunks:
        bid = c["book_id"]
        if bid not in books:
            books[bid] = {
                "book_id":    bid,
                "title":      c["book_title"],
                "tradition":  c["tradition"],
                "language":   c.get("language",""),
                "chunk_count": 0,
                "chapters":   set(),
                "page_range": [9999, 0],
            }
        b = books[bid]
        b["chunk_count"] += 1
        if c.get("chapter"): b["chapters"].add(c["chapter"])
        pg = c.get("page_display", 0)
        if pg < b["page_range"][0]: b["page_range"][0] = pg
        if pg > b["page_range"][1]: b["page_range"][1] = pg

    for b in books.values():
        b["chapters"] = sorted(list(b["chapters"]))
        b["chapter_count"] = len(b["chapters"])

    return {"version": "2.0.0", "books": list(books.values())}


def build_chapter_manifest(chunks: list[dict]) -> dict:
    chapters = {}
    for c in chunks:
        if not c.get("chapter"): continue
        key = f"{c['book_id']}::ch{c['chapter']}"
        if key not in chapters:
            chapters[key] = {
                "book_id":       c["book_id"],
                "chapter":       c["chapter"],
                "chapter_title": c.get("chapter_title"),
                "first_page":    c["page_display"],
                "chunk_ids":     [],
            }
        chapters[key]["chunk_ids"].append(c["chunk_id"])
    return {"version": "2.0.0", "chapters": list(chapters.values())}


def build_search_manifest(chunks: list[dict]) -> dict:
    """
    Keyword index: for each significant word → list of chunk IDs.
    Used for fast keyword search without embeddings.
    """
    STOP_HI = set("का के की को कि में से और पर यह जो है ने भी एक था".split())
    STOP_EN = set("the a an is in of to and or for with on at by".split())
    stop    = STOP_HI | STOP_EN

    # Har word ke liye (chunk_id, us chunk mein kitni baar aaya) rakho —
    # phir har word ke TOP-300 sabse zyada-frequency chunks index mein jayen.
    # (Purana code >200-chunk words ko DELETE karta tha — 17,613 chunks pe
    #  dharma/karma/shiv jaise SAB important words delete ho gaye the!)
    from collections import Counter
    index = {}
    for c in chunks:
        cid   = c["chunk_id"]
        words = re.findall(r'[\u0900-\u097Fa-zA-Z]{3,}', c["text"].lower())
        for w, cnt in Counter(w for w in words if w not in stop).items():
            index.setdefault(w, []).append((cid, cnt))

    TOP_PER_WORD = 300
    trimmed = {}
    for w, pairs in index.items():
        pairs.sort(key=lambda t: -t[1])
        trimmed[w] = [cid for cid, _ in pairs[:TOP_PER_WORD]]
    return {"version": "2.1.0", "keyword_index": trimmed}


def main(book_ids=None, skip_embeddings=False):
    print(f"\n{'='*60}")
    print(f"  SAARTHI v2 — Embedding + Knowledge Store Builder")
    print(f"  API key set: {'YES' if GEMINI_API_KEY else 'NO (demo mode)'}")
    print(f"{'='*60}")

    chunks = load_all_chunks()
    if book_ids:
        chunks = [c for c in chunks if c["book_id"] in book_ids]

    print(f"  Loaded {len(chunks):,} chunks from {len(set(c['book_id'] for c in chunks))} books")

    if not skip_embeddings and GEMINI_API_KEY:
        print(f"\n  Generating embeddings (this takes time at {RPM_LIMIT} RPM)...")
        t0        = time.time()
        embedded  = 0
        failed    = 0

        for i, chunk in enumerate(chunks):
            if chunk.get("embedding"):
                embedded += 1
                continue  # already embedded (resume support)

            emb = embed_text(chunk["text"])
            if emb:
                chunk["embedding"] = emb
                # Write back to chunk file
                cf = Path(chunk["_file"])
                data = json.loads(cf.read_text(encoding="utf-8"))
                data["embedding"]    = emb
                data["embedding_id"] = chunk["chunk_id"]
                cf.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
                embedded += 1
            else:
                failed += 1

            time.sleep(RPM_DELAY)

            if (i+1) % 50 == 0:
                elapsed = time.time() - t0
                rate    = (i+1) / elapsed
                eta_s   = (len(chunks) - i - 1) / max(0.01, rate)
                print(f"    {i+1}/{len(chunks)}  embedded={embedded} failed={failed} "
                      f"rate={rate:.1f}/s  ETA={eta_s/60:.1f}min")

        print(f"\n  Embeddings: {embedded} OK, {failed} failed")
    else:
        print("  Skipping embeddings (no API key or --skip-embeddings)")

    # Build knowledge store
    print("\n  Building knowledge store JSON files...")
    knowledge      = build_knowledge_store(chunks)
    book_manifest  = build_book_manifest(chunks)
    ch_manifest    = build_chapter_manifest(chunks)
    search_manifest = build_search_manifest(chunks)

    # Write outputs
    kp = KNOWLEDGE_DIR / "knowledge.json"
    bp = KNOWLEDGE_DIR / "book_manifest.json"
    cp = KNOWLEDGE_DIR / "chapter_manifest.json"
    sp = KNOWLEDGE_DIR / "search_manifest.json"

    kp.write_text(json.dumps(knowledge, ensure_ascii=False), encoding="utf-8")           # no indent → compact
    bp.write_text(json.dumps(book_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    cp.write_text(json.dumps(ch_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    sp.write_text(json.dumps(search_manifest, ensure_ascii=False), encoding="utf-8")

    ksize = kp.stat().st_size / 1024
    print(f"\n  knowledge.json       → {kp}  ({ksize:.0f} KB)")
    print(f"  book_manifest.json   → {bp}")
    print(f"  chapter_manifest.json→ {cp}")
    print(f"  search_manifest.json → {sp}")
    print(f"\n  Total chunks in store: {knowledge['total_chunks']:,}")

    return knowledge

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--books", nargs="*")
    p.add_argument("--skip-embeddings", action="store_true")
    a = p.parse_args()
    main(book_ids=a.books, skip_embeddings=a.skip_embeddings)
