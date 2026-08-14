#!/usr/bin/env python3
r"""
SAARTHI — 11 Nayi Books Jodo (13 → 24 granth)
==============================================
Yeh script nayi PDFs ko wahi data/raw/<book_id>/page_NNNN.json format mein
nikaalti hai jo purani 13 books ka hai — aur extraction_manifest.json mein
unki entry jodti hai, taaki aage ka poora pipeline (02 → 03 → 05 → 04 → 06)
bina kisi badlav ke chal jaye.

SAMAJHDARI:
  - Pehle PDF ki TEXT LAYER try hoti hai (turant, 100% sahi)
  - Text na mile toh TESSERACT OCR (agar installed hai) — 300dpi, hin+eng
  - Resumable: bane hue pages skip hote hain, beech mein rok kar dobara chalao
  - Purana meta-bug yahan nahi hai — page numbers pehle din se sahi

USAGE:
  python scripts\07_add_books.py --pdf-dir "E:\\SAURABH PERSONAL\\SARTHI OLD\\BOOKS\\11 BOOK"
  python scripts\07_add_books.py --pdf-dir "..." --max-pages 10        # test
  python scripts\07_add_books.py --pdf-dir "..." --books kathopanishad chanakya_neeti

Iske baad (order mein):
  python scripts\02_chunk.py
  python scripts\03_embed_build.py --skip-embeddings
  Copy-Item data\knowledge\*.json public\knowledge\ -Force
  python scripts\05_split_knowledge.py
  python scripts\04_amrit_generate.py          (nayi books ke amrit-paath)
  python scripts\06_amrit_audio.py             (unke MP3)
  npm run build  →  Netlify Deploys drop
"""

import argparse, json, os, re, shutil, subprocess, tempfile, time, unicodedata
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    raise SystemExit("PyMuPDF nahi hai. Chalao:  pip install pymupdf")

ROOT     = Path(__file__).resolve().parent.parent
RAW_DIR  = ROOT / "data" / "raw"
MANIFEST = RAW_DIR / "extraction_manifest.json"

# ─── 11 NAYI BOOKS KA REGISTRY ────────────────────────────────────────────────
NEW_BOOKS = [
    {"book_id":"ishadi_upanishad",   "source_pdf":"ESHADI UPNISHAD FULL BOOK.pdf",   "title":"Ishadi Upanishad",        "short":"Ishadi Upanishad","tradition":"upanishad","language":"sa+hi"},
    {"book_id":"kathopanishad",      "source_pdf":"KATHO UPNISHAD FULL BOOK.pdf",    "title":"Kathopanishad",           "short":"Kathopanishad",  "tradition":"upanishad","language":"sa+hi"},
    {"book_id":"guru_granth_sahib",  "source_pdf":"GURU GRANTH SAHAB FULL BOOK.pdf", "title":"Guru Granth Sahib (Hindi)","short":"Guru Granth Sahib","tradition":"sikhism","language":"hi+pa"},
    {"book_id":"chanakya_neeti",     "source_pdf":"CHANAKYA NEETI FULL BOOK.pdf",    "title":"Chanakya Neeti",          "short":"Chanakya Neeti", "tradition":"niti",     "language":"hi", "force_ocr":True},  # text-layer Kruti-Dev kachra hai
    # ⚠️ force_ocr 2026-08-14 ko LAGAYA GAYA — bilkul Chanakya Neeti jaisa mamla,
    # par 15 din tak pakda nahi gaya. Is PDF me text-layer HAI aur wo 100%
    # Devanagari codepoints deta hai — isliye neeche wala `conf < 0.12` wala
    # OCR-fallback KABHI nahi chala. Par us font ka glyph→Unicode naksha toota
    # hua hai, to akshar galat jud kar nikalte hain:
    #     "महाराज"  →  "निक माहाराज"
    #     "तिथि"    →  "तिततिथ"
    #     "विष्णु"  →  "तिवष्" / "विष्णुप"
    # 25_paath_jaanch.mjs ne naapa: 155 me se 138 ansh (89%) bigde hue.
    # Corpus ke baaki 24 granth 0.0%–2.0% par hain. Beech me kuch hai hi nahi.
    #
    # SEEKH: "Devanagari anupaat" paath ki shuddhi nahi naapta. Bigda paath
    # bhi poora Devanagari hota hai. Isiliye 25_paath_jaanch.mjs banayi gayi —
    # wo un dhaanchon ko ginti hai jo Devanagari vyakaran me ASAMBHAV hain.
    {"book_id":"ekadashi_mahatmya",  "source_pdf":"EKADASHI FULL BOOK.pdf",          "title":"Ekadashi Vrat Mahatmya",  "short":"Ekadashi",       "tradition":"vrat",     "language":"hi", "force_ocr":True},
    {"book_id":"mantra_maha_sagar",  "source_pdf":"MANTRA MAHA SAGAR FULL BOOK.pdf", "title":"Mantra Maha Sagar",       "short":"Mantra Sagar",   "tradition":"mantra",   "language":"sa+hi"},
    # mantra_shakti HATAYA (2026-08-04) — kharab nahi tha (aaj ke OCR ne use bhi
    # saaf kar diya: Latin 3,837 → 0), par DUPLICATE tha. mantra_maha_sagar
    # wahi vishay kai guna zyada cover karta hai:
    #     मन्त्र 652 vs 3,833 | जप 331 vs 824 | टोटका 0 vs 92 | उपाय 11 vs 137
    # Uski jagah Yoga Vasishtha — advaita vedanta ka granth (मन, वैराग्य,
    # मोक्ष), jis vishay ka koi samarpit granth SAARTHI mein tha hi nahi.
    # archive.org par woh 4 alag PDFs mein hai, isliye "source_pdfs" (list) —
    # sab bhaag ek hi granth ban jaate hain, 4 alag kitaabein nahi.
    {"book_id":"yoga_vasishtha",
     "source_pdfs":["yog_va_part 1.pdf", "yog part 2.pdf", "yog part 3.pdf", "yog part 4.pdf"],
     "title":"Shri Yoga Vasishtha Maharamayana", "short":"Yoga Vasishtha",
     "tradition":"vedanta", "language":"sa+hi"},
    # nitya_devta_archana HATAYA (2026-08-04) — do wajah:
    #   1. Uska vishay nitya_karm_pooja pehle se cover karta hai, aur kai guna
    #      behtar: पूजा 35 vs 354, संध्या 0 vs 124, मन्त्र 0 vs 320, विधि 1 vs 124
    #   2. Uska OCR sabse kharab tha — 56% shabd poore corpus mein sirf ek baar
    #      aate the (garbled). Ek mantra-kitab mein "मन्त्र" shabd 0 baar mila.
    # Uski jagah Ramcharitmanas — jo app pehle se quote karti thi par uske paas
    # thi nahi (DAILY_WISDOMS mein 3 chaupai, corpus mein 0 chunk).
    {"book_id":"ramcharitmanas",     "source_pdf":"Shri Ramcharitmanas - Gita Press (Hindi).pdf","title":"Shri Ramcharitmanas","short":"Ramcharitmanas","tradition":"ramayana","language":"sa+hi"},
    # valmiki_ramayana ki jagah (2026-08-06). Wo kitab hatai gayi kyunki uska
    # OCR poori tarah kachra tha — 381 akshar/page (baaki kitaabein ~2,000),
    # shabd-tootna 0.50 (saaf kitaabein 0.20-0.33), aur ek bhi kand ka naam
    # nahi milta tha (बालकांड 0, अयोध्या 0, लंका 0). Ramayan ka vishay ab
    # Ramcharitmanas theek se cover karti hai (saare 7 kand, हनुमान 356).
    #
    # ⚠️ force_ocr ZAROORI HAI. In PDFs mein text-layer TO hai, par wo purani
    # font-encoding (Kruti Dev jaisi) mein hai — Unicode ki jagah glyph-code.
    # Bina force_ocr ke 07 wahi kachra padh leti hai:
    #     "पÀचसËतȵततमोऽÉयायः द³, वैव×वत मनु तथा उनके पुčǆकɥ उÆपȷǺ"
    # 10_probe_pdf.py se dono tarah naapa (20 page prati volume):
    #     text-layer  → tootna 0.59-0.63  ❌
    #     force OCR   → tootna 0.25-0.28  ✅  (1,569-1,751 akshar/page)
    #
    # Chhe volume = 15,432 pages ≈ 20 ghante OCR. Ek hi book_id mein jud
    # jaate hain (source_pdfs list), 6 alag kitaabein nahi.
    {"book_id":"mahabharata",
     "source_pdfs":["Mahabharata Volume 1.pdf", "Mahabharata Volume 2.pdf",
                    "Mahabharata Volume 3.pdf", "Mahabharata Volume 4.pdf",
                    "Mahabharata Volume 5.pdf", "Mahabharata Volume 6.pdf"],
     "title":"Mahabharata (Gita Press)", "short":"Mahabharata",
     "tradition":"itihasa", "language":"sa+hi", "force_ocr":True},
    # ── 24va GRANTH (2026-08-11) ────────────────────────────────────────
    # KYUN YEH KITAB: 298 sawaalon mein jo 12 fail hue, wo lagbhag saare MAN
    # aur VICHAAR ke the — "thoughts ko observe kaise kare", "mindfulness kya
    # hai", "ego kya hota hai", "comparison chhodna". Hamare 23 granth KYA
    # KARNA CHAHIYE batate hain; Yogasutra KAISE KARNA HAI batata hai:
    #     चित्तवृत्तिनिरोध · पाँच क्लेश (अविद्या/अस्मिता/राग/द्वेष/अभिनिवेश)
    #     अभ्यास-वैराग्य · धारणा-ध्यान-समाधि
    # Aur user ke apne 500 sawaalon mein 11 baar maanga gaya.
    #
    # Doosra ummeedwaar Srimad Bhagavatam tha (13 baar maanga gaya), par
    # uski Prahlad/Dhruva/Ajamil ki kathayein Vishnu Puran aur Narsimha
    # Puran mein PEHLE SE hain — yaani aadha kaam dohra hota. Yogasutra ka
    # ek bhi ansh dohra nahi hai.
    #
    # ⚠️ force_ocr ZAROORI — bilkul Mahabharat/Chanakya Neeti jaisa mamla.
    # 10_probe_pdf.py se dono tarah naapa (20 page):
    #     text-layer  → tootna 0.56, Latin 0.16%  ❌
    #                   "चेतना का ÊвÊथ होना मैĉीकƧणामुिदतोपेƒाणां…"
    #     force OCR   → tootna 0.31, Latin 0.00%  ✅
    #                   "चेतना का स्वस्थ होना मैत्रीकरुणामुदितोपेक्षाणां…"
    # 84 page hi hain — OCR ~6 minute.
    {"book_id":"yoga_sutra",
     "source_pdf":"Patanjali Yog Sutra (Hindi).pdf",
     "title":"Patanjali Yoga Sutra (Hindi)", "short":"Yoga Sutra",
     "tradition":"yoga", "language":"sa+hi", "force_ocr":True},
    {"book_id":"nitya_karm_pooja",   "source_pdf":"NITYA KARM POOJA FULL BOOK.pdf",  "title":"Nitya Karm Pooja Prakash","short":"Nitya Pooja",    "tradition":"pooja",    "language":"sa+hi"},
    # amit_kalrekha HATAYA (copyright-shak) | positive_mindset HATAYA (copyright)
    {"book_id":"rashi_muhurt_vigyan","source_pdf":"SAMPURNA RASHI AUR MUHURT VIGYAN FULL BOOK.pdf","title":"Sampurna Rashi aur Muhurt Vigyan","short":"Rashi-Muhurt","tradition":"jyotish","language":"hi"},
    {"book_id":"lal_kitab",          "source_pdf":"LAL KITAB UPAY SAHIT FULL BOOK.pdf","title":"Lal Kitab (Upay Sahit)","short":"Lal Kitab",      "tradition":"jyotish",  "language":"hi"},
    # ── 2026-08-04 mein JODI GAYI (yeh batch-1 ki kitab hai, 01_ocr_extract.py se aayi thi) ──
    # KYUN: "लंका कांड ke baare mein bataye" par app ne koi Aadhaar nahi diya.
    # Jaanch par mila ki content corpus mein HAI hi nahi —
    #     valmiki_ramayana   389 akshar/page
    #     baaki 23 kitaabein 1,456 – 2,641 akshar/page
    # Yaani har panne ka sirf ~20% text nikla tha. Nirnayak saboot:
    #     "हनुमान"      → poori Ramayana mein 0 chunks
    #     "युद्धकाण्ड"  → 0 chunks
    #     "लंका"        → sirf 5 chunks
    # Isliye ise bhi naye OCR settings (hin+san, psm 3, 400dpi) se dobara
    # nikal rahe hain. Baaki 12 batch-1 kitaabein theek hain (1,456+ per page).
    {"book_id":"valmiki_ramayana",   "source_pdf":"RAMAYAN FULL BOOK.pdf","title":"Valmiki Ramayana","short":"Ramayana","tradition":"ramayana","language":"sa+hi"},
]
SKIP_FIRST_PAGES = 2   # cover/title pages

HAS_TESSERACT = shutil.which("tesseract") is not None

# ─── TEXT SAFAI (01 wale pipeline jaisi) ─────────────────────────────────────
def deva_ratio(t):
    if not t: return 0.0
    return sum(1 for c in t if 'ऀ' <= c <= 'ॿ') / len(t)

def confidence_score(text, lang):
    if not text or len(text.strip()) < 20: return 0.0
    words = len(text.split())
    if words < 3: return 0.1
    deva  = deva_ratio(text)
    noise = len(re.findall(r'(.)\1{4,}', text)) / max(1, words)
    base  = min(1.0, deva * 2.5) if ("hi" in lang or "sa" in lang) else 0.8
    return round(max(0.0, base - noise * 0.3), 3)

def clean_text(raw):
    if not raw: return ""
    t = unicodedata.normalize("NFC", raw)
    t = "".join(c for c in t if unicodedata.category(c) not in ("Cc","Cs","Co") or c == '\n')
    for p, r in [(r'[|]{2,}', '।'), (r'\s*।\s*।\s*', ' ।। '), (r'([०-९])\s+([०-९])', r'\1\2')]:
        t = re.sub(p, r, t)
    lines = []
    for line in t.split('\n'):
        s = line.strip()
        if re.fullmatch(r'[\d\s\[\]\(\)\-–—।॥]+', s) and len(s) < 12: continue
        if (len(s) < 100 and not any('ऀ' <= c <= 'ॿ' for c in s)
                and any(w in s.lower() for w in ['library','elibrary','gmail','.com','www.'])):
            continue
        lines.append(line)
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()

# ─── OCR SETTINGS (2026-08-04 mein badle — poori wajah neeche) ───────────────
#
# ASLI GHATNA: "कृत्तिका नक्षत्र में जन्मे जातक" ka jawab kitab ke ULTA aaya.
# Jaanch par mila ki content corpus mein HAI (rashi_muhurt_vigyan p.10), par
# OCR ne shirshak ko aise padha tha:
#
#     कृत्तिका  →  Gitar        कटु      →  HY
#     वृत्ति    →  ofa          हैं।     →  Sl
#
# Jo shabd DHOONDHNE ke liye chahiye tha, wahi bigda hua tha — isliye search
# us panne tak pahunch hi nahi paati thi. 11 kitaabon mein 0.27% se 18.30%
# tak shabd aise bigde hue nikle.
#
# JAD: `-l hin+eng` — humne Tesseract ko English likhne ki IJAZAT DI thi.
# Jab koi Devanagari shabd dhundhla dikha, usne Latin likh diya. Yeh
# Tesseract ki galti nahi thi; humne aisa bola tha.
#
# TEEN BADLAV:
#   1. lang: "hin+eng" → book ke hisaab se "hin" ya "hin+san"
#      eng HATA diya. Ab Latin nikal hi nahi sakta — Tesseract ko Devanagari
#      hi likhna padega. (san = Sanskrit traineddata, in granthon mein
#      shlok bhare hain; woh bhi Devanagari hai, isliye surakshit.)
#   2. psm 6 → 3: psm 6 poore panne ko "ek hi block" maanta hai. Par
#      rashi_muhurt_vigyan aur lal_kitab mein tables hain. psm 3 layout
#      khud pehchanta hai.
#   3. DPI 300 → 400: Devanagari ke matra-chinh (ि ी ु ू ृ) chhote hote
#      hain aur 300 par aksar chipak jaate hain.
#
# IMAANDARI: `-l hin` se Latin kachra PAKKA khatam hoga. Par uski jagah SAHI
# shabd aayega ya galat Devanagari — woh scan ki quality par hai. Isliye
# pehle ek kitab ke 20 pages par test karo (--max-pages 20), p.10 dekho, aur
# tabhi poora chalao.
OCR_DPI = 400
OCR_PSM = "3"

def ocr_lang_for(book):
    """eng KABHI nahi — wahi 'Gitar' wali galti ki jad thi."""
    lg = (book.get("language") or "hi")
    return "hin+san" if "sa" in lg else "hin"

def ocr_page(doc, pg_no, lang="hin"):
    mat = fitz.Matrix(OCR_DPI/72, OCR_DPI/72)
    pix = doc[pg_no].get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tf.write(pix.tobytes("png")); tmp = tf.name
    try:
        r = subprocess.run(["tesseract", tmp, "stdout", "-l", lang, "--psm", OCR_PSM, "--oem", "1"],
                           capture_output=True, text=True, timeout=300,
                           encoding="utf-8", errors="ignore")
        return r.stdout or ""
    except Exception:
        return ""
    finally:
        try: os.unlink(tmp)
        except Exception: pass

# ─── EK BOOK NIKALO ──────────────────────────────────────────────────────────
def extract_book(book, pdf_dir: Path, max_pages=None, force_rebuild=False):
    bid  = book["book_id"]
    outd = RAW_DIR / bid
    outd.mkdir(parents=True, exist_ok=True)

    print(f"\n📖 [{bid}] {book['title']}")

    # MULTI-PDF SUPPORT (2026-08-04): kuch granth kai bhaagon mein aate hain —
    # Yoga Vasishtha archive.org par 4 alag PDFs mein hai (2,608 pages). Woh
    # SAARTHI mein 4 alag kitaabein nahi, EK granth dikhni chahiye. Isliye
    # "source_pdfs" (list) diya ja sakta hai — sab bhaag ek hi doc mein jud
    # jaate hain aur page numbering lagataar chalti hai.
    srcs = book.get("source_pdfs") or [book["source_pdf"]]
    missing = [s for s in srcs if not (pdf_dir / s).exists()]
    if missing:
        print(f"   ❌ PDF nahi mili: {', '.join(missing)}")
        return None

    if len(srcs) == 1:
        doc = fitz.open(str(pdf_dir / srcs[0]))
    else:
        doc = fitz.open()                       # khaali, phir sab jod do
        for s in srcs:
            with fitz.open(str(pdf_dir / s)) as d:
                print(f"   + {s}  ({len(d)} pages)")
                doc.insert_pdf(d)
    n       = len(doc)
    limit   = min(n, max_pages) if max_pages else n
    written = skipped = failed = ocr_used = 0
    total_chars = 0
    prev = ""

    print(f"   {n} pages | text-layer pehle, OCR fallback: {'HAAN' if HAS_TESSERACT else 'NAHI (tesseract nahi mila)'}")

    for pg in range(limit):
        if pg < SKIP_FIRST_PAGES: skipped += 1; continue
        outf = outd / f"page_{pg:04d}.json"
        # resumable — par --force par dobara banao (naye OCR settings ke liye)
        if outf.exists() and not force_rebuild: skipped += 1; continue

        # 1) Text layer (turant + 100% sahi) — force_ocr wali books mein skip
        force  = book.get("force_ocr", False)
        raw    = "" if force else (doc[pg].get_text("text") or "")
        method = "text"
        # 2) Kam text = scan page → OCR (ya force_ocr book)
        if (force or len(raw.strip()) < 120) and HAS_TESSERACT:
            raw = ocr_page(doc, pg, ocr_lang_for(book)); method = "ocr"; ocr_used += 1

        text = clean_text(raw)
        conf = confidence_score(text, book["language"])
        # KRUTI-DEV FIX: kuch purani PDFs ki text-layer mein akshar toh hain
        # par woh Unicode Devanagari nahi (custom font encoding ka kachra).
        # Aisa dikhe toh OCR se dobara try karo — jo behtar ho wahi rakho.
        if method == "text" and conf < 0.12 and HAS_TESSERACT:
            raw2 = ocr_page(doc, pg, ocr_lang_for(book))
            t2   = clean_text(raw2)
            c2   = confidence_score(t2, book["language"])
            if c2 > conf:
                text, conf, method = t2, c2, "ocr"; ocr_used += 1
        if   len(text.strip()) < 30: st = "blank";    failed += 1
        elif conf < 0.12:            st = "low_conf"; failed += 1
        else:                        st = "ok";       written += 1; total_chars += len(text); prev = text

        page_data = {
            # Naya sahi meta (02 isse titles/pages uthata hai — purana bug yahan nahi)
            "meta": {"book_id": bid, "book_title": book["title"], "tradition": book["tradition"],
                     "source_pdf": srcs[0] if len(srcs)==1 else " + ".join(srcs), "source_page": pg, "page_display": pg + 1,
                     "language": book["language"], "script": "devanagari"},
            "qa":   {"method": method, "status": st, "confidence": conf},
            # Purane format ke bhai-bandhu fields (compat)
            "book_id": bid, "page": pg, "text": text, "confidence": conf,
            "ocr_lang": "hin+eng" if method == "ocr" else "n/a", "pipeline": "v3-addbooks",
        }
        # ATOMIC WRITE (2026-08-06). Pehle seedhe outf par likhte the. 20-ghante
        # ke run mein user beech mein Ctrl+C dabaye (ya bijli jaaye) to theek
        # us page ki AADHI JSON disk par reh jaati — aur file "maujood" hone ke
        # kaaran agli baar upar wala resume-check use SKIP kar deta. Nateeja:
        # ek chupchaap kharab page, jo baad mein 02_chunk par crash karta.
        # Ab pehle .tmp par likhte hain, phir replace() — jo OS star par
        # atomic hai. Beech mein ruke to sirf .tmp bachta hai, asli file banti
        # hi nahi, aur wo page agli baar dobara ho jaata hai.
        tmpf = outf.with_suffix(".tmp")
        tmpf.write_text(json.dumps(page_data, ensure_ascii=False), encoding="utf-8")
        tmpf.replace(outf)

        if (pg + 1) % 25 == 0:
            print(f"   ...page {pg+1}/{limit}  (ok:{written} ocr:{ocr_used})", flush=True)

    doc.close()
    print(f"   ✅ ok:{written}  blank/low:{failed}  skip:{skipped}  OCR-pages:{ocr_used}  chars:{total_chars:,}")
    return {"book_id": bid, "title": book["title"], "short": book["short"],
            "tradition": book["tradition"], "language": book["language"],
            "script": "devanagari", "source_pdf": srcs[0] if len(srcs)==1 else " + ".join(srcs),
            "method": "text+ocr" if ocr_used else "text",
            "pages_extracted": written, "total_chars": total_chars, "pipeline": "v3-addbooks"}

# ─── MAIN ────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir", required=True, help="folder jisme 11 nayi PDFs hain")
    ap.add_argument("--books", nargs="*", help="sirf yeh book_ids")
    ap.add_argument("--max-pages", type=int, default=None, help="test: har book ke pehle N pages")
    # 2026-08-04: OCR settings badle (hin+eng → hin/hin+san, psm 3, 400 dpi).
    # Bina iske script bane hue pages SKIP kar deti hai (resumable design) aur
    # naye settings lagte hi nahi. Yeh flag unhe dobara banata hai.
    ap.add_argument("--force", action="store_true",
                    help="pehle se bane pages bhi DOBARA banao (naye OCR settings ke liye)")
    args = ap.parse_args()

    pdf_dir = Path(args.pdf_dir)
    if not pdf_dir.exists():
        raise SystemExit(f"PDF folder nahi mila: {pdf_dir}")
    if not MANIFEST.exists():
        raise SystemExit("extraction_manifest.json nahi mila — purani 13 books ka data/raw sahi jagah hai?")

    targets = [b for b in NEW_BOOKS if not args.books or b["book_id"] in args.books]
    print("=" * 60)
    print(f"  SAARTHI — Nayi Books Ingestion  ({len(targets)} books)")
    print(f"  Tesseract OCR: {'available ✅' if HAS_TESSERACT else 'NAHI — sirf text-layer PDFs chalengi ⚠️'}")
    print("=" * 60)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    existing = {b["book_id"]: b for b in manifest.get("books", [])}

    t0 = time.time()
    for book in targets:
        entry = extract_book(book, pdf_dir, args.max_pages, args.force)
        if entry and entry["pages_extracted"] > 0:
            existing[entry["book_id"]] = entry
            manifest["books"] = list(existing.values())
            MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"   💾 manifest updated ({len(existing)} books total)")

    print("\n" + "=" * 60)
    print(f"  ✅ Ho gaya — {round((time.time()-t0)/60, 1)} min")
    print(f"  Total books in manifest: {len(existing)}")
    print("  AGLA KADAM:")
    print("    python scripts\\02_chunk.py")
    print("    python scripts\\03_embed_build.py --skip-embeddings")
    print("    Copy-Item data\\knowledge\\*.json public\\knowledge\\ -Force")
    print("    python scripts\\05_split_knowledge.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
