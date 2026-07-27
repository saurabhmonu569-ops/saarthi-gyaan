#!/usr/bin/env python3
"""
SAARTHI — OCR Pipeline V2 (quality upgrade)
============================================

KYA BADLA V1 SE (root cause of garbage text):
  1. `-l hin+eng` → `-l hin+san` : V1 mein English model Devanagari glyphs
     ko zabardasti Latin mein padhta tha — isi se "rrr moe erg", "ageiar",
     "Mgt Fd ANAT" jaisa kachra aata tha. Ab sirf Devanagari models.
  2. Image preprocessing (OpenCV): denoise + adaptive threshold + deskew —
     purani scan ki dhundli pages pe accuracy 15-30% tak badhti hai.
  3. 400 DPI render (V1: 300) — chhote akshar (footnotes, sandhi marks) saaf.
  4. Word-level confidence filter: <40% confidence wale words drop.
  5. Post-clean: wahi junk-token filter jo app mein hai, source pe hi laga.

REQUIREMENTS (ek baar):
  pip install pymupdf opencv-python numpy --break-system-packages
  # Tesseract language data (Windows: UB-Mannheim installer se, ya):
  #   hin.traineddata + san.traineddata ko tessdata folder mein daalein
  #   https://github.com/tesseract-ocr/tessdata_best  (best quality)

USAGE:
  python 01b_ocr_v2_upgrade.py --pdf-dir "E:/SAARTHI JULY/pdfs" --test
      → har book ke sirf 3 pages, quality jaanchne ke liye (5-10 min)
  python 01b_ocr_v2_upgrade.py --pdf-dir "E:/SAARTHI JULY/pdfs"
      → poora corpus (raat bhar chalega — ~6300 pages)

  Phir hamesha ki tarah: python 02_chunk.py  →  knowledge.json update.

OUTPUT: wahi format jo 02_chunk.py expect karta hai
        (data/raw/{book_id}/page_NNNN.json) — V1 output ko overwrite karta hai.
"""

import argparse, json, re, subprocess, sys, tempfile, time
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF missing:  pip install pymupdf --break-system-packages")

try:
    import cv2
    import numpy as np
    HAS_CV = True
except ImportError:
    HAS_CV = False
    print("⚠️  OpenCV nahi mila — preprocessing skip hogi (quality thodi kam).")
    print("    Behtar results ke liye: pip install opencv-python numpy --break-system-packages\n")

# ── FINAL BOOK REGISTRY — "FULL BOOK" files (July 2026) ─────────────────────
def _bk(book_id, title, short, tradition, pdf, language="hi"):
    return {"book_id": book_id, "title": title, "short": short,
            "tradition": tradition, "language": language, "script": "devanagari",
            "source_pdf": pdf, "method": "ocr", "skip_pages": []}

BOOKS = [
    _bk("bhagavad_gita_shankar", "Shrimad Bhagavad Gita", "Bhagavad Gita", "gita",   "BHAGVAT GEETA FULL BOOK.pdf"),
    _bk("valmiki_ramayana",      "Valmiki Ramayana",      "Ramayana",      "ramayana","RAMAYAN FULL BOOK.pdf"),
    _bk("rigveda_1",             "Rigveda",               "Rigveda",       "veda",   "RIGVED FULL BOOK.pdf",  "sa+hi"),
    _bk("samaveda",              "Samaveda",              "Samaveda",      "veda",   "SAMVED FULL BOOK.pdf",  "sa+hi"),
    _bk("yajurveda",             "Yajurveda",             "Yajurveda",     "veda",   "YAJURVED FULL BOOK.pdf","sa+hi"),
    _bk("atharvaveda_1",         "Atharvaveda",           "Atharvaveda",   "veda",   "ATHARVED FULL BOOK.pdf","sa+hi"),
    _bk("shiva_purana_1",        "Shiva Purana Khand 1",  "Shiv Puran 1",  "purana", "SHIV PURAN KHAND 1 FULL BOOK.pdf"),
    _bk("shiva_purana_2",        "Shiva Purana Khand 2",  "Shiv Puran 2",  "purana", "SHIV PURAN KHAND 2 FULL BOOK.pdf"),
    _bk("garuda_purana_1",       "Garuda Purana",         "Garud Puran",   "purana", "GARUD PURAN FULL BOOK.pdf"),
    _bk("vishnu_purana_1",       "Vishnu Purana",         "Vishnu Puran",  "purana", "VISHNU PURAN FULL BOOK.pdf"),
    _bk("narasimha_purana",      "Narasimha Purana",      "Narsimha Puran","purana", "NARSHIM PURAN FULL BOOK.pdf"),
    _bk("bhavishya_purana",      "Bhavishya Purana",      "Bhavishya Puran","purana","BHAVISHY PURAN FULL BOOK.pdf"),
    _bk("agni_purana",           "Agni Purana",           "Agni Puran",    "purana", "AGNI PURAN FULL BOOK.pdf"),
]

DPI = 400
DEVA = re.compile(r"[\u0900-\u097F]")


# ── Image preprocessing ───────────────────────────────────────────────────────

def preprocess(png_bytes: bytes) -> bytes:
    """Denoise → adaptive threshold → deskew. Returns PNG bytes."""
    if not HAS_CV:
        return png_bytes
    img = cv2.imdecode(np.frombuffer(png_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return png_bytes

    # 1. Fast denoise (medianBlur — 20-30x faster than NlMeans, similar quality)
    img = cv2.medianBlur(img, 3)

    # 2. Adaptive threshold — handles uneven lighting/yellowed paper
    img = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY, 31, 15)

    # 3. Deskew (tilted scans confuse Tesseract badly)
    coords = np.column_stack(np.where(img < 128))
    if len(coords) > 500:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = 90 + angle
        if 0.3 < abs(angle) < 10:          # only correct plausible tilts
            h, w = img.shape
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC,
                                 borderMode=cv2.BORDER_CONSTANT, borderValue=255)

    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes() if ok else png_bytes


# ── OCR with word-level confidence filtering ─────────────────────────────────

def ocr_page(png_bytes: bytes, lang: str) -> tuple[str, float]:
    """Run tesseract TSV mode; drop words with confidence < 40."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(png_bytes)
        tmp = f.name
    try:
        try:
            r = subprocess.run(
                ["tesseract", tmp, "stdout", "-l", lang,
                 "--psm", "6", "--oem", "1", "tsv"],
                capture_output=True, text=True, encoding="utf-8", timeout=180)
        except subprocess.TimeoutExpired:
            # One stubborn page must never kill an hours-long run —
            # log it, save it empty, move on.
            print("      ⚠️ page timeout (180s) — skip karke aage badh rahe")
            return "", 0.0
        except Exception as e:
            print(f"      ⚠️ page OCR fail ({type(e).__name__}) — skip")
            return "", 0.0
        lines_out, confs = [], []
        cur_line_key, cur_words = None, []
        for row in r.stdout.splitlines()[1:]:
            c = row.split("\t")
            if len(c) < 12:
                continue
            key = (c[2], c[3], c[4])            # block, par, line
            word, conf = c[11], float(c[10]) if c[10] not in ("", "-1") else -1
            if key != cur_line_key:
                if cur_words:
                    lines_out.append(" ".join(cur_words))
                cur_line_key, cur_words = key, []
            if word.strip() and conf >= 40:      # confidence gate
                cur_words.append(word)
                confs.append(conf)
        if cur_words:
            lines_out.append(" ".join(cur_words))
        avg = (sum(confs) / len(confs) / 100.0) if confs else 0.0
        return "\n".join(lines_out), round(avg, 3)
    finally:
        Path(tmp).unlink(missing_ok=True)


# ── Post-clean (same junk heuristics as the app, applied at the SOURCE) ─────

def _junk_latin(tok: str) -> bool:
    t = re.sub(r"[.,!?;:'\"()\[\]\-–—|]", "", tok)
    if not t or not re.search(r"[a-zA-Z]", t):
        return False
    if re.search(r"(.)\1\1\1", t):
        return True
    if len(t) >= 2 and not re.search(r"[aeiouAEIOU]", t):
        return True
    return len(t) > 16


def clean_text(raw: str) -> str:
    out = []
    for line in raw.split("\n"):
        s = line.strip()
        if not s:
            out.append("")
            continue
        toks = s.split()
        if DEVA.search(s):
            # Devanagari line: any Latin token is OCR noise
            toks = [t for t in toks
                    if (DEVA.search(t) and not re.search(r"[a-zA-Z]", t))
                    or re.fullmatch(r"[\d।॥()\[\]{}\-–—.,;:!?'\"]+", t)]
            deva_toks = [re.sub(r"[^\u0900-\u097F]", "", t) for t in toks if DEVA.search(t)]
            if len(deva_toks) >= 3:
                tiny = sum(1 for t in deva_toks if len(t) <= 2)
                if not any(len(t) >= 4 for t in deva_toks) and tiny / len(deva_toks) > 0.6:
                    continue                       # single-akshara shrapnel line
        else:
            toks = [t for t in toks if not _junk_latin(t)]
        if toks:
            out.append(" ".join(toks))
    txt = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", txt).strip()


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir", required=True, help="Folder containing the 18 source PDFs")
    ap.add_argument("--out-dir", default=str(Path(__file__).parent.parent / "data" / "raw"))
    ap.add_argument("--books", nargs="*", help="Only these book_ids")
    ap.add_argument("--test", action="store_true", help="3 pages per book (quality check)")
    args = ap.parse_args()

    pdf_dir, out_root = Path(args.pdf_dir), Path(args.out_dir)
    todo = [b for b in BOOKS if not args.books or b["book_id"] in args.books]
    summaries = []

    # Fuzzy filename resolver — real folders have spaces vs underscores,
    # extra words ("VISHNU PURAN 1.pdf" vs "VISHNU_1.pdf"), case differences.
    all_pdfs = sorted({f.name.lower(): f for f in pdf_dir.glob("*.[pP][dD][fF]")}.values())

    def _norm(name):
        return re.sub(r"[^a-z0-9]", "", name.lower().replace(".pdf", ""))

    def _tokens(name):
        return set(re.split(r"[^a-z0-9]+", name.lower().replace(".pdf", ""))) - {""}

    def resolve_pdf(expected):
        exact = pdf_dir / expected
        if exact.exists():
            return exact
        en, et = _norm(expected), _tokens(expected)
        # normalized-equal (space vs underscore, case)
        eq = [f for f in all_pdfs if _norm(f.name) == en]
        if len(eq) == 1:
            return eq[0]
        # expected tokens subset of actual tokens (VISHNU_1 ⊆ VISHNU PURAN 1)
        sub = [f for f in all_pdfs if et and et <= _tokens(f.name)]
        if len(sub) == 1:
            return sub[0]
        return None

    for b in todo:
        src = resolve_pdf(b["source_pdf"])
        if src is None:
            print(f"⏭️  {b['book_id']}: {b['source_pdf']} nahi mila — skip")
            continue
        if src.name != b["source_pdf"]:
            print(f"🔗 {b['book_id']}: '{src.name}' se match hua")

        # V2 language fix: Devanagari books get hin+san, never eng
        lang = "hin+san" if b.get("script") == "devanagari" else b.get("ocr_lang", "hin")

        out_dir = out_root / b["book_id"]
        out_dir.mkdir(parents=True, exist_ok=True)
        doc = fitz.open(src)
        skip = set(b.get("skip_pages", []))
        pages = [i for i in range(len(doc)) if i not in skip]
        if args.test:
            pages = pages[:3]

        print(f"\n📖 {b['title']}  ({len(pages)} pages, lang={lang})")
        t0 = time.time()
        book_chars = 0
        for n, pg in enumerate(pages, 1):
            mat = fitz.Matrix(DPI / 72, DPI / 72)
            pix = doc[pg].get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
            png = preprocess(pix.tobytes("png"))
            text, conf = ocr_page(png, lang)
            text = clean_text(text)
            book_chars += len(text)
            (out_dir / f"page_{pg:04d}.json").write_text(json.dumps({
                "book_id": b["book_id"], "page": pg, "text": text,
                "confidence": conf, "ocr_lang": lang, "pipeline": "v2",
            }, ensure_ascii=False), encoding="utf-8")
            if n % 25 == 0 or n == len(pages):
                rate = n / max(time.time() - t0, 1)
                eta = (len(pages) - n) / max(rate, 0.01) / 60
                print(f"   {n}/{len(pages)}  conf={conf:.2f}  ETA {eta:.0f} min")
        doc.close()
        summaries.append({**{k: b[k] for k in
            ("book_id","title","short","tradition","language","script","source_pdf","method")},
            "pages_extracted": len(pages), "total_chars": book_chars, "pipeline": "v2"})

    # Manifest for 02_chunk.py — MERGED with previous runs, so books done
    # yesterday stay listed when today's run writes the file again.
    out_root.mkdir(parents=True, exist_ok=True)
    mpath = out_root / "extraction_manifest.json"
    existing = {}
    if mpath.exists():
        try:
            for eb in json.loads(mpath.read_text(encoding="utf-8")).get("books", []):
                existing[eb.get("book_id")] = eb
        except Exception:
            pass
    for sb in summaries:
        existing[sb["book_id"]] = sb
    mpath.write_text(json.dumps(
        {"stage": "01b_ocr_v2", "books": list(existing.values())},
        ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n📄 Manifest → {out_root / 'extraction_manifest.json'}")

    print("\n✅ OCR V2 complete. Ab chalayen:  python 02_chunk.py")
    print("   (yeh naya knowledge.json banayega — public/knowledge/ mein copy karein)")


if __name__ == "__main__":
    main()
