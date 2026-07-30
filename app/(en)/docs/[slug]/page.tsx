import { notFound } from "next/navigation";

import { DocReferencePage } from "@/components/docs/doc-page";
import { docs, getDoc } from "@/lib/docs";
import { baseOpenGraph } from "@/lib/seo";

export function generateStaticParams() {
  return docs.map((doc) => ({ slug: doc.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};
  const title = `${doc.title} — Building Relay`;
  const description = `${doc.title} — one of the canonical Relay engineering documents the tutorial teaches from, rendered in full.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/docs/${doc.slug}`,
      languages: {
        en: `/docs/${doc.slug}`,
        vi: `/vi/docs/${doc.slug}`,
      },
    },
    openGraph: {
      ...baseOpenGraph("en"),
      title,
      description,
      url: `/docs/${doc.slug}`,
      type: "website",
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  return <DocReferencePage doc={doc} locale="en" />;
}
