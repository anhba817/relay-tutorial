// Every <Figure> in every chapter must pass its diagram as `code`.
//
// WHY THIS EXISTS. `Figure` takes `caption` and `code`. MDX props are not
// type-checked by `tsc`, so a figure written `chart={figThing}` compiles, builds,
// renders its caption, and renders NO DIAGRAM — the component receives
// `code: undefined` and says nothing. Chapters 3.11 through 3.14 shipped that way:
// fifteen figures in four published chapters, mirrored into fifteen more in
// Vietnamese, all of them a caption under an empty space.
//
// It was found while translating chapter 3.15 — the English page used `src=`, a
// third spelling, and comparing the two locales' props is what raised the
// question. Nothing else would have: the build is green either way, and the only
// instrument that reads these pages closely is `check-fence-chain.mjs`, which
// reads fences and ignores JSX.
//
// AND IT CHECKED THE PROP NAME WITHOUT CHECKING THAT THE NAME RESOLVES, which is
// one step outside the fault it was built for and cost the site its build for the
// whole of Part 3's rebuild. `vi-placeholder.py` deleted a chapter's `figures.ts`
// when the placeholder it wrote imported none; the page was later translated with
// its imports restored, and ten Vietnamese pages then imported a file that did not
// exist. `next build` fails on the first one and names no other, so ten faults cost
// ten builds to find. This checker reads every page in a second and finds all ten.
//
// A missing binding is fatal here. An UNUSED export is reported and is not: nothing
// renders it, the bundler drops it, and the three that exist are translated prose
// somebody may still want. Report it rather than ratchet it.
//
// The check is a grep with a reason attached. It runs in the same CI job as the
// fence chain.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = join(ROOT, "app");

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const problems = [];
const unused = [];
let figures = 0;
let bindings = 0;

for (const page of walk(APP).filter((p) => p.endsWith("page.mdx"))) {
  const text = readFileSync(page, "utf8");
  // DOES THE BINDING RESOLVE. Both directions, because a one-directional list can
  // only grow: a page naming a figure the sibling never exported fails the build,
  // and an export no page names is dead weight nobody is told about.
  const imported = new Set(
    [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/figures"/g)].flatMap((m) =>
      m[1].split(",").map((x) => x.trim()).filter(Boolean),
    ),
  );
  const referenced = new Set([...text.matchAll(/\{(fig[A-Za-z0-9]+)\}/g)].map((m) => m[1]));
  const figFile = join(dirname(page), "figures.ts");
  const rel = relative(ROOT, page);
  bindings += imported.size;
  if (imported.size && !existsSync(figFile)) {
    problems.push(
      `${rel} — imports ${[...imported].join(", ")} from ./figures, and ` +
        `figures.ts does not exist; \`next build\` cannot compile this page`,
    );
  } else if (existsSync(figFile)) {
    const exported = new Set(
      [...readFileSync(figFile, "utf8").matchAll(/^export const (fig[A-Za-z0-9]+)/gm)].map(
        (m) => m[1],
      ),
    );
    for (const n of [...imported].filter((n) => !exported.has(n)).sort()) {
      problems.push(`${rel} — imports \`${n}\`, which figures.ts does not export`);
    }
    for (const n of [...exported].filter((n) => !referenced.has(n)).sort()) {
      unused.push(`${rel} — figures.ts exports \`${n}\`, no <Figure> names it`);
    }
  }
  for (const n of [...referenced].filter((n) => !imported.has(n)).sort()) {
    problems.push(`${rel} — names \`${n}\` and imports no such binding`);
  }
  // A figure is written on one line in the later chapters and across three in the
  // earlier ones, so the element is matched rather than the line. Scanning line by
  // line was this checker's own first bug: it reported 122 problems in 193 figures,
  // every one of them a multi-line form whose prop was on the next line.
  for (const m of text.matchAll(/<Figure\b[\s\S]*?\/>/g)) {
    figures++;
    const el = m[0];
    const line = text.slice(0, m.index).split("\n").length;
    const prop = /\s([a-zA-Z]+)=\{fig/.exec(el);
    if (!prop) {
      problems.push(
        `${relative(ROOT, page)}:${line} — <Figure> passes no fig* binding at all`,
      );
    } else if (prop[1] !== "code") {
      problems.push(
        `${relative(ROOT, page)}:${line} — diagram passed as \`${prop[1]}\`, which ` +
          `Figure ignores; it reads \`code\``,
      );
    }
  }
}

for (const u of unused) console.log(`note: ${u}`);

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`check-figures: ${problems.length} problem(s) in ${figures} figures`);
  process.exit(1);
}
console.log(
  `check-figures: ${figures} figures, every diagram passed as \`code\`; ` +
    `${bindings} imported bindings all resolve, ${unused.length} export(s) unused`,
);
