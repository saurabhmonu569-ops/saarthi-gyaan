#!/usr/bin/env python3
"""
SAARTHI — "Aaj Ka Amrit" Generator
===================================
Har granth ke ASLI chunks se chhote amrit-paath banata hai (Hindi + English),
Groq API se — EK BAAR chalao, hamesha ke liye public/knowledge/amrit.json
mein store. App roz inhe rotate karke dikhayegi (zero runtime cost).

USAGE:
  python scripts\\04_amrit_generate.py            # sab 13 books, 7 paath har ek
  python scripts\\04_amrit_generate.py --test     # 1 book, 2 paath (quality check)
  python scripts\\04_amrit_generate.py --books valmiki_ramayana

Resumable: dobara chalane par jo books poori hain unhe skip karta hai.
Key: .env se VITE_GEMINI_API_KEY (gsk_...) khud padh leta hai.
"""

import argparse, json, re, time, urllib.request, urllib.error
from pathlib import Path

ROOT      = Path(__file__).resolve().parent.parent
KNOW_PATH = ROOT / "public" / "knowledge" / "knowledge.json"
OUT_PATH  = ROOT / "public" / "knowledge" / "amrit.json"
ENV_PATH  = ROOT / ".env"

LESSONS_PER_BOOK = 7
MODEL            = "llama-3.3-70b-versatile"
SLEEP_BETWEEN    = 25     # seconds — Groq free-tier TPM ka samman (6 se badhaya: 429 kam aayenge)


def read_key():
    """AMRIT_GROQ_KEY (scripts ki alag key) pehle; nahi mili toh VITE_GEMINI_API_KEY.
    Alag key rakhne se script chalane par app ka chat quota nahi khatam hota."""
    if not ENV_PATH.exists():
        raise SystemExit(".env nahi mila — usme AMRIT_GROQ_KEY=gsk_... ya VITE_GEMINI_API_KEY=gsk_... hona chahiye")
    env = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    for name in ("AMRIT_GROQ_KEY", "VITE_GEMINI_API_KEY"):
        key = env.get(name, "")
        if key.startswith("gsk_"):
            tag = "alag scripts-key" if name == "AMRIT_GROQ_KEY" else "app wali key (chat se share hogi!)"
            print(f"   🔑 {name} use ho rahi — {tag}")
            return key
    raise SystemExit("gsk_ key .env mein nahi mili (Groq key chahiye is script ke liye)")


def groq(key, prompt):
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.6,
        "max_tokens": 900,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {key}",
            # Cloudflare (Groq ka guard) bina User-Agent wali requests ko
            # 403/1010 se rokta hai — browser-jaisa parichay dena zaroori hai.
            "User-Agent":    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SAARTHI-Amrit/1.0",
            "Accept":        "application/json",
        },
    )
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.loads(r.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8")[:300]
            except Exception:
                pass
            if e.code == 429:
                # Groq batata hai kitna rukna hai — retry-after header padho
                ra = 0
                try:
                    ra = int(float(e.headers.get("retry-after") or 0))
                except Exception:
                    ra = 0
                if ra > 900:
                    # 15 min se zyada = daily token limit khatam — rukne ka fayda nahi
                    raise SystemExit(f"      ⛔ Groq ka DAILY limit khatam ({ra//60} min baad reset). "
                                     f"Baad mein wahi command dobara chalao — jo bana hai woh saved hai.")
                wait = (ra + 3) if ra > 0 else min(30 * (attempt + 1), 240)
                print(f"      rate-limit — {wait}s ruk rahe... (koshish {attempt+1}/8)")
                time.sleep(wait)
                continue
            print(f"      ❌ HTTP {e.code}: {detail}")
            raise
    raise RuntimeError("Groq 429 after retries")


def parse_json(text):
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start:end + 1])


def pick_chunks(chunks, n):
    """Poore granth se evenly-spaced, achhi quality ke chunks."""
    good = [c for c in chunks if len(c.get("text", "")) > 450]
    if len(good) < n:
        good = sorted(chunks, key=lambda c: -len(c.get("text", "")))[: n * 2] or chunks
    step = max(len(good) // n, 1)
    return [good[i * step] for i in range(min(n, len(good)))]


PROMPT = """Tum SAARTHI ho — ek shaant aatmik guru. Neeche "{title}" granth ka ek asli ansh hai (OCR se, chhoti galtiyan ho sakti hain — bhaav pakdo).

Is ansh se EK chhota "Aaj Ka Amrit" paath banao. SIRF yeh JSON do, aur kuch nahi:
{{
  "title_hi": "paath ka chhota sundar Hindi naam (5-8 shabd) — KEVAL Devanagari lipi mein, Roman aksharon mein Hindi likhna SAKHT MANA",
  "title_en": "same title in English",
  "body_hi": "150-200 shabdon ka saral, sundar Hindi paath — POORA Devanagari lipi mein (Roman/Hinglish ek shabd bhi nahi) — is ansh ki seekh, ek chhoti vyakhya, aur ant mein aaj ke jeevan ke liye ek vichar. Shuddh saral Hindi, koi kathin shabd bina matlab ke nahi.",
  "body_en": "the same lesson in 120-160 words of warm, simple English",
  "conclusion_hi": "1 line ka nishkarsh Hindi mein",
  "conclusion_en": "1 line conclusion in English"
}}

Niyam: koi naya shloka mat gadho; jo ansh mein hai usi ke bhaav par raho; JSON ke bahar ek shabd nahi.

--- GRANTH ANSH ({title}, p.{page}) ---
{text}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--books", nargs="*")
    ap.add_argument("--test", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--fix-hinglish", action="store_true",
                    help="Sirf un paathon ko dobara banao jinki Hindi Roman mein nikli thi")
    args = ap.parse_args()

    key = read_key()
    print("Key mili ✅  | knowledge.json load ho raha (52 MB, thoda sabr)...")
    know = json.loads(KNOW_PATH.read_text(encoding="utf-8"))
    chunks = know.get("chunks", [])
    by_book = {}
    for c in chunks:
        by_book.setdefault(c.get("book"), []).append(c)

    existing = {}
    if OUT_PATH.exists():
        try:
            existing = json.loads(OUT_PATH.read_text(encoding="utf-8")).get("lessons", {})
        except Exception:
            pass

    def _is_hinglish(lesson):
        t = (lesson.get("body_hi", "") + lesson.get("title_hi", ""))
        deva = len(re.findall(r"[\u0900-\u097F]", t))
        return deva < len(t) * 0.4

    if args.fix_hinglish:
        # Kharab (Roman-Hindi) paath dhundo aur sirf unhe dobara banao
        fixed_any = False
        for bid, arr in list(existing.items()):
            bad_idx = [i for i, L in enumerate(arr) if _is_hinglish(L)]
            if not bad_idx:
                continue
            title = arr[0].get("source", bid).split(" (")[0]
            bchunks = by_book.get(bid, [])
            picks = pick_chunks(bchunks, LESSONS_PER_BOOK + 4)
            print(f"\n🔧 {title}: {len(bad_idx)} Hinglish paath dobara ban rahe")
            for j, i in enumerate(bad_idx):
                ch = picks[(i + 3) % len(picks)] if picks else None
                if ch is None:
                    continue
                try:
                    raw = groq(key, PROMPT.format(title=title, page=ch.get("page", "?"),
                                                  text=ch.get("text", "")[:2600]))
                    lesson = parse_json(raw)
                    lesson["source"] = f"{title} (p.{ch.get('page', '?')})"
                    lesson["book"] = bid
                    if not _is_hinglish(lesson):
                        arr[i] = lesson
                        fixed_any = True
                        print(f"   ✅ {lesson.get('title_hi', '')[:40]}")
                    else:
                        print("   ⚠️ phir Hinglish nikla — skip")
                except Exception as e:
                    print(f"   ⚠️ skip ({type(e).__name__})")
                time.sleep(SLEEP_BETWEEN)
        if fixed_any:
            OUT_PATH.write_text(json.dumps(
                {"generated_on": time.strftime("%Y-%m-%d"), "lessons": existing},
                ensure_ascii=False, indent=1), encoding="utf-8")
        print("\n✅ Hinglish-safai poori.")
        return

    per_book = 2 if args.test else LESSONS_PER_BOOK
    todo = list(by_book.keys())
    if args.books:
        todo = [b for b in todo if b in args.books]
    if args.test:
        todo = todo[:1]

    lessons = dict(existing)
    for bid in todo:
        if not args.force and len(lessons.get(bid, [])) >= per_book:
            print(f"⏭️  {bid}: pehle se {len(lessons[bid])} paath — skip")
            continue
        bchunks = by_book[bid]
        title = bchunks[0].get("book_title") or bid
        # RESUME FIX: adhoori book ke purane paath mat phenko — sirf bache hue banao
        have  = 0 if args.force else len(lessons.get(bid, []))
        picks = pick_chunks(bchunks, per_book)[have:]
        extra = f" (pehle ke {have} saved — sirf bache banenge)" if have else ""
        print(f"\n📖 {title} — {len(picks)} paath ban rahe hain{extra}")
        base = [] if args.force else list(lessons.get(bid, []))
        out = []
        for i, ch in enumerate(picks, 1):
            try:
                raw = groq(key, PROMPT.format(
                    title=title, page=ch.get("page", "?"),
                    text=ch.get("text", "")[:2600]))
                lesson = parse_json(raw)
                lesson["source"] = f"{title} (p.{ch.get('page', '?')})"
                lesson["book"] = bid
                out.append(lesson)
                # TOKEN-BACHAT FIX: HAR paath ke turant baad save — limit beech
                # mein lage toh bhi kuch nahi khota, koi paath dobara nahi banta
                lessons[bid] = base + out
                OUT_PATH.write_text(json.dumps(
                    {"generated_on": time.strftime("%Y-%m-%d"), "lessons": lessons},
                    ensure_ascii=False, indent=1), encoding="utf-8")
                print(f"   {i}/{len(picks)} ✅ {lesson.get('title_hi', '')[:40]}  💾")
            except Exception as e:
                print(f"   {i}/{len(picks)} ⚠️ skip ({type(e).__name__}: {str(e)[:120]})")
            time.sleep(SLEEP_BETWEEN)
        if out:
            print(f"   📗 {bid}: +{len(out)} paath ({sum(len(v) for v in lessons.values())} total)")

    print(f"\n✅ Amrit taiyaar → {OUT_PATH}")
    print("   App reload karo — 'Aaj Ka Amrit' zinda ho jayega. 🕉️")


if __name__ == "__main__":
    main()
