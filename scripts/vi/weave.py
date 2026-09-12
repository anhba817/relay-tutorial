#!/usr/bin/env python3
"""Rebuild a Vietnamese page from the English one plus a table of translations.

Every non-prose line comes from the ENGLISH source, so fences are identical by
construction rather than by inspection. A prose line with no translation is
carried across in English and reported, so a partial run is visible rather than
silently half-done.

Usage: weave.py <split.json> <translations.json> <out-vi.mdx>
       translations.json: {"<segment index>": "Vietnamese line", ...}
"""
import json, pathlib, sys


def main(splitf: str, transf: str, out: str) -> int:
    S = json.loads(pathlib.Path(splitf).read_text(encoding="utf-8"))
    T = json.loads(pathlib.Path(transf).read_text(encoding="utf-8"))
    lines, missing = [], 0
    for i, (kind, text) in enumerate(S["segments"]):
        if kind != "prose":
            lines.append(text)
            continue
        v = T.get(str(i))
        if v is None:
            missing += 1
            lines.append(text)
        else:
            lines.append(v)
    pathlib.Path(out).write_text("\n".join(lines), encoding="utf-8")
    total = sum(1 for k, _ in S["segments"] if k == "prose")
    print(f"  wrote {out.split('/')[-2]}: {total - missing}/{total} prose lines translated"
          + (f"  ({missing} LEFT IN ENGLISH)" if missing else ""))
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
