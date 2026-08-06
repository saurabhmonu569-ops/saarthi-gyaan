"""
SAARTHI — Kisi bhi PDF ka OCR-namoona test, poora OCR chalane se PEHLE
=====================================================================
KYUN: valmiki_ramayana par humne ghante lagaye, phir pata chala ki scan
padhi hi nahi ja sakti — text nikla "द | चस्ति निधाधत ॥ ३२ जी थी कहने
लगे कि, से शुक्त दन बड़ी कणा धर". 6 volumes par wahi galti = 14 ghante
barbaad. Ye script 20 page dekhkar 10 minute mein bata deti hai.

CHALAO:
    python scripts\\10_probe_pdf.py "E:\\SAURABH PERSONAL\\SARTHI OLD\\BOOKS" --match Mahabharata
    python scripts\\10_probe_pdf.py "<folder>" --match Mahabharata --pages 30

KYA NAAPTA HAI (wahi teen paimane jo audit mein use hue):
    akshar/page   — saaf granth 1,000-2,600 | valmiki (kachra) 381
    tootna        — 1-2 akshar waale shabd ka anupaat
                    saaf 0.20-0.33 | valmiki 0.50 | seema 0.40
    Latin %       — saaf 0.00-0.31%
"""
import argparse
import io
import re
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("❌ PyMuPDF chahiye:  pip install pymupdf")

DEV = re.compile(r"[ऀ-ॿ]")
LAT = re.compile(r"[A-Za-z]")
WORDS = re.compile(r"[ऀ-ॿ]+")

OCR_DPI = 400          # 07_add_books.py ke barabar
OCR_PSM = "3"
OCR_LANG = "hin+san"   # "eng" JAAN-BOOJH KAR nahi — wahi "Gitar" waali galti thi


# Purani font-encoding (Kruti Dev / Chanakya / Shusha) ke sanket. Aise PDF
# mein text-layer TO hoti hai, par usmein Unicode ki jagah glyph-code bhare
# hote hain — nateeja aisa dikhta hai:
#     "पÀचसËतȵततमोऽÉयायः ... पुčǆकɥ उÆपȷǺ"
# Aadhe akshar sahi Devanagari, aadhe Latin-Extended/IPA kachra. Aisi layer
# par bharosa karna sabse kharab hai — wo "text mil gaya" ka dhokha deti hai.
# Ilaaj: page ko IMAGE banakar OCR karo (font sahi RENDER hota hai, bas
# uska encoding galat hai). 07_add_books.py mein yahi `force_ocr` karta hai.
LEGACY_FONT_CHARS = re.compile(r"[ƀ-ɏɐ-ʯÀ-ÿ]")


def looks_legacy_encoded(txt: str) -> bool:
    dev = len(DEV.findall(txt))
    junk = len(LEGACY_FONT_CHARS.findall(txt))
    return dev > 20 and junk > dev * 0.15


def ocr_page(page, force_ocr: bool = False) -> str:
    """Pehle text-layer, na mile to OCR — 07_add_books.py jaisa hi."""
    txt = (page.get_text() or "").strip()
    if len(txt) > 200 and not force_ocr and not looks_legacy_encoded(txt):
        return txt
    pix = page.get_pixmap(dpi=OCR_DPI)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(pix.tobytes("png"))
        tmp = f.name
    try:
        out = subprocess.run(
            ["tesseract", tmp, "stdout", "-l", OCR_LANG, "--psm", OCR_PSM],
            capture_output=True, text=True, encoding="utf-8", timeout=180,
        )
        return (out.stdout or "").strip()
    except Exception as e:
        print(f"      ⚠ OCR fail: {e}")
        return ""
    finally:
        Path(tmp).unlink(missing_ok=True)


def probe(pdf: Path, n_pages: int, force_ocr: bool = False):
    doc = fitz.open(str(pdf))
    total = doc.page_count
    # BEECH ke pages lo — shuru mein cover/index hota hai aur ant mein
    # vigyapan; dono asli content ka sahi namoona nahi dete.
    lo, hi = int(total * 0.25), int(total * 0.75)
    step = max(1, (hi - lo) // max(1, n_pages))
    picks = list(range(lo, hi, step))[:n_pages]

    print(f"\n📖 {pdf.name}")
    print(f"   {total} pages | namoona: {len(picks)} page (beech se)")

    # Pehla page dekhkar bata do ki text-layer bharosemand hai ya nahi —
    # taaki user ko pata chale ki OCR kyun chal raha hai.
    first = (doc[picks[0]].get_text() or "").strip()
    if not force_ocr and looks_legacy_encoded(first):
        print("   ⚠ text-layer purani font-encoding mein hai (Kruti Dev jaisi) — OCR se padh rahe hain")

    texts = []
    for i, p in enumerate(picks, 1):
        texts.append(ocr_page(doc[p], force_ocr))
        print(f"\r   OCR {i}/{len(picks)}…", end="", flush=True)
    doc.close()
    print("\r" + " " * 30 + "\r", end="")

    joined = " ".join(texts)
    if not joined.strip():
        print("   ❌ kuch bhi nahi nikla")
        return None

    per_page = [len(t) for t in texts]
    words = WORDS.findall(joined)
    frag = (sum(1 for w in words if len(w) <= 2) / len(words)) if words else 1.0
    dev, lat = len(DEV.findall(joined)), len(LAT.findall(joined))
    latpct = 100 * lat / max(1, lat + dev)
    cpp = statistics.median(per_page)

    ok = cpp >= 900 and frag <= 0.40 and latpct <= 1.0
    print(f"   akshar/page : {cpp:>8,.0f}   {'✅' if cpp >= 900 else '❌ bahut kam'}")
    print(f"   tootna      : {frag:>8.2f}   {'✅' if frag <= 0.40 else '❌ shabd toot rahe hain'}")
    print(f"   Latin       : {latpct:>7.2f}%   {'✅' if latpct <= 1.0 else '❌ kachra'}")
    print(f"   → {'PASS — poora OCR chalane laayak' if ok else 'FAIL — is scan par mehnat mat lagaiye'}")
    sample = re.sub(r"\s+", " ", joined[:200])
    print(f"   namoona: {sample}…")
    return {"pdf": pdf.name, "pages": total, "cpp": cpp, "frag": frag, "lat": latpct, "ok": ok}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--match", default="", help="filename mein ye shabd ho (case-insensitive)")
    ap.add_argument("--pages", type=int, default=20)
    ap.add_argument("--force-ocr", action="store_true",
                    help="text-layer bilkul mat padho, hamesha OCR karo")
    a = ap.parse_args()

    folder = Path(a.folder)
    if not folder.exists():
        sys.exit(f"❌ folder nahi mila: {folder}")

    pdfs = sorted(p for p in folder.rglob("*.pdf")
                  if a.match.lower() in p.name.lower())
    if not pdfs:
        sys.exit(f"❌ '{a.match}' se milti koi PDF nahi mili {folder} mein")

    print("=" * 62)
    print(f"  PDF namoona-test — {len(pdfs)} file, {a.pages} page prati file")
    print("=" * 62)

    rows = [r for p in pdfs if (r := probe(p, a.pages, a.force_ocr))]

    print("\n" + "=" * 62)
    print(f"  {'file':38}{'ak/pg':>8}{'tootna':>8}  natija")
    print("-" * 62)
    for r in rows:
        print(f"  {r['pdf'][:36]:38}{r['cpp']:>8,.0f}{r['frag']:>8.2f}  {'✅ PASS' if r['ok'] else '❌ FAIL'}")
    good = [r for r in rows if r["ok"]]
    print("-" * 62)
    print(f"  {len(good)}/{len(rows)} file poore OCR ke laayak"
          f"  ({sum(r['pages'] for r in good):,} pages)")
    if good:
        # Yoga Vasishtha: 2,606 page = 205 min → ~4.7 sec/page
        mins = sum(r["pages"] for r in good) * 4.7 / 60
        print(f"  anumaanit OCR samay: {mins / 60:.1f} ghante")


if __name__ == "__main__":
    main()
