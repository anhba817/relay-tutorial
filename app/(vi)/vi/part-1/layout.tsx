import type { ReactNode } from "react";

import { ReadingLayout } from "@/components/reading/reading-layout";

// Mirror of the English part-0 layout: every Part 0 chapter renders inside
// the shared reading shell (feature 012) with the same prose container.
export default function PartZeroLayoutVi({ children }: { children: ReactNode }) {
  return (
    <ReadingLayout locale="vi">
      <div className="py-12">
        <article className="prose mx-auto">{children}</article>
      </div>
    </ReadingLayout>
  );
}
