import { isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "@/components/docs/mermaid-diagram";
import { CodeBlock } from "@/components/tutorial/code-block";

// Renders a mirrored source document (raw markdown string) with full GFM
// fidelity. The documents are MDX-hostile (JSX-like sequences in prose), so
// they are rendered from raw strings on purpose — never converted to MDX.
// All raw HTML in the docs sits inside mermaid fences, so no raw-HTML plugin.

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

const components: Components = {
  // Top-level sections carry stable anchors for the Contents outline and for
  // chapter citations like "SAD §9".
  h2({ children, ...props }) {
    return (
      <h2 id={slugifyHeading(textOf(children))} {...props}>
        {children}
      </h2>
    );
  },
  // Wide requirement tables scroll inside their own container; the page never
  // overflows horizontally (contract C3).
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto">
        <table {...props}>{children}</table>
      </div>
    );
  },
  // Mermaid fences become theme-aware diagrams; other fences stay code blocks.
  pre({ children, ...props }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (isValidElement(child)) {
      const { className, children: code } = child.props as {
        className?: string;
        children?: ReactNode;
      };
      if (className?.includes("language-mermaid")) {
        return <MermaidDiagram code={textOf(code).trim()} />;
      }
    }
    // Non-diagram fences get the copy-button chrome, same as chapters.
    return <CodeBlock {...props}>{children}</CodeBlock>;
  },
};

export function DocArticle({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}
