# Translating a chapter into Vietnamese

These four scripts exist for one reason: **`pnpm check:fences` compares every
Vietnamese fence body byte-for-byte against the English fence carrying the same
title.** Part 3 alone is 700+ fences across 26 pages. Translating an MDX file in
one pass means holding code and prose in the same buffer, and that is how a
comment inside a fence gets edited by accident.

So the fence text never reaches the translator. `split.py` withholds it and
`weave.py` puts the English back verbatim, which makes parity a property of the
process rather than something somebody has to inspect afterwards.

## The order

    split.py    <en-page.mdx> <split.json>      # prose out, everything else withheld
    #           translate the prose lines into <trans.json>: {"<index>": "line", ...}
    weave.py    <split.json> <trans.json> <out-vi.mdx>
    captions.py apply <vi-page.mdx> <captions.json>   # {"<english caption>": "<vietnamese>"}
    title.py    <vi-page.mdx> "<titleVi>"

`captions.py list <page.mdx>` prints the captions to translate. `caption=` is the
one JSX prop a reader actually reads, so `split.py` protects it as a tag and this
rebuilds the tag from English with one string swapped.

`title.py` takes `titleVi` **out of `lib/tutorial.ts`** rather than re-translating
the English title, so a chapter cannot end up with two different Vietnamese names.

## Verifying

`weave.py` exits 1 and prints `(N LEFT IN ENGLISH)` if any prose line has no
translation — a partial run is visible rather than silently half-done. Then:

- en and vi line counts equal, and every fence byte-identical
- `pnpm check:figures` — a page rebuilt from English restores `<Figure>` names a
  hand-edited page can quietly lose
- `pnpm check:fences` — the number must not move; it carries a known backlog, and
  what matters is that a translation does not add to it
- `pnpm build`

## Provenance

Written for feature 045's Part 3 rework and used to rebuild all 26 chapters. They
live here rather than in `specs/045-part-3-rework/` because that is a closed
feature's record and these are not about 045 — Parts 0, 1 and 2 hold 17 more
Vietnamese pages that predate this pipeline.
