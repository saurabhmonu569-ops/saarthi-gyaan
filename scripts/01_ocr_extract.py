#!/usr/bin/env python3
"""
SAARTHI v2 — Knowledge Engine
Script 01: OCR + Text Extraction Pipeline

Run once, offline, before deploying the app.
Reads all 18 Sacred PDFs, extracts text via Tesseract OCR (scanned)
or direct PyMuPDF extraction (text layer), cleans and normalises,
and writes per-page JSON with full provenance metadata.

Output: /home/claude/saarthi-engine/data/raw/{book_id}/page_{NNNN}.json
Usage:
  python3 01_ocr_extract.py                          # all books
  python3 01_ocr_extract.py --books bhagavad_gita_shankar ramayana
  python3 01_ocr_extract.py --max-pages 10           # test mode
"""

import fitz          # PyMuPDF
import json, os, re, subprocess, tempfile, time, unicodedata
from pathlib import Path

# ─── BOOK REGISTRY ────────────────────────────────────────────────────────────
BOOKS = [
    {"book_id":"bhagavad_gita_shankar","title":"Shrimad Bhagavad Gita (Shankar Bhashya)",
     "short":"Bhagavad Gita","tradition":"gita","language":"hi","script":"devanagari",
     "source_pdf":"BHAGVAT_GEETA.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"bhagavad_gita_smbg1","title":"Srimad Bhagavad Gita Part 1",
     "short":"Bhagavad Gita P1","tradition":"gita","language":"hi","script":"devanagari",
     "source_pdf":"SMBG_1.pdf","method":"ocr","ocr_lang":"hin+eng","skip_pages":[0,1]},
    {"book_id":"bhagavad_gita_smbg2","title":"Srimad Bhagavad Gita Part 2",
     "short":"Bhagavad Gita P2","tradition":"gita","language":"hi","script":"devanagari",
     "source_pdf":"SMBG_2.pdf","method":"ocr","ocr_lang":"hin+eng","skip_pages":[0,1]},
    {"book_id":"valmiki_ramayana","title":"Valmiki Ramayana",
     "short":"Ramayana","tradition":"ramayana","language":"hi","script":"devanagari",
     "source_pdf":"RAMAYAN.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,8))},
    {"book_id":"rigveda_1","title":"Rigveda Part 1","short":"Rigveda 1",
     "tradition":"veda","language":"sa+hi","script":"devanagari",
     "source_pdf":"RIGVED_1.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,5))},
    {"book_id":"rigveda_2","title":"Rigveda Part 2","short":"Rigveda 2",
     "tradition":"veda","language":"sa+hi","script":"devanagari",
     "source_pdf":"RIGVED_2.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,5))},
    {"book_id":"samaveda","title":"Samaveda","short":"Samaveda",
     "tradition":"veda","language":"sa+hi","script":"devanagari",
     "source_pdf":"SAMVED_2.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"yajurveda","title":"Yajurveda","short":"Yajurveda",
     "tradition":"veda","language":"sa+hi","script":"devanagari",
     "source_pdf":"YAJURVED_3.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"atharvaveda_1","title":"Atharvaveda Part 1","short":"Atharvaveda",
     "tradition":"veda","language":"sa+hi","script":"devanagari",
     "source_pdf":"ARTHVED_1.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"shiva_purana_1","title":"Shiva Purana Part 1","short":"Shiva Purana 1",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"SHIV_1.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"shiva_purana_2","title":"Shiva Purana Part 2","short":"Shiva Purana 2",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"SHIV_2.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"garuda_purana_1","title":"Garuda Purana Part 1","short":"Garuda Purana 1",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"GARUD_PURAN_1.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"garuda_purana_2","title":"Garuda Purana Part 2","short":"Garuda Purana 2",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"GARUD_PURAN_2.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"vishnu_purana_1","title":"Vishnu Purana Part 1","short":"Vishnu Purana 1",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"VISHNU_1.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"vishnu_purana_2","title":"Vishnu Purana Part 2","short":"Vishnu Purana 2",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"VISHNU_2.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"narasimha_purana","title":"Narasimha Purana","short":"Narasimha Purana",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"NARSHIM_PURAN.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"bhavishya_purana","title":"Bhavishya Purana","short":"Bhavishya Purana",
     "tradition":"purana","language":"hi","script":"devanagari",
     "source_pdf":"BHAVISHY_PURAN.pdf","method":"ocr","ocr_lang":"hin+eng",
     "skip_pages":list(range(0,4))},
    {"book_id":"guru_granth_sahib","title":"Guru Granth Sahib (Hindi)","short":"Guru Granth Sahib",
     "tradition":"sikhism","language":"hi+pa","script":"devanagari",
     "source_pdf":"Adi_Sri_Guru_Granth_Sahib_Ji_Hindi_1_compressed.pdf",
     "method":"text","skip_pages":list(range(0,3))},
]

PDF_DIR    = Path("/mnt/user-data/uploads")
OUTPUT_DIR = Path("/home/claude/saarthi-engine/data/raw")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def devanagari_ratio(text):
    if not text: return 0.0
    deva = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    return deva / len(text)

def confidence_score(text, lang):
    if not text or len(text.strip()) < 20: return 0.0
    words = len(text.split())
    if words < 3: return 0.1
    deva  = devanagari_ratio(text)
    noise = len(re.findall(r'(.)\1{4,}', text)) / max(1, words)
    base  = min(1.0, deva * 2.5) if ("hi" in lang or "sa" in lang) else 0.8
    return round(max(0.0, base - noise * 0.3), 3)

def is_duplicate(a, b, threshold=0.85):
    def tg(t):
        w = t.split()
        return set(zip(w, w[1:], w[2:])) if len(w) >= 3 else set()
    ta, tb = tg(a), tg(b)
    if not ta or not tb: return False
    return len(ta & tb) / max(1, len(ta | tb)) > threshold

def clean_text(raw):
    if not raw: return ""
    t = unicodedata.normalize("NFC", raw)
    t = "".join(c for c in t if unicodedata.category(c) not in ("Cc","Cs","Co") or c=='\n')
    fixes = [(r'[|]{2,}','।'),(r'\s*।\s*।\s*',' ।। '),(r'([०-९])\s+([०-९])',r'\1\2')]
    for p,r in fixes: t = re.sub(p,r,t)
    lines = []
    for line in t.split('\n'):
        s = line.strip()
        if re.fullmatch(r'[\d\s\[\]\(\)\-–—।॥]+', s) and len(s)<12: continue
        if (len(s)<100 and not any('\u0900'<=c<='\u097F' for c in s)
                and any(w in s.lower() for w in ['library','elibrary','gmail','.com','www.'])):
            continue
        lines.append(line)
    return re.sub(r'\n{3,}','\n\n','\n'.join(lines)).strip()

def ocr_page(doc, pg_no, lang="hin+eng"):
    mat = fitz.Matrix(300/72, 300/72)
    pix = doc[pg_no].get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tf.write(pix.tobytes("png")); tmp = tf.name
    try:
        r = subprocess.run(["tesseract", tmp, "stdout", "-l", lang,
                            "--psm","6","--oem","1"],
                           capture_output=True, text=True, timeout=120)
        return r.stdout
    except: return ""
    finally: os.unlink(tmp)

def extract_book(book, max_pages=None):
    book_id  = book["book_id"]
    pdf_path = PDF_DIR / book["source_pdf"]
    book_out = OUTPUT_DIR / book_id
    book_out.mkdir(parents=True, exist_ok=True)

    print(f"\n  [{book_id}] {book['title']}")
    if not pdf_path.exists():
        print(f"    ERROR: PDF not found")
        return {"book_id":book_id,"status":"missing_pdf","pages_extracted":0}

    doc       = fitz.open(str(pdf_path))
    n_pages   = len(doc)
    skip      = set(book.get("skip_pages",[]))
    limit     = min(n_pages, max_pages) if max_pages else n_pages
    lang      = book.get("ocr_lang","hin+eng")
    method    = book["method"]
    exp_lang  = book["language"]

    written=0; failed=0; skipped=0; total_chars=0; total_conf=0.0; prev=""

    for pg in range(limit):
        if pg in skip: skipped+=1; continue
        raw  = ocr_page(doc, pg, lang) if method=="ocr" else doc[pg].get_text("text")
        text = clean_text(raw)
        conf = confidence_score(text, exp_lang)
        dup  = is_duplicate(prev, text) if prev and text else False
        if   len(text.strip()) < 30:    st="blank"; failed+=1
        elif conf < 0.15:               st="low_conf"; failed+=1
        elif dup:                        st="duplicate"; skipped+=1
        else:                            st="ok"; written+=1; prev=text
        if st=="ok": total_chars+=len(text); total_conf+=conf

        page_data = {
            "meta": {"book_id":book_id,"book_title":book["title"],
                      "tradition":book["tradition"],"source_pdf":book["source_pdf"],
                      "source_page":pg,"page_display":pg+1,
                      "language":book["language"],"script":book["script"]},
            "qa":  {"method":method,"ocr_lang":lang if method=="ocr" else "n/a",
                    "status":st,"confidence":conf,"is_duplicate":dup,
                    "char_count":len(text),"word_count":len(text.split()),
                    "devanagari_pct":round(devanagari_ratio(text)*100,1)},
            "text": text,
        }
        (book_out / f"page_{pg:04d}.json").write_text(
            json.dumps(page_data, ensure_ascii=False, indent=2))

        if pg % 20 == 0 or pg == limit-1:
            ac = total_conf/max(1,written)
            print(f"    pg {pg+1:>4}/{limit}  ok={written} fail={failed} dup={skipped} conf={ac:.2f}")

    doc.close()
    avg = total_conf/max(1,written)
    s = {"book_id":book_id,"title":book["title"],"tradition":book["tradition"],
         "source_pdf":book["source_pdf"],"total_pdf_pages":n_pages,
         "pages_extracted":written,"pages_skipped":skipped,"pages_failed":failed,
         "total_chars":total_chars,"avg_confidence":round(avg,3),"status":"complete"}
    print(f"    DONE: extracted={written} failed={failed} chars={total_chars:,} conf={avg:.2f}")
    return s

def main(book_ids=None, max_pages=None):
    books = [b for b in BOOKS if not book_ids or b["book_id"] in book_ids]
    print(f"\n{'='*60}")
    print(f"  SAARTHI v2 — OCR Extraction Pipeline")
    print(f"  Books: {len(books)}  MaxPages: {max_pages or 'all'}")
    print(f"{'='*60}")
    t0 = time.time(); summaries = []
    for book in books:
        summaries.append(extract_book(book, max_pages))
    manifest = {"stage":"01_ocr_extract","books":summaries,
                "elapsed":round(time.time()-t0,1)}
    mp = OUTPUT_DIR / "extraction_manifest.json"
    mp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"\n  Manifest → {mp}")
    total_pg = sum(s.get("pages_extracted",0) for s in summaries)
    total_ch = sum(s.get("total_chars",0) for s in summaries)
    print(f"  Total pages extracted : {total_pg:,}")
    print(f"  Total chars           : {total_ch:,}")
    return manifest

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--books", nargs="*")
    p.add_argument("--max-pages", type=int)
    a = p.parse_args()
    main(book_ids=a.books, max_pages=a.max_pages)
