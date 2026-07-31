import { MermaidDiagram } from "@/components/docs/mermaid-diagram";

// A chapter figure: a theme-aware, zoomable diagram with a caption, in the same
// chrome family as the boxes (feature 011). Diagram sources live in each
// chapter's colocated figures.ts — never inline in page.mdx (that invariant
// keeps the canonical word-count formula stable).
export function Figure({
  caption,
  code,
}: {
  caption: string;
  code: string;
}) {
  return (
    <figure className="not-prose my-8">
      <MermaidDiagram code={code} />
      <figcaption className="mt-2 text-center text-sm text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
