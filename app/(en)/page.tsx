import type { Metadata } from "next";
import { Landing } from "@/components/landing";
import { dictionaries } from "@/lib/i18n";
import { baseOpenGraph, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Building Relay — the tutorial series",
  description: dictionaries.en.landing.pitch,
  alternates: {
    canonical: "/",
    languages: { en: "/", vi: "/vi" },
  },
  openGraph: {
    ...baseOpenGraph("en"),
    title: "Building Relay — the tutorial series",
    description: dictionaries.en.landing.pitch,
    url: "/",
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd("en")),
        }}
      />
      <Landing locale="en" />
    </>
  );
}
