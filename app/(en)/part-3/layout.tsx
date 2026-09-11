import type { ReactNode } from "react";

import { ReadingLayout } from "@/components/reading/reading-layout";

// Part 3 uses the same reading shell as the earlier parts: the series sidebar,
// chapter article measure, and on-this-page rail are all supplied by
// `ReadingLayout`. Without this boundary, its chapters render as bare MDX pages.
export default function PartThreeLayout({ children }: { children: ReactNode }) {
  return (
    <ReadingLayout locale="en">
      <div className="py-12">
        <article className="prose chapter-measure mx-auto">{children}</article>
      </div>
    </ReadingLayout>
  );
}
