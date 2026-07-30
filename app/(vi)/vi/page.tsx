import type { Metadata } from "next";
import { Landing } from "@/components/landing";
import { dictionaries } from "@/lib/i18n";
import { baseOpenGraph, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Building Relay — loạt bài hướng dẫn",
  description: dictionaries.vi.landing.pitch,
  alternates: {
    canonical: "/vi",
    languages: { en: "/", vi: "/vi" },
  },
  openGraph: {
    ...baseOpenGraph("vi"),
    title: "Building Relay — loạt bài hướng dẫn",
    description: dictionaries.vi.landing.pitch,
    url: "/vi",
    type: "website",
  },
};

export default function VietnameseHome() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd("vi")),
        }}
      />
      <Landing locale="vi" />
    </>
  );
}
