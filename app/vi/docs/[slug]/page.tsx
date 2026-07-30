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
    title: `${doc.titleVi} — Building Relay`,
    description: `${doc.titleVi} — tài liệu kỹ thuật gốc của Relay mà loạt bài giảng dạy từ đó, hiển thị trọn vẹn (giữ nguyên tiếng Anh).`,
    alternates: {
      canonical: `/vi/docs/${doc.slug}`,
      languages: {
        en: `/docs/${doc.slug}`,
        vi: `/vi/docs/${doc.slug}`,
      },
    },
  };
}

export default async function ViDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  return <DocReferencePage doc={doc} locale="vi" />;
}
