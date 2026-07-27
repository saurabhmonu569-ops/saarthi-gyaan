#!/usr/bin/env python3
"""
SAARTHI v2 — Complete Knowledge Ingestion Script
=================================================
Run this on your own machine to process all 18 Sacred PDFs.

Requirements:
  pip install pymupdf
  sudo apt-get install tesseract-ocr tesseract-ocr-hin tesseract-ocr-script-deva

Usage:
  # Full run (6-12 hours):
  python3 run_ingestion.py

  # With Gemini embeddings (adds semantic search):
  GEMINI_API_KEY=AIza... python3 run_ingestion.py

  # Resume after interruption (skips already-done pages):
  python3 run_ingestion.py

  # Test on 10 pages per book:
  python3 run_ingestion.py --test

Place this script in the saarthi/ folder (same level as package.json).
PDFs go in: ./pdfs/ folder (create it, copy your PDFs there).
Output goes to: ./public/knowledge/
"""

import fitz, json, os, re, subprocess, sys, tempfile, time, unicodedata, hashlib, signal
from pathlib import Path

# ─── CONFIG ───────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
PDF_DIR      = PROJECT_ROOT / "pdfs"           # put your PDFs here
RAW_DIR      = SCRIPT_DIR / "_raw"            # intermediate OCR output
CHUNK_DIR    = SCRIPT_DIR / "_chunks"         # intermediate chunks
OUTPUT_DIR   = PROJECT_ROOT / "public" / "knowledge"  # final output

GEMINI_KEY   = os.environ.get("GEMINI_API_KEY", "")
EMBED_MODEL  = "models/text-embedding-004"
EMBED_DIM    = 768
RPM_DELAY    = 60.0 / 85   # 85 RPM (safe margin under 100 RPM free tier)

TEST_MODE    = "--test" in sys.argv
MAX_PG_TEST  = 10

for d in [RAW_DIR, CHUNK_DIR, OUTPUT_DIR]: d.mkdir(parents=True, exist_ok=True)

# ─── BOOK REGISTRY ────────────────────────────────────────────────────────────
BOOKS = [
    {"id":"bhagavad_gita_shankar","pdf":"BHAGVAT_GEETA.pdf",                               "title":"Shrimad Bhagavad Gita (Shankar Bhashya)","tradition":"gita","language":"hi","skip":list(range(0,4))},
    {"id":"bhagavad_gita_smbg1",  "pdf":"SMBG_1.pdf",                                      "title":"Srimad Bhagavad Gita Part 1",            "tradition":"gita","language":"hi","skip":[0,1]},
    {"id":"bhagavad_gita_smbg2",  "pdf":"SMBG_2.pdf",                                      "title":"Srimad Bhagavad Gita Part 2",            "tradition":"gita","language":"hi","skip":[0,1]},
    {"id":"valmiki_ramayana",     "pdf":"RAMAYAN.pdf",                                     "title":"Valmiki Ramayana",                        "tradition":"ramayana","language":"hi","skip":list(range(0,8))},
    {"id":"rigveda_1",            "pdf":"RIGVED_1.pdf",                                    "title":"Rigveda Part 1",                          "tradition":"veda","language":"sa+hi","skip":list(range(0,5))},
    {"id":"rigveda_2",            "pdf":"RIGVED_2.pdf",                                    "title":"Rigveda Part 2",                          "tradition":"veda","language":"sa+hi","skip":list(range(0,5))},
    {"id":"samaveda",             "pdf":"SAMVED_2.pdf",                                    "title":"Samaveda",                                "tradition":"veda","language":"sa+hi","skip":list(range(0,4))},
    {"id":"yajurveda",            "pdf":"YAJURVED_3.pdf",                                  "title":"Yajurveda",                               "tradition":"veda","language":"sa+hi","skip":list(range(0,4))},
    {"id":"atharvaveda_1",        "pdf":"ARTHVED_1.pdf",                                   "title":"Atharvaveda Part 1",                      "tradition":"veda","language":"sa+hi","skip":list(range(0,4))},
    {"id":"shiva_purana_1",       "pdf":"SHIV_1.pdf",                                      "title":"Shiva Purana Part 1",                     "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"shiva_purana_2",       "pdf":"SHIV_2.pdf",                                      "title":"Shiva Purana Part 2",                     "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"garuda_purana_1",      "pdf":"GARUD_PURAN_1.pdf",                               "title":"Garuda Purana Part 1",                    "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"garuda_purana_2",      "pdf":"GARUD_PURAN_2.pdf",                               "title":"Garuda Purana Part 2",                    "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"vishnu_purana_1",      "pdf":"VISHNU_1.pdf",                                    "title":"Vishnu Purana Part 1",                    "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"vishnu_purana_2",      "pdf":"VISHNU_2.pdf",                                    "title":"Vishnu Purana Part 2",                    "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"narasimha_purana",     "pdf":"NARSHIM_PURAN.pdf",                               "title":"Narasimha Purana",                        "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"bhavishya_purana",     "pdf":"BHAVISHY_PURAN.pdf",                              "title":"Bhavishya Purana",                        "tradition":"purana","language":"hi","skip":list(range(0,4))},
    {"id":"guru_granth_sahib",    "pdf":"Adi_Sri_Guru_Granth_Sahib_Ji_Hindi_1_compressed.pdf","title":"Guru Granth Sahib (Hindi)","tradition":"sikhism","language":"hi+pa","skip":list(range(0,3))},
]

# ─── UTILS ────────────────────────────────────────────────────────────────────
def deva_ratio(t):
    if not t: return 0.0
    return sum(1 for c in t if '\u0900'<=c<='\u097F') / len(t)

def conf_score(text, lang="hi"):
    if not text or len(text.strip())<20: return 0.0
    w = len(text.split())
    if w<3: return 0.1
    d = deva_ratio(text)
    noise = len(re.findall(r'(.)\1{4,}', text)) / max(1,w)
    base  = min(1.0, d*2.5) if ("hi" in lang or "sa" in lang) else 0.8
    return round(max(0.0, base - noise*0.3), 3)

def clean_ocr(raw):
    if not raw: return ""
    t = unicodedata.normalize("NFC", raw)
    t = "".join(c for c in t if unicodedata.category(c) not in ("Cc","Cs","Co") or c=='\n')
    for p,r in [(r'[|]{2,}','।'),(r'\s*।\s*।\s*',' ।। '),(r'([०-९])\s+([०-९])',r'\1\2')]:
        t = re.sub(p,r,t)
    lines=[]
    for line in t.split('\n'):
        s=line.strip()
        if re.fullmatch(r'[\d\s\[\]\(\)\-–—।॥]+',s) and len(s)<12: continue
        if len(s)<100 and not any('\u0900'<=c<='\u097F' for c in s) \
           and any(w in s.lower() for w in ['library','elibrary','gmail','.com','www.']): continue
        lines.append(line)
    return re.sub(r'\n{3,}','\n\n','\n'.join(lines)).strip()

def dup_check(a, b, thresh=0.85):
    def tg(t):
        w=t.split(); return set(zip(w,w[1:],w[2:])) if len(w)>=3 else set()
    ta,tb=tg(a),tg(b)
    if not ta or not tb: return False
    return len(ta&tb)/max(1,len(ta|tb))>thresh

CHAPTER_PATS = [
    re.compile(r'(?:अध्याय|अधयाय)\s*[–\-:]?\s*([०-९\d]+)', re.UNICODE|re.IGNORECASE),
    re.compile(r'(?:chapter|CH\.?)\s*[–\-:]?\s*(\d+)', re.IGNORECASE),
    re.compile(r'(?:काण्ड|कान्ड|kanda)\s*[–\-:]?\s*([०-९\w]+)', re.UNICODE|re.IGNORECASE),
    re.compile(r'(?:सर्ग|सग)\s*[–\-:]?\s*([०-९\d]+)', re.UNICODE|re.IGNORECASE),
    re.compile(r'(?:मण्डल|mandal)\s*[–\-:]?\s*([०-९\d]+)', re.UNICODE|re.IGNORECASE),
    re.compile(r'(?:खण्ड|khand|section)\s*[–\-:]?\s*([०-९\d]+)', re.UNICODE|re.IGNORECASE),
    re.compile(r'(?:पर्व|parva)\s*[–\-:]?\s*([०-९\w]+)', re.UNICODE|re.IGNORECASE),
]
VERSE_PATS = [
    re.compile(r'[।॥]\s*(?:\d+[\.\-]\d+|\d+)\s*[।॥]'),
    re.compile(r'(?:श्लोक|shlok)\s*(\d+)', re.UNICODE|re.IGNORECASE),
]

def to_int(s):
    try: return int(str(s).translate(str.maketrans('०१२३४५६७८९','0123456789')).strip())
    except: return None

def detect_structure(text, cur):
    s=dict(cur)
    for pat in CHAPTER_PATS:
        m=pat.search(text)
        if m:
            n=to_int(m.group(1))
            if n:
                s["chapter"]=n; s["section"]=None; s["verse"]=None
                s["chapter_title"]=text.strip()[:120]
                return s
    for pat in VERSE_PATS:
        if pat.search(text):
            s["verse"]=(s.get("verse") or 0)+1; return s
    return s

def split_chunks(text, max_c=1500, min_c=80):
    if not text: return []
    paras=[p.strip() for p in re.split(r'\n\n+',text) if p.strip()]
    chunks,cur=[],""
    for para in paras:
        cand=(cur+"\n\n"+para).strip() if cur else para
        if len(cand)>max_c and cur:
            if len(cur.strip())>=min_c: chunks.append(cur.strip())
            cur=para
        else: cur=cand
    if cur.strip() and len(cur.strip())>=min_c: chunks.append(cur.strip())
    result=[]
    for chunk in chunks:
        if len(chunk)<=max_c: result.append(chunk)
        else:
            sents=re.split(r'(?<=[।.!?\n])\s+',chunk); sub=""
            for s in sents:
                if len(sub+" "+s)>max_c and sub:
                    if len(sub.strip())>=min_c: result.append(sub.strip())
                    sub=s
                else: sub=(sub+" "+s).strip()
            if sub.strip() and len(sub.strip())>=min_c: result.append(sub.strip())
    return result

def chunk_id(book_id, page, idx):
    raw=f"{book_id}::{page:04d}::{idx:04d}"
    return "ck_"+hashlib.sha256(raw.encode()).hexdigest()[:12]

# ─── STEP 1: OCR ──────────────────────────────────────────────────────────────
def step1_ocr():
    print("\n" + "="*60)
    print("  STEP 1: OCR EXTRACTION")
    print("="*60)
    for book in BOOKS:
        pdf_path = PDF_DIR / book["pdf"]
        if not pdf_path.exists():
            print(f"  SKIP (not found): {book['pdf']}")
            continue
        out_dir = RAW_DIR / book["id"]
        out_dir.mkdir(exist_ok=True)
        doc   = fitz.open(str(pdf_path))
        n     = len(doc)
        skip  = set(book.get("skip",[]))
        lang  = "hin+eng"
        done  = set(int(f.stem.split("_")[1]) for f in out_dir.glob("page_*.json"))
        todo  = [pg for pg in range(n) if pg not in skip and pg not in done]
        if TEST_MODE: todo = todo[:MAX_PG_TEST]
        print(f"\n  {book['id']}: {n} pages, {len(done)} done, {len(todo)} to process")
        prev=""; processed=0
        for pg in todo:
            mat = fitz.Matrix(300/72,300/72)
            pix = doc[pg].get_pixmap(matrix=mat,colorspace=fitz.csGRAY)
            with tempfile.NamedTemporaryFile(suffix=".png",delete=False) as tf:
                tf.write(pix.tobytes("png")); tmp=tf.name
            try:
                r=subprocess.run(["tesseract",tmp,"stdout","-l",lang,"--psm","6","--oem","1"],
                                 capture_output=True,text=True,timeout=120)
                raw=r.stdout
            except: raw=""
            finally: os.unlink(tmp)
            text=clean_ocr(raw)
            c=conf_score(text,book["language"])
            dup=dup_check(prev,text) if prev and text else False
            if   len(text.strip())<30: st="blank"
            elif c<0.15:               st="low_conf"
            elif dup:                  st="duplicate"
            else:                      st="ok"; prev=text
            pd_data={"meta":{"book_id":book["id"],"book_title":book["title"],
                              "tradition":book["tradition"],"source_pdf":book["pdf"],
                              "source_page":pg,"page_display":pg+1,
                              "language":book["language"],"script":"devanagari"},
                     "qa":{"method":"ocr","ocr_lang":lang,"status":st,"confidence":c,
                           "is_duplicate":dup,"char_count":len(text),"word_count":len(text.split()),
                           "devanagari_pct":round(deva_ratio(text)*100,1)},
                     "text":text}
            (out_dir/f"page_{pg:04d}.json").write_text(json.dumps(pd_data,ensure_ascii=False,indent=2))
            processed+=1
            if processed % 25==0: print(f"    pg {pg+1}/{n} processed={processed} conf={c:.2f}")
        doc.close()
        print(f"  {book['id']}: +{processed} pages done")

# ─── STEP 2: CHUNK ────────────────────────────────────────────────────────────
def step2_chunk():
    print("\n" + "="*60)
    print("  STEP 2: CHUNKING")
    print("="*60)
    global_idx=0; all_chunks=[]; summaries=[]
    for book in BOOKS:
        raw_dir=RAW_DIR/book["id"]
        if not raw_dir.exists(): continue
        pages=sorted(raw_dir.glob("page_*.json"))
        if not pages: continue
        chunk_out=CHUNK_DIR/book["id"]; chunk_out.mkdir(exist_ok=True)
        structure={"chapter":None,"section":None,"verse":None,"chapter_title":None}
        book_chunks=[]; chapters=set()
        for pf in pages:
            try: pd=json.loads(pf.read_text())
            except: continue
            if pd["qa"]["status"] in ("blank","low_conf") or not pd.get("text"): continue
            text=pd["text"]; pg=pd["meta"]["source_page"]; pgd=pd["meta"]["page_display"]
            for line in text.split('\n'):
                if line.strip(): structure=detect_structure(line,structure)
            if structure.get("chapter"): chapters.add(structure["chapter"])
            for ci,ct in enumerate(split_chunks(text)):
                cid=chunk_id(book["id"],pg,ci)
                c={"chunk_id":cid,"chunk_index":global_idx,
                   "book_id":book["id"],"book_title":book["title"],"tradition":book["tradition"],
                   "source_pdf":book["pdf"],"source_page":pg,"page_display":pgd,
                   "language":book["language"],"script":"devanagari",
                   "chapter":structure.get("chapter"),"chapter_title":structure.get("chapter_title"),
                   "section":structure.get("section"),"verse":structure.get("verse"),
                   "paragraph":ci+1,"text":ct,"word_count":len(ct.split()),
                   "char_count":len(ct),"ocr_confidence":pd["qa"].get("confidence",0),
                   "extraction_method":"ocr","embedding_id":None,"embedding":None}
                book_chunks.append(c); all_chunks.append(c)
                (chunk_out/f"chunk_{global_idx:06d}.json").write_text(json.dumps(c,ensure_ascii=False,indent=2))
                global_idx+=1
        tw=sum(c["word_count"] for c in book_chunks)
        print(f"  {book['id']:<35} {len(book_chunks):>4} chunks  {len(chapters):>3} ch  {tw:>8,} words")
        summaries.append({"book_id":book["id"],"title":book["title"],"tradition":book["tradition"],
                           "chunks":len(book_chunks),"total_words":tw,
                           "chapters_found":sorted(list(chapters)),"status":"complete"})
    (CHUNK_DIR/"chunk_manifest.json").write_text(json.dumps({"stage":"02_chunk","books":summaries,"total_chunks":global_idx},ensure_ascii=False,indent=2))
    print(f"\n  Total: {global_idx:,} chunks")
    return all_chunks

# ─── STEP 3: EMBED ────────────────────────────────────────────────────────────
def embed_text(text):
    if not GEMINI_KEY: return None
    import urllib.request, urllib.error
    ep=f"https://generativelanguage.googleapis.com/v1beta/{EMBED_MODEL}:embedContent?key={GEMINI_KEY}"
    payload=json.dumps({"model":EMBED_MODEL,"content":{"parts":[{"text":text[:8000]}]},"taskType":"SEMANTIC_SIMILARITY"}).encode()
    req=urllib.request.Request(ep,data=payload,headers={"Content-Type":"application/json"},method="POST")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=30) as resp:
                return json.loads(resp.read())["embedding"]["values"]
        except urllib.error.HTTPError as e:
            if e.code==429: time.sleep(60*(attempt+1)); continue
            return None
        except: time.sleep(5)
    return None

def step3_embed(chunks):
    if not GEMINI_KEY:
        print("\n  STEP 3: SKIPPED (no GEMINI_API_KEY — keyword search still works)")
        return chunks
    print(f"\n  STEP 3: EMBEDDINGS ({len(chunks):,} chunks)")
    t0=time.time()
    for i,c in enumerate(chunks):
        if c.get("embedding"): continue
        emb=embed_text(c["text"])
        if emb:
            c["embedding"]=emb; c["embedding_id"]=c["chunk_id"]
            cf=CHUNK_DIR/c["book_id"]/f"chunk_{c['chunk_index']:06d}.json"
            if cf.exists():
                d=json.loads(cf.read_text()); d["embedding"]=emb; d["embedding_id"]=c["chunk_id"]
                cf.write_text(json.dumps(d,ensure_ascii=False,indent=2))
        time.sleep(RPM_DELAY)
        if (i+1)%50==0:
            elapsed=time.time()-t0; rate=(i+1)/elapsed
            eta=(len(chunks)-i-1)/max(0.01,rate)
            print(f"    {i+1}/{len(chunks)} embedded  rate={rate:.1f}/s  ETA={eta/60:.0f}min")
    return chunks

# ─── STEP 4: BUILD KNOWLEDGE STORE ───────────────────────────────────────────
def step4_build(chunks):
    print("\n  STEP 4: BUILDING KNOWLEDGE STORE")
    STOP=set("का के की को कि में से और पर यह जो है ने भी एक था the a an is in of to and or for".split())
    index={}
    for c in chunks:
        for w in set(re.findall(r'[\u0900-\u097Fa-zA-Z]{3,}',c["text"].lower())):
            if w not in STOP: index.setdefault(w,[]).append(c["chunk_id"])
    trimmed={w:ids for w,ids in index.items() if 1<=len(ids)<=300}

    books_map={}
    for c in chunks:
        bid=c["book_id"]
        if bid not in books_map:
            books_map[bid]={"book_id":bid,"title":c["book_title"],"tradition":c["tradition"],
                            "language":c.get("language","hi"),"chunk_count":0,
                            "chapters":set(),"page_range":[9999,0]}
        b=books_map[bid]; b["chunk_count"]+=1
        if c.get("chapter"): b["chapters"].add(c["chapter"])
        pg=c.get("page_display",0)
        if pg<b["page_range"][0]: b["page_range"][0]=pg
        if pg>b["page_range"][1]: b["page_range"][1]=pg
    for b in books_map.values(): b["chapters"]=sorted(list(b["chapters"])); b["chapter_count"]=len(b["chapters"])

    ch_map={}
    for c in chunks:
        if not c.get("chapter"): continue
        key=f"{c['book_id']}::ch{c['chapter']}"
        if key not in ch_map:
            ch_map[key]={"book_id":c["book_id"],"chapter":c["chapter"],
                          "chapter_title":c.get("chapter_title"),"first_page":c["page_display"],"chunk_ids":[]}
        ch_map[key]["chunk_ids"].append(c["chunk_id"])

    knowledge={"version":"2.0.0","schema":"saarthi-knowledge-v2",
               "embed_model":EMBED_MODEL,"embed_dim":EMBED_DIM,
               "total_chunks":len(chunks),"generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
               "chunks":[{"id":c["chunk_id"],"book":c["book_id"],"book_title":c["book_title"],
                          "tradition":c["tradition"],"page":c["page_display"],
                          "chapter":c.get("chapter"),"chapter_title":c.get("chapter_title"),
                          "section":c.get("section"),"verse":c.get("verse"),
                          "language":c.get("language","hi"),"text":c["text"],
                          "word_count":c["word_count"],"confidence":c.get("ocr_confidence",0),
                          "embedding":c.get("embedding")} for c in chunks]}

    kp=OUTPUT_DIR/"knowledge.json"; bp=OUTPUT_DIR/"book_manifest.json"
    cp=OUTPUT_DIR/"chapter_manifest.json"; sp=OUTPUT_DIR/"search_manifest.json"
    kp.write_text(json.dumps(knowledge,ensure_ascii=False))
    bp.write_text(json.dumps({"version":"2.0.0","books":list(books_map.values())},ensure_ascii=False,indent=2))
    cp.write_text(json.dumps({"version":"2.0.0","chapters":list(ch_map.values())},ensure_ascii=False,indent=2))
    sp.write_text(json.dumps({"version":"2.0.0","keyword_index":trimmed},ensure_ascii=False))
    print(f"  knowledge.json       {kp.stat().st_size/1024:.0f} KB")
    print(f"  book_manifest.json   {bp.stat().st_size/1024:.0f} KB  ({len(books_map)} books)")
    print(f"  chapter_manifest.json {cp.stat().st_size/1024:.0f} KB  ({len(ch_map)} chapters)")
    print(f"  search_manifest.json {sp.stat().st_size/1024:.0f} KB  ({len(trimmed):,} keywords)")

if __name__=="__main__":
    print(f"\n{'='*60}")
    print(f"  SAARTHI Full Ingestion {'(TEST MODE)' if TEST_MODE else ''}")
    print(f"  PDFs: {PDF_DIR}  →  Output: {OUTPUT_DIR}")
    print(f"  Gemini embeddings: {'YES' if GEMINI_KEY else 'NO (keyword search only)'}")
    print(f"{'='*60}")
    step1_ocr()
    chunks = step2_chunk()
    chunks = step3_embed(chunks)
    step4_build(chunks)
    print(f"\n  ✓ COMPLETE")
    print(f"  Copy output to saarthi/public/knowledge/ and rebuild the app.")
