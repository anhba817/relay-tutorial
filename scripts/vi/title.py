#!/usr/bin/env python3
"""Set a Vietnamese page's metadata title from the registry's own `titleVi`.

The title is what a browser tab and a search result show, and `split.py` protects
`title:` as JSX. The value must not be invented here: `lib/tutorial.ts` already
carries the Vietnamese title a person chose, so this copies it rather than
translating the English again and producing a second, different name for one
chapter.

Usage: title.py <vi-page.mdx> "<titleVi>"
"""
import pathlib, re, sys

p = pathlib.Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
m = re.search(r'^(\s*title:\s*")([^"]*)(",)$', t, re.M)
if not m:
    print(f"  no metadata title in {p.parent.name}"); raise SystemExit(1)
suffix = " — Building Relay" if m.group(2).endswith(" — Building Relay") else ""
new = m.group(1) + sys.argv[2] + suffix + m.group(3)
p.write_text(t[:m.start()] + new + t[m.end():], encoding="utf-8")
print(f"  {p.parent.name}: title -> {sys.argv[2]}{suffix}")
