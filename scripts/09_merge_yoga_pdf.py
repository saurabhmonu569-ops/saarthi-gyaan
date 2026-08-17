"""
SAARTHI — Yoga Vasishtha ke 4 bhaag jodkar ek PDF banata hai.

Kyun alag script: PowerShell mein `python -c "..."` ke andar Windows paths
(backslash + space) quote karna bharosemand nahi hai — pichhli baar wahi
fail hua tha. Yahan path ek jagah likha hai, badal lena aasan hai.

Chalane ka tareeka (repo root se):
    python scripts\\09_merge_yoga_pdf.py

Compression ka istemal JAAN-BOOJH KAR nahi kiya gaya: chaaron bhaag milakar
sirf ~7.6 MB hain. `08_compress_pdf.py` 110 DPI par dobara render karta hai,
jo itni chhoti file par jagah bachata nahi — sirf Devanagari maatraayein
dhundhli kar deta hai. Read section ko saaf scan chahiye.
"""
import sys
from pathlib import Path

import fitz  # PyMuPDF

SRC_DIR = Path(r"E:\SAURABH PERSONAL\SARTHI OLD\BOOKS")
PARTS = [
    "yog_va_part 1.pdf",
    "yog part 2.pdf",
    "yog part 3.pdf",
    "yog part 4.pdf",
]
OUT = Path("data/books-pdf/yoga_vasishtha.pdf")


def main() -> int:
    missing = [p for p in PARTS if not (SRC_DIR / p).exists()]
    if missing:
        print(f"❌ ye bhaag nahi mile {SRC_DIR} mein:")
        for m in missing:
            print("   ", m)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out = fitz.open()
    for name in PARTS:
        with fitz.open(str(SRC_DIR / name)) as d:
            print(f"  + {name}  ({d.page_count} pages)")
            out.insert_pdf(d)

    # garbage=4 duplicate objects hataata hai, deflate=True streams dabaata
    # hai — dono lossless hain, ek bhi pixel nahi badalta.
    out.save(str(OUT), garbage=4, deflate=True)
    pages = out.page_count
    out.close()

    mb = OUT.stat().st_size / 1048576
    print(f"\n✅ {OUT}  —  {pages} pages, {mb:.1f} MB")
    # 07_add_books.py ne isi merge se 2,608 pages padhe the; mel na khaaye
    # to koi bhaag badal gaya hai aur Read section OCR se alag hoga.
    if pages != 2608:
        print(f"⚠️  OCR ne 2,608 pages padhe the, yahan {pages} hain — jaanch lijiye")
    return 0


if __name__ == "__main__":
    sys.exit(main())
