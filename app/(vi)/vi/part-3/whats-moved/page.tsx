import type { Metadata } from "next";

import { Part3Map } from "@/components/reading/part3-map";

export const metadata: Metadata = {
  title: "Phần 3 — những gì đã thay đổi — Building Relay",
  description:
    "Phần 3 được nhóm lại thành tám chương đoạn và đánh số lại từ 24 chương thành 26. " +
    "Mọi địa chỉ cũ đều được chuyển hướng; trang này cho biết mỗi số cũ giờ mang nghĩa gì.",
  alternates: {
    canonical: "/vi/part-3/whats-moved",
    languages: {
      en: "/part-3/whats-moved",
      vi: "/vi/part-3/whats-moved",
    },
  },
};

// THE TABLE IS NUMBERS AND CHAPTER TITLES, and the titles are the English ones
// because that is what the pages carry. The prose around it is not translated yet —
// same convention as every other Vietnamese page in this part.
export default function WhatsMovedVi() {
  return (
    <>
      <div className="prose prose-neutral max-w-none dark:prose-invert">
        <blockquote>
          <strong>Bản dịch đang được chuẩn bị.</strong> Phần diễn giải của trang này chưa
          được dịch sang tiếng Việt. Bảng đối chiếu số chương bên dưới dùng được ngay.
        </blockquote>
      </div>
      <Part3Map locale="vi" />
    </>
  );
}
