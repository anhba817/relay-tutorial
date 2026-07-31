"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Site-wide strip on every Vietnamese page: the translation is AI-assisted
 * and the author hasn't had time to polish it all yet. Links the current page
 * to its English original — the two locale trees mirror each other, so the
 * mapping is just the /vi prefix. On reading pages (where the select-and-
 * suggest capture is mounted, feature 015) it also invites readers to flag
 * rough passages in place; the landing gets only the plain notice. */
export function TranslationNotice() {
  const pathname = usePathname();
  const enPath = pathname === "/vi" ? "/" : pathname.replace(/^\/vi\//, "/");
  const canSuggest = /^\/vi\/(part-|docs\/)/.test(pathname);

  return (
    <aside
      role="note"
      className="border-b border-accent-foreground/20 bg-accent px-4 py-1.5 text-center text-xs leading-5 text-accent-foreground"
    >
      Bản tiếng Việt được dịch với sự hỗ trợ của AI và tác giả chưa có thời
      gian trau chuốt lại —{" "}
      {canSuggest ? (
        <>
          nếu thấy chỗ nào chưa mượt, hãy bôi đen đoạn đó rồi nhấp chuột phải
          (trên điện thoại: chỉ cần bôi đen) để góp ý cho tác giả, hoặc{" "}
        </>
      ) : (
        <>nếu thấy chỗ nào chưa mượt, mời bạn </>
      )}
      <Link href={enPath} className="font-medium underline underline-offset-2">
        đọc bản gốc tiếng Anh
      </Link>
      .
    </aside>
  );
}
