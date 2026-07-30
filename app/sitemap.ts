import type { MetadataRoute } from "next";

import { docs } from "@/lib/docs";
import { siteUrl } from "@/lib/seo";
import { series } from "@/lib/tutorial";

// Every indexable page, derived from the series manifest and the doc registry —
// publishing a chapter updates this with zero manual edits (FR-001/SC-001).
// Nothing unpublished, no parts without chapters, never the 404 surface.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pair = (enPath: string, viPath: string) => ({
    languages: { en: `${base}${enPath}`, vi: `${base}${viPath}` },
  });

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, alternates: pair("/", "/vi") },
    { url: `${base}/vi`, alternates: pair("/", "/vi") },
  ];

  for (const part of series) {
    for (const chapter of part.chapters) {
      if (chapter.status !== "published") continue;
      const alternates = pair(chapter.path, `/vi${chapter.path}`);
      entries.push({ url: `${base}${chapter.path}`, alternates });
      if (chapter.translatedIn?.includes("vi")) {
        entries.push({ url: `${base}/vi${chapter.path}`, alternates });
      }
    }
  }

  for (const doc of docs) {
    const alternates = pair(`/docs/${doc.slug}`, `/vi/docs/${doc.slug}`);
    entries.push({ url: `${base}/docs/${doc.slug}`, alternates });
    entries.push({ url: `${base}/vi/docs/${doc.slug}`, alternates });
  }

  return entries;
}
