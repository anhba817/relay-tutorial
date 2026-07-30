import type { ReactNode } from "react";

// Everything under /vi is Vietnamese. `lang` is valid on any element, so this
// static wrapper declares the subtree's language without touching the root
// <html lang="en"> (feature 004, research R4).
export default function VietnameseLayout({ children }: { children: ReactNode }) {
  return <div lang="vi">{children}</div>;
}
