import type { ReactNode } from "react";

import { ReadingLayout } from "@/components/reading/reading-layout";

// Giống Phần 2, mọi chương Phần 3 dùng chung reading shell: sidebar series,
// article measure và rail "trong trang này". Không có layout này, MDX của Phần 3
// chỉ render như một trang trần.
export default function PartThreeLayoutVi({ children }: { children: ReactNode }) {
  return (
    <ReadingLayout locale="vi">
      <div className="py-12">
        <article className="prose chapter-measure mx-auto">{children}</article>
      </div>
    </ReadingLayout>
  );
}
