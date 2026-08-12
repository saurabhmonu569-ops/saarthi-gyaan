#!/usr/bin/env python3
"""
SAARTHI — "50 QUES PER BOOK" wali PDF se sawaal nikaalo   (2026-08-12)
=====================================================================
KYUN: sawaal PDF me aate hain, aur us PDF me do dikkatein hain jinse
chup-chaap galat sawaal ban jaate hain:

1. LIGATURE — PDF ka font "ti", "tt", "tti" ko ek hi glyph me jodta hai,
   aur pdfplumber unhe "(cid:415)" jaise code me deta hai. Inhe seedhe
   hata dene par shabd toot jaate hain:
       "Chitta Vritti Nirodha"  →  "Chia Vri Nirodha"
       "attachment"             →  "aachment"
       "naimittik"              →  "naimik"
   Aur ye galti chup-chaap nikalti hai — sawaal padhne me theek lagta
   hai, par RAG use kabhi nahi dhoondh paata. Isliye teenon code ka
   sahi akshar likha gaya hai (neeche LIGATURE dekho).

2. TOOTI PANKTIYAN — lamba sawaal do-teen line me toot jaata hai. Jo
   pankti ginti (jaise "12.") se shuru nahi hoti, use pichhle sawaal se
   jod diya jaata hai.

CHALAO:
    python scripts/16_pdf_to_perbook.py "path/to/50 QUES PER BOOK.pdf"
    python scripts/16_pdf_to_perbook.py *.pdf --out scripts/per-book-questions.txt

NIKLEGA: scripts/per-book-questions.txt
    ## <book_id>
    sawaal
    sawaal
    ...

Isi file ko 19_eval_perbook.mjs padhti hai.
"""

import re, sys, argparse
from pathlib import Path
from collections import Counter

try:
    import pdfplumber
except ImportError:
    sys.exit("❌ pdfplumber chahiye:  pip install pdfplumber --break-system-packages")

ROOT = Path(__file__).resolve().parent.parent

# PDF ke font ne in aksharon ko jod diya tha. Inhe hatana NAHI hai —
# badalna hai. Naya code mile to script neeche chetavni deti hai.
LIGATURE = {
    "415": "ti",     # con(415)nue  → continue
    "425": "tt",     # a(425)achment → attachment
    "427": "tti",    # naimi(427)k   → naimittik
    "332": "ft",     # Twel(332)h    → Twelfth
    "336": "\u0947\u0902",  # म(336) → में   (Devanagari ki matra "ें")
    "424": "tf",
    "429": "ttu",
}

# PDF ke sheershak → hamare book_id.
# ⚠️ Yahan wahi id likhein jo src/data/bookMeta.js me hai — warna naap
# me wo granth "kabhi nahi aaya" dikhega aur wajah dhoondhna mushkil hoga.
NAAM_SE_ID = {
    "SHRIMAD BHAGAVAD GITA": "bhagavad_gita_shankar",
    "BHAGAVAD GITA": "bhagavad_gita_shankar",
    # Ved ke naam do-do roop me aate hain — BATCH 1-2 me chhota roop
    # ("SAMVED"), BATCH 3-5 me lamba ("SAMAVEDA"). Dono rakhe hain.
    "RIGVEDA": "rigveda_1",   "RIGVED": "rigveda_1",
    "SAMAVEDA": "samaveda",   "SAMVED": "samaveda",
    "YAJURVEDA": "yajurveda", "YAJURVED": "yajurveda",
    "ATHARVAVEDA": "atharvaveda_1", "ATHARVED": "atharvaveda_1",
    "ATHARVAVED": "atharvaveda_1",
    "SHIV PURAN KHAND 1": "shiva_purana_1",
    "SHIV PURAN KHAND 2": "shiva_purana_2",
    "VISHNU PURAN": "vishnu_purana_1",
    "GARUD PURAN": "garuda_purana_1",
    "GARUDA PURAN": "garuda_purana_1",
    "NARSIMHA PURAN": "narasimha_purana",
    "NARASIMHA PURAN": "narasimha_purana",
    "BHAVISHYA PURAN": "bhavishya_purana",
    "AGNI PURAN": "agni_purana",
    "ISHA UPANISHAD": "ishadi_upanishad",
    "ISHADI UPANISHAD": "ishadi_upanishad",
    "KATHA UPANISHAD": "kathopanishad",
    "KATHO UPANISHAD": "kathopanishad",
    "CHANAKYA NEETI": "chanakya_neeti",
    "EKADASHI FULL BOOK": "ekadashi_mahatmya",
    "EKADASHI": "ekadashi_mahatmya",
    "NITYA KARM POOJA FULL BOOK": "nitya_karm_pooja",
    "NITYA KARM POOJA": "nitya_karm_pooja",
    "MANTRA MAHA SAGAR FULL BOOK": "mantra_maha_sagar",
    "MANTRA MAHA SAGAR": "mantra_maha_sagar",
    "GURU GRANTH SAHIB": "guru_granth_sahib",
    "LAL KITAB UPAY SAHIT": "lal_kitab",
    "LAL KITAB": "lal_kitab",
    "SAMPURNA RASHI AUR MUHURT VIGYAN": "rashi_muhurt_vigyan",
    "RASHI AUR MUHURT VIGYAN": "rashi_muhurt_vigyan",
    "SHRI RAMCHARITMANAS": "ramcharitmanas",
    "RAMCHARITMANAS": "ramcharitmanas",
    "YOGA VASISHTA OF VALMIKI": "yoga_vasishtha",
    "YOGA VASISHTA": "yoga_vasishtha",
    "MAHABHARATA": "mahabharata",
    "PATANJALI YOG SUTRA": "yoga_sutra",
    "PATANJALI YOGA SUTRA": "yoga_sutra",
}


def saaf(t: str) -> tuple[str, list[str]]:
    """Ligature theek karo, emoji hatao. Anjaan 3-ank ke code lauta do."""
    anjaan = []
    for code, akshar in LIGATURE.items():
        t = t.replace(f"(cid:{code})", akshar)
    for code in set(re.findall(r"\(cid:(\d{1,4})\)", t)):
        anjaan.append(code)          # 4 ank ya kam = shayad ligature, emoji nahi
    t = re.sub(r"\(cid:\d+\)", "", t)  # bache hue (emoji) hata do
    return t, anjaan


def pdf_padho(path: Path) -> str:
    with pdfplumber.open(path) as pdf:
        return "\n".join((p.extract_text() or "") for p in pdf.pages)


def nikalo(t: str) -> dict[str, list[str]]:
    out, abhi = {}, None
    for ln in t.split("\n"):
        m = re.match(r"^.*\bBOOK\s*\d+\s*[—–-]\s*(.+?)\s*$", ln)
        if m:
            naam = re.sub(r"\s+", " ", m.group(1)).strip().upper()
            naam = re.sub(r"\s*[—–-]\s*GITA PRESS$", "", naam)
            abhi = NAAM_SE_ID.get(naam)
            if abhi:
                out.setdefault(abhi, [])
            else:
                print(f"  ⚠️  sheershak pehchana nahi: \"{naam}\" — NAAM_SE_ID me jodiye")
            continue
        if abhi is None:
            continue
        q = re.match(r"^\s*\d{1,3}\.\s+(.+)$", ln)
        if q:
            out[abhi].append(q.group(1).strip())
        elif out.get(abhi) and ln.strip() and len(ln.strip()) > 3 \
                and not re.match(r"^(Q\d|Total|Same rules|BATCH|Bilkul|Is batch)", ln.strip()) \
                and not ln.strip().endswith(":"):
            out[abhi][-1] += " " + ln.strip()      # tooti pankti jodo

    # SOOCHI KI PANKTIYAN HATAO.
    # PDF ke ant me agle batch ki yojana likhi hai —
    #     "Ekadashi Full Book — Q751–Q800"
    #     "Mahabharata Volume 1-6 — ONE Mahabharata Source — Q1151–Q1200"
    # Ye sawaal nahi hain. Bina hataye chanakya_neeti aur lal_kitab me 50 ki
    # jagah 55 aa rahe the — aur wo paanch naap me "fail" dikhte, jabki wo
    # kabhi sawaal the hi nahi.
    for k in out:
        out[k] = [q for q in out[k] if not re.search(r"—\s*Q\d+\s*[–-]\s*Q\d+", q)]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("--out", default=str(ROOT / "scripts" / "per-book-questions.txt"))
    ap.add_argument("--append", action="store_true", help="purani file me jodo (BATCH 2, 3… ke liye)")
    a = ap.parse_args()

    sab, anjaan_sab = {}, Counter()
    for p in a.pdfs:
        t, anjaan = saaf(pdf_padho(Path(p)))
        anjaan_sab.update(anjaan)
        for k, v in nikalo(t).items():
            sab.setdefault(k, []).extend(v)

    if anjaan_sab:
        print(f"\n  ⚠️  anjaan ligature-code mile: {', '.join(sorted(anjaan_sab))}")
        print(f"      Inhe hata diya gaya hai, jisse kuch shabd toot sakte hain.")
        print(f"      PDF me dekhiye kaunsa akshar tha, aur LIGATURE me jod dijiye.\n")

    # purani file jodni ho to padh lo
    out_path = Path(a.out)
    if a.append and out_path.exists():
        purani, k = {}, None
        for ln in out_path.read_text(encoding="utf-8").split("\n"):
            if ln.startswith("## "): k = ln[3:].strip(); purani.setdefault(k, [])
            elif k and ln.strip() and not ln.startswith("#"): purani[k].append(ln.strip())
        for k, v in sab.items():
            purani.setdefault(k, []).extend(x for x in v if x not in purani.get(k, []))
        sab = purani

    kul = 0
    print(f"  {'granth':<24} sawaal")
    for k in sorted(sab):
        sab[k] = [re.sub(r"\s+", " ", x).strip() for x in sab[k]]
        sab[k] = [x for x in sab[k] if len(x) > 15]
        kul += len(sab[k])
        print(f"  {k:<24} {len(sab[k])}")
    print(f"  {'KUL':<24} {kul}\n")

    buf = ["# SAARTHI — per-book sawaal (16_pdf_to_perbook.py se bani)",
           "# '## <book_id>' ke neeche us granth ke sawaal.",
           "# Sahi jawab = us granth ka Aadhaar aana. Kisi AUR granth ka Aadhaar = FAIL.", ""]
    for k in sorted(sab):
        buf.append(f"## {k}")
        buf.extend(sab[k])
        buf.append("")
    out_path.write_text("\n".join(buf), encoding="utf-8")
    print(f"  → {out_path}")


if __name__ == "__main__":
    main()
