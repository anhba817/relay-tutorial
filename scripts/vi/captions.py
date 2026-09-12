#!/usr/bin/env python3
"""Translate the display strings inside JSX props, which §2.2 of the skill asks for
and the prose splitter deliberately protects.

WHY SEPARATE. `split.py` treats any line that is only a JSX tag as untouchable,
which is right for `code={...}`, `src=`, `className=` — and wrong for `caption=`,
the one prop on this repo's components that a reader actually reads. Handling it
inside the splitter would mean the translator sees JSX; handling it here means the
tag is rebuilt from the English with one string swapped.

Usage: captions.py list <page.mdx>
       captions.py apply <vi-page.mdx> <map.json>
"""
import json, pathlib, re, sys

CAP = re.compile(r'(caption=")([^"]*)(")')


def main(argv):
    if argv[0] == "list":
        for i, l in enumerate(pathlib.Path(argv[1]).read_text(encoding="utf-8").split("\n")):
            m = CAP.search(l)
            if m:
                print(f"{i}\t{m.group(2)}")
        return 0
    src = pathlib.Path(argv[1])
    M = json.loads(pathlib.Path(argv[2]).read_text(encoding="utf-8"))
    lines, n = src.read_text(encoding="utf-8").split("\n"), 0
    for i, l in enumerate(lines):
        m = CAP.search(l)
        if m and m.group(2) in M:
            lines[i] = l[:m.start(2)] + M[m.group(2)] + l[m.end(2):]
            n += 1
    src.write_text("\n".join(lines), encoding="utf-8")
    print(f"  {n} caption(s) translated in {src.parent.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
