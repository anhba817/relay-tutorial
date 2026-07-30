import { notFound } from "next/navigation";

import { DocReferencePage } from "@/components/docs/doc-page";
import { docs, getDoc } from "@/lib/docs";

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
  return {
    title: `${doc.title} — Building Relay`,
    description: `${doc.title} — one of the canonical Relay engineering documents the tutorial teaches from, rendered in full.`,
    alternates: {
      canonical: `/docs/${doc.slug}`,
      languages: {
        en: `/docs/${doc.slug}`,
        vi: `/vi/docs/${doc.slug}`,
      },
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
