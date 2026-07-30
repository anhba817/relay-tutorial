import type { Metadata } from "next";

import { localePath, type Locale } from "@/lib/i18n";
import {
  chapterReaderProduces,
  chapterTitle,
  seriesTitle,
  type Chapter,
} from "@/lib/tutorial";

// Every absolute URL the SEO surfaces emit flows through siteUrl() — the same
// source metadataBase uses. No hardcoded domain anywhere (FR-008).
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function ogLocale(locale: Locale): string {
  return locale === "vi" ? "vi_VN" : "en_US";
}

// The one series preview image, served by app/(en)/og/route.tsx (URL /og —
// route groups don't affect paths) and absolutized by metadataBase.
export const ogImages = [
  {
    url: "/og",
    width: 1200,
    height: 630,
    alt: "Building Relay — a chat infrastructure tutorial series",
  },
];

// Shared metadata fields for both root layouts. Pages that define their own
// `openGraph` replace the layout's object wholesale, so they must re-include
// siteName and the image (use `baseOpenGraph`).
export const sharedMetadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: seriesTitle, images: ogImages },
  twitter: { card: "summary_large_image" },
};

export function baseOpenGraph(locale: Locale) {
  return { siteName: seriesTitle, locale: ogLocale(locale), images: ogImages };
}

// Chapter preview/structured-data values the metadata API cannot know come
// from the series manifest via the shell; og:title and twitter:title come from
// each page's own title through the metadata API's fallback (verified — the
// layout-level openGraph object triggers it).
export function chapterUrl(chapter: Chapter, locale: Locale): string {
  return `${siteUrl()}${localePath(locale, chapter.path)}`;
}

export function chapterArticleJsonLd(chapter: Chapter, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: chapterTitle(chapter, locale),
    description: chapterReaderProduces(chapter, locale),
    inLanguage: locale,
    url: chapterUrl(chapter, locale),
    position: chapter.id,
    isPartOf: {
      "@type": "WebSite",
      name: seriesTitle,
      url: siteUrl(),
    },
  };
}

export function websiteJsonLd(locale: Locale) {
  const en = `${siteUrl()}/`;
  const vi = `${siteUrl()}/vi`;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seriesTitle,
    url: locale === "vi" ? vi : en,
    inLanguage: locale,
    sameAs: [locale === "vi" ? en : vi],
  };
}
