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
  const title = `${doc.titleVi} — Building Relay`;
  const description = `${doc.titleVi} — tài liệu kỹ thuật gốc của Relay mà loạt bài giảng dạy từ đó, hiển thị trọn vẹn (giữ nguyên tiếng Anh).`;
  return {
    title,
    description,
    alternates: {
      canonical: `/vi/docs/${doc.slug}`,
      languages: {
        en: `/docs/${doc.slug}`,
        vi: `/vi/docs/${doc.slug}`,
      },
    },
    openGraph: {
      ...baseOpenGraph("vi"),
      title,
      description,
      url: `/vi/docs/${doc.slug}`,
      type: "website",
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
