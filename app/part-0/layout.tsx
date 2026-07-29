import type { ReactNode } from "react";

// Every Part 0 chapter renders inside the same long-form prose container.
// The .prose palette is mapped to Violet Bloom tokens in globals.css, so
// light and dark mode need no per-chapter (or per-part) styling work.
export default function PartZeroLayout({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-12">
      <article className="prose mx-auto">{children}</article>
    </div>
  );
}
