#!/usr/bin/env python3
"""
SAARTHI — Amrit MP3 Generator (Audio Quality Gate ka ilaaj)
============================================================
Browser TTS browser ka gulaam hai (Edge toota, Chrome robotic, phone alag).
Yeh script Microsoft ki NATURAL Hindi awaaz (edge-tts, bilkul FREE) se
har amrit-paath ka MP3 bana kar hamesha ke liye save kar deti hai.

Fayda: har browser, har phone, Edge samet — ek jaisi sundar awaaz,
perfect play/pause/seek. App pehle MP3 dhundhegi, na mile toh browser TTS.

SETUP (ek baar):
  pip install edge-tts

USAGE:
  python scripts\06_amrit_audio.py              # saare Hindi paath (~91)
  python scripts\06_amrit_audio.py --test       # sirf 2 (awaaz check karo)
  python scripts\06_amrit_audio.py --voice hi-IN-MadhurNeural   # male awaaz

Resumable: bane hue MP3 skip hote hain — dobara chalana safe hai.
Output: public/audio/amrit/<book>_<idx>.mp3 + manifest.json
"""

import argparse, asyncio, json, re, sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    raise SystemExit("edge-tts install nahi hai. Chalao:  pip install edge-tts")

ROOT      = Path(__file__).resolve().parent.parent
AMRIT     = ROOT / "public" / "knowledge" / "amrit.json"
OUT_DIR   = ROOT / "public" / "audio" / "amrit"
MANIFEST  = OUT_DIR / "manifest.json"

# hi-IN-SwaraNeural  = female, sabse natural Hindi
# hi-IN-MadhurNeural = male, gambheer
# FINAL (2026-07-24): Saurabh ne 4 options sunkar "Swara — dheemi aur naram"
# chuna — is default se ab poori 168 files generate hongi.
DEFAULT_VOICE = "hi-IN-SwaraNeural"
RATE          = "-12%"   # dheemi — aadhyatmik paath ke liye sahi thehraav
PITCH         = "-1Hz"


def clean_for_tts(text: str) -> str:
    """Markdown/symbols hatao — TTS inko bolne ki koshish karta hai."""
    t = re.sub(r"[*#`_>\[\]|~]", "", text or "")
    t = re.sub(r"\s+", " ", t).strip()
    return t


async def make_one(text: str, voice: str, path: Path, rate=None, pitch=None) -> bool:
    try:
        c = edge_tts.Communicate(text, voice=voice, rate=rate or RATE, pitch=pitch or PITCH)
        await c.save(str(path))
        return path.exists() and path.stat().st_size > 1000
    except Exception as e:
        print(f"      ❌ {type(e).__name__}: {str(e)[:100]}")
        # Aadhi-adhuri file mat chhodo
        try:
            if path.exists():
                path.unlink()
        except Exception:
            pass
        return False


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--rate",  default=None, help='jaise "-14%%" (dheemi=mellow) ya "-5%%"')
    ap.add_argument("--pitch", default=None, help='jaise "-6Hz" (bhaari=rounded) ya "+2Hz"')
    ap.add_argument("--test", action="store_true", help="sirf 2 paath (awaaz pasand karne ke liye)")
    ap.add_argument("--force", action="store_true", help="bane hue bhi dobara banao")
    args = ap.parse_args()

    if not AMRIT.exists():
        raise SystemExit("amrit.json nahi mila — pehle 04_amrit_generate.py chalao")

    data    = json.loads(AMRIT.read_text(encoding="utf-8"))
    lessons = data["lessons"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {}
    if MANIFEST.exists() and not args.force:
        try:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}

    total = sum(len(v) for v in lessons.values())
    print("=" * 60)
    print(f"  SAARTHI — Amrit MP3 Generator")
    print(f"  Awaaz: {args.voice}  |  Paath: {total}")
    print("=" * 60)

    done = skipped = failed = 0
    for bid, items in lessons.items():
        for idx, lesson in enumerate(items):
            key  = f"{bid}_{idx}"
            path = OUT_DIR / f"{key}.mp3"

            if not args.force and path.exists() and manifest.get(key):
                skipped += 1
                continue

            text = ". ".join(filter(None, [
                clean_for_tts(lesson.get("title_hi", "")),
                clean_for_tts(lesson.get("body_hi", "")),
                clean_for_tts(lesson.get("conclusion_hi", "")),
            ]))
            if len(text) < 30:
                continue

            ok = await make_one(text, args.voice, path, args.rate, args.pitch)
            if ok:
                manifest[key] = True
                done += 1
                kb = path.stat().st_size // 1024
                print(f"  ✅ {key}.mp3  ({kb} KB)")
                # Har file ke baad manifest save — beech mein ruko toh bhi surakshit
                MANIFEST.write_text(json.dumps(manifest, indent=1), encoding="utf-8")
            else:
                failed += 1

            if args.test and done >= 2:
                print("\n  🎧 TEST MODE: 2 MP3 ban gaye — public/audio/amrit/ mein")
                print("  Bajao, awaaz pasand aaye toh bina --test ke poora chalao.")
                print("  Male awaaz chahiye toh: --voice hi-IN-MadhurNeural")
                return

    print("\n" + "=" * 60)
    print(f"  ✅ Bane: {done}  |  ⏭️ Pehle se the: {skipped}  |  ❌ Fail: {failed}")
    total_mb = sum(f.stat().st_size for f in OUT_DIR.glob("*.mp3")) / 1e6
    print(f"  📦 Kul size: {total_mb:.1f} MB  →  {OUT_DIR}")
    print("  Agla kadam: npm run build → Netlify Deploys par dist drop")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
