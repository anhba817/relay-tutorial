import type { Metadata } from "next";

import { RootShell } from "@/components/root-shell";
import { sharedMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...sharedMetadata,
  title: "Relay Tutorial",
  description: "Application for the Building Relay tutorial series",
};

export default function EnglishRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootShell lang="en">{children}</RootShell>;
}
