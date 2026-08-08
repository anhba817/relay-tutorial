import type { ReactNode } from "react";

import { ReadingLayout } from "@/components/reading/reading-layout";

// Every Part 3 chapter renders inside the shared reading shell (series
// sidebar + article + on-this-page rail, feature 012) with the same long-form
// prose container. The .prose palette is mapped to Violet Bloom tokens in
// globals.css, so light and dark mode need no per-chapter styling work.
export default function PartThreeLayout({ children }: { children: ReactNode }) {
  return (
    <ReadingLayout locale="en">
      <div className="py-12">
        <article className="prose mx-auto">{children}</article>
      </div>
    </ReadingLayout>
  );
}
