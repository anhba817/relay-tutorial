// Prose word count for a chapter page (chapter 3.18, T052a).
//
// WHY THIS EXISTS. Chapters 3.15, 3.16 and 3.17 each recorded a prose word count
// and the instrument that produced them is not in this repository. A count with
// no tool is a number nobody can reproduce, and the series has a 2,000–4,000
// bound that only means something if every chapter is measured the same way.
//
// WHAT COUNTS AS PROSE: everything that is not inside a ``` fence, not an
// `import`/`export` line, and not a bare JSX line. JSX tags inside a paragraph
// are stripped and their text kept, because a sentence wrapped in <Trap> is
// still a sentence the reader reads.
import { readFileSync } from "node:fs";

export function proseWords(path) {
  const out = [];
  let inFence = false;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trimStart().startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^\s*(import|export)\b/.test(line)) continue;
    if (/^\s*<\/?[A-Za-z][^>]*\/?>\s*$/.test(line)) continue;
    if (/^\s*[{}\]);,]/.test(line)) continue;
    out.push(line.replace(/<[^>]+>/g, " "));
  }
  return out.join("\n").split(/\s+/).filter((w) => /[A-Za-z0-9À-ỹ]/.test(w)).length;
}

if (process.argv[2]) {
  for (const p of process.argv.slice(2)) {
    console.log(String(proseWords(p)).padStart(6), p.replace(/^app\//, ""));
  }
}
