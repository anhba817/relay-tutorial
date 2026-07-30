import type { Metadata } from "next";
import { Landing } from "@/components/landing";
import { dictionaries } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Building Relay — loạt bài hướng dẫn",
  description: dictionaries.vi.landing.pitch,
  alternates: {
    canonical: "/vi",
    languages: { en: "/", vi: "/vi" },
  },
};

export default function VietnameseHome() {
  return <Landing locale="vi" />;
}
