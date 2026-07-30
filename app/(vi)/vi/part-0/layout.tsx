import type { ReactNode } from "react";

// Mirror of app/part-0/layout.tsx: every Part 0 chapter renders inside the
// same long-form prose container, in either locale.
export default function PartZeroLayoutVi({ children }: { children: ReactNode }) {
  return (
    <div className="px-6 py-12">
      <article className="prose mx-auto">{children}</article>
    </div>
  );
}
