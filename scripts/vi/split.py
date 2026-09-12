#!/usr/bin/env python3
"""Split an English chapter page into translatable prose and untouchable fences.

WHY MECHANICAL. `check-fence-parity` compares every fence body between the two
locales and `check-fence-chain` replays them onto the platform; a single edited
comment inside a fence fails the build. Translating in one pass over the file is
how that happens by accident, so the fence text never passes through the
translator at all: this emits only the prose, and `weave.py` puts the English
fences back verbatim.

WHAT COUNTS AS UNTOUCHABLE, and each of these has bitten a page in this repo:
  - anything between ``` delimiters, including the delimiter lines
  - `import` / `export` lines (the metadata block is JSX, not prose)
  - lines that are only a JSX tag
  - the `canonical:` / `en:` / `vi:` URL trio

Usage: split.py <en-page.mdx> <out.json>
"""
import json, pathlib, re, sys

TAG = re.compile(r"^\s*</?[A-Z][A-Za-z]*[^>]*/?>\s*$")
URL = re.compile(r'^\s*(canonical|en|vi):\s*"')
STRUCT = re.compile(r"^[\s{}\[\](),;:]*$")


def split(text: str):
    """-> (segments, prose_index_map). A segment is (kind, text)."""
    segs, inF = [], False
    for line in text.split("\n"):
        if line.startswith("```"):
            inF = not inF
            segs.append(("fence", line))
            continue
        if inF:
            segs.append(("fence", line))
            continue
        s = line.strip()
        # A line made only of structure — braces, brackets, commas — is syntax, not
        # prose. The first version listed three exact spellings and `},` was not one
        # of them, so two metadata closers arrived in the translator's input.
        if (not s or s.startswith("import ") or s.startswith("export ")
                or TAG.match(line) or URL.match(line) or STRUCT.match(s)
                or s.startswith("title:") or s.startswith("alternates")
                or s.startswith("languages") or s.startswith("description:")):
            segs.append(("keep", line))
            continue
        segs.append(("prose", line))
    return segs


def main(src: str, out: str) -> int:
    text = pathlib.Path(src).read_text(encoding="utf-8")
    segs = split(text)
    prose = [(i, t) for i, (k, t) in enumerate(segs) if k == "prose"]
    pathlib.Path(out).write_text(json.dumps(
        {"source": src, "segments": [[k, t] for k, t in segs],
         "prose": [{"i": i, "en": t} for i, t in prose]},
        ensure_ascii=False, indent=1), encoding="utf-8")
    chars = sum(len(t) for _, t in prose)
    print(f"  {src.split('/')[-2]}: {len(segs)} lines, {len(prose)} prose lines, {chars} prose chars")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
