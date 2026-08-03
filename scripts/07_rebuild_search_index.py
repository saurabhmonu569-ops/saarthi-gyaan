#!/usr/bin/env python3
"""
SAARTHI — Rebuild keyword-search index shards (public/knowledge/index/shard_*.json)
======================================================================================
WHY: engine.js's keywordSearch() does NOT scan book text at query time — it
looks up pre-built word -> [chunk_id, ...] maps stored in index/shard_0..7.json
(merged in memory via Object.assign). Whenever a book's chunks change (new
chunk IDs, edited/added text), this index goes stale: the new chunk IDs are
simply invisible to keyword search until the index is rebuilt.

This replicates the EXACT indexing algorithm from the original
scripts/03_embed_build.py::build_search_index() (verified by reading that
function directly), so word keys and matching behavior stay identical to
what engine.js's queryKeywords()/keywordSearch() already expect:
  - words = re.findall(r'[ऀ-ॿa-zA-Z]{3,}', text.lower())
  - drop a small Hindi/English stopword list
  - per word, rank chunk IDs by in-chunk frequency, keep top 300
  - shard by md5(word) % 8 (cosmetic — engine.js merges all shards anyway,
    so this only affects file-size balance, not correctness)

USAGE (from repo root):
  python scripts/07_rebuild_search_index.py

Run this after ANY edit to public/knowledge/books/*.json. Also updates
meta.json's total_chunks to stay in sync.
"""

import json
import re
import hashlib
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
KDIR = ROOT / "public" / "knowledge"
BOOKS_DIR = KDIR / "books"
INDEX_DIR = KDIR / "index"
SHARDS = 8

STOP_HI = set("का के की को कि में से और पर यह जो है ने भी एक था".split())
STOP_EN = set("the a an is in of to and or for with on at by".split())
STOP = STOP_HI | STOP_EN

WORD_RE = re.compile(r"[ऀ-ॿa-zA-Z]{3,}")
TOP_PER_WORD = 300


def main():
    print("=" * 60)
    print("  SAARTHI — Search Index Rebuilder")
    print("=" * 60)

    book_files = sorted(BOOKS_DIR.glob("*.json"))
    if not book_files:
        raise SystemExit(f"No book files found in {BOOKS_DIR}")

    all_chunks = []
    book_ids = []
    for f in book_files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  SKIP {f.name}: invalid JSON ({e})")
            continue
        chunks = data.get("chunks", [])
        book_ids.append(data.get("book", f.stem))
        all_chunks.extend(chunks)
        print(f"  {f.name}: {len(chunks)} chunks")

    print(f"\n  Total chunks: {len(all_chunks)} across {len(book_ids)} books")
    print("  Building keyword index (this scans every chunk's text)...")

    index = {}  # word -> [(chunk_id, count), ...]
    for c in all_chunks:
        cid = c.get("id")
        text = (c.get("text") or "").lower()
        if not cid or not text:
            continue
        words = WORD_RE.findall(text)
        for w, cnt in Counter(w for w in words if w not in STOP).items():
            index.setdefault(w, []).append((cid, cnt))

    print(f"  Unique words: {len(index)}")
    print(f"  Trimming to top {TOP_PER_WORD} chunks per word...")

    trimmed = {}
    for w, pairs in index.items():
        pairs.sort(key=lambda t: -t[1])
        trimmed[w] = [cid for cid, _ in pairs[:TOP_PER_WORD]]

    # Shard by md5(word) % 8 — matches original 05_split_knowledge.py scheme.
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    shards = [{} for _ in range(SHARDS)]
    for word, ids in trimmed.items():
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest()[:8], 16) % SHARDS
        shards[h][word] = ids

    total_kb = 0
    for i, sh in enumerate(shards):
        f = INDEX_DIR / f"shard_{i}.json"
        f.write_text(json.dumps({"keyword_index": sh}, ensure_ascii=False), encoding="utf-8")
        kb = f.stat().st_size / 1024
        total_kb += kb
        flag = "  ⚠️ 25MB+!" if kb > 25 * 1024 else ""
        print(f"  index/shard_{i}.json  ({kb:,.0f} KB, {len(sh):,} words){flag}")

    # Keep meta.json's total_chunks / books list in sync.
    meta_path = KDIR / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["total_chunks"] = len(all_chunks)
        meta["books"] = sorted(book_ids)
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\n  meta.json updated: total_chunks={len(all_chunks)}, books={len(book_ids)}")

    print(f"\n  Done. Index size: {total_kb/1024:,.1f} MB across {SHARDS} shards.")
    print("  Keyword search will now find the updated book content.")
    print("  NOTE: this does NOT touch semantic-search embeddings (vectors.bin) —")
    print("  run scripts/06_regenerate_embeddings.mjs separately for that (local machine only).")


if __name__ == "__main__":
    main()
