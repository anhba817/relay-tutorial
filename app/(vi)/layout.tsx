import type { Metadata } from "next";

import { RootShell } from "@/components/root-shell";
import { TranslationNotice } from "@/components/translation-notice";
import { sharedMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...sharedMetadata,
  title: "Relay Tutorial",
  description: "Ứng dụng cho loạt bài hướng dẫn Building Relay",
};

export default function VietnameseRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RootShell lang="vi">
      <TranslationNotice />
      {children}
    </RootShell>
  );
}
