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
// The check is a grep with a reason attached. It runs in the same CI job as the
// fence chain.
import { readdirSync, readFileSync, statSync } from "node:fs";
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
let figures = 0;

for (const page of walk(APP).filter((p) => p.endsWith("page.mdx"))) {
  const text = readFileSync(page, "utf8");
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

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`check-figures: ${problems.length} problem(s) in ${figures} figures`);
  process.exit(1);
}
console.log(`check-figures: ${figures} figures, every diagram passed as \`code\``);
