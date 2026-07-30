import type { Metadata } from "next";

import { RootShell } from "@/components/root-shell";
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
  return <RootShell lang="vi">{children}</RootShell>;
}
