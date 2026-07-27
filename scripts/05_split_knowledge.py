#!/usr/bin/env python3
"""
SAARTHI — Knowledge Splitter (LIVE deploy ke liye)
===================================================
Problem: knowledge.json (52MB) + search_manifest.json (40MB) —
  - Cloudflare Pages jaise hosts 25MB+ ki file lete hi nahi
  - Mobile par ek hi bada download atak jaata hai
  - JSON.parse ek saath 52MB par UI freeze karta hai

Hal:
  public/knowledge/books/<book_id>.json   (13 files, ~2-6MB each)
  public/knowledge/index/shard_0..7.json  (8 shards, ~5MB each)
  public/knowledge/meta.json              (chhota — sabki suchi)

App ka engine.js naya format pehle try karta hai, na mile toh purana
knowledge.json (dev mode) — dono chalte hain.

USAGE:
  python scripts\05_split_knowledge.py

Iske baad (optional, live bundle chhota karne ke liye):
  purane knowledge.json + search_manifest.json ko public/knowledge se
  hata sakte ho — par LOCAL DEV ke liye rakhe rehne mein koi harj nahi.
"""

import json, hashlib
from pathlib import Path

ROOT   = Path(__file__).resolve().parent.parent
KDIR   = ROOT / "public" / "knowledge"
BOOKS  = KDIR / "books"
INDEX  = KDIR / "index"
SHARDS = 8

def main():
    print("=" * 60)
    print("  SAARTHI — Knowledge Splitter (live-ready files)")
    print("=" * 60)

    kp = KDIR / "knowledge.json"
    sp = KDIR / "search_manifest.json"
    if not kp.exists() or not sp.exists():
        raise SystemExit("knowledge.json ya search_manifest.json nahi mila — pehle 02+03 chalao")

    print("  knowledge.json load ho raha (52MB, thoda sabr)...")
    know = json.loads(kp.read_text(encoding="utf-8"))
    print("  search_manifest.json load ho raha (40MB)...")
    sm = json.loads(sp.read_text(encoding="utf-8"))
    ki = sm.get("keyword_index", {})

    BOOKS.mkdir(parents=True, exist_ok=True)
    INDEX.mkdir(parents=True, exist_ok=True)

    # ── 1. Chunks ko book ke hisaab se baanto ────────────────────────────
    by_book = {}
    for c in know["chunks"]:
        # "embedding": null har chunk mein pada tha — dead weight, hatao
        c.pop("embedding", None)
        by_book.setdefault(c["book"], []).append(c)

    book_ids = sorted(by_book.keys())
    total_kb = 0
    for bid in book_ids:
        f = BOOKS / f"{bid}.json"
        f.write_text(json.dumps({"book": bid, "chunks": by_book[bid]},
                                ensure_ascii=False), encoding="utf-8")
        kb = f.stat().st_size / 1024
        total_kb += kb
        flag = "  ⚠️ 25MB+!" if kb > 25 * 1024 else ""
        print(f"  books/{bid}.json  ({kb:,.0f} KB){flag}")

    # ── 2. Keyword index ko 8 shards mein baanto (word-hash se) ─────────
    shards = [{} for _ in range(SHARDS)]
    for word, ids in ki.items():
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest()[:8], 16) % SHARDS
        shards[h][word] = ids
    for i, sh in enumerate(shards):
        f = INDEX / f"shard_{i}.json"
        f.write_text(json.dumps({"keyword_index": sh}, ensure_ascii=False),
                     encoding="utf-8")
        kb = f.stat().st_size / 1024
        total_kb += kb
        flag = "  ⚠️ 25MB+!" if kb > 25 * 1024 else ""
        print(f"  index/shard_{i}.json  ({kb:,.0f} KB, {len(sh):,} words){flag}")

    # ── 3. meta.json — chhota nirdeshak ──────────────────────────────────
    meta = {
        "version":      know.get("version"),
        "schema":       know.get("schema"),
        "embed_model":  know.get("embed_model"),
        "embed_dim":    know.get("embed_dim"),
        "total_chunks": know.get("total_chunks"),
        "books":        book_ids,
        "index_shards": SHARDS,
        "format":       "split-v1",
    }
    (KDIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1),
                                    encoding="utf-8")
    print(f"  meta.json  ({(KDIR/'meta.json').stat().st_size} bytes)")

    print(f"\n  ✅ Total split size: {total_kb/1024:,.1f} MB "
          f"({len(book_ids)} books + {SHARDS} index shards + meta)")
    print("  Ab app pehle naya split format uthayegi (parallel, tez).")
    print("  Deploy par Vercel/Netlify inhe gzip karke ~4-5x chhota bhejenge.")

if __name__ == "__main__":
    main()
