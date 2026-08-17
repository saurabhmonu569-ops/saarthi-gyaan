#!/usr/bin/env python3
r"""
SAARTHI — PDF Compressor (badi scan-PDFs ko host-layak banao)
==============================================================
682MB jaisi scan-PDF ko ~40-70MB bana deta hai — har page ko 110 DPI
JPEG mein dobara bana kar (padhne ki quality lagbhag wahi rehti hai,
purani 13 hosted books isi level par hain).

USAGE:
  python scripts\08_compress_pdf.py "SOURCE.pdf" "data\books-pdf\book_id.pdf"

  Quality/size badalna ho:
  python scripts\08_compress_pdf.py "SOURCE.pdf" "OUT.pdf" --dpi 100 --quality 55
"""

import argparse, sys
from pathlib import Path

try:
    import fitz
except ImportError:
    raise SystemExit("PyMuPDF nahi hai:  pip install pymupdf")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--dpi", type=int, default=110)
    ap.add_argument("--quality", type=int, default=60)
    args = ap.parse_args()

    src = Path(args.src); dst = Path(args.dst)
    if not src.exists():
        raise SystemExit(f"Source nahi mili: {src}")
    dst.parent.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(src))
    out = fitz.open()
    n   = len(doc)
    print(f"  {src.name}: {n} pages, {src.stat().st_size/1048576:.0f} MB → compress ho raha ({args.dpi} dpi, q{args.quality})")

    mat = fitz.Matrix(args.dpi / 72, args.dpi / 72)
    for i in range(n):
        page = doc[i]
        pix  = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img  = pix.tobytes("jpeg", jpg_quality=args.quality)
        rect = page.rect
        newp = out.new_page(width=rect.width, height=rect.height)
        newp.insert_image(rect, stream=img)
        if (i + 1) % 50 == 0:
            print(f"    ...{i+1}/{n}", flush=True)

    out.save(str(dst), deflate=True, garbage=3)
    out.close(); doc.close()
    print(f"  ✅ {dst}  ({dst.stat().st_size/1048576:.0f} MB)")


if __name__ == "__main__":
    main()
