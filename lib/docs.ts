import { series, type Chapter } from "@/lib/tutorial";

// Registry of the six chapter-source documents rendered as reference pages.
// `sourceDoc` must match the series manifest's values verbatim — it is the join
// key between chapters and documents. The mirrored files in content/docs/ are
// machine-written by scripts/sync-docs.sh, never edited by hand.

export interface DocEntry {
  /** Route segment under /docs and /vi/docs. */
  slug: string;
  /** The manifest's sourceDoc path this entry answers for (verbatim). */
  sourceDoc: string;
  /** Mirrored file name under content/docs/. */
  file: string;
  title: string;
  titleVi: string;
  /** List the chapters that cite this document, under the title. Defaults to true;
   * set false where the list has stopped being an answer.
   *
   * OFF FOR THE SRS AND THE SAD, AND THE COUNTS ARE THE WHOLE ARGUMENT: **27 chapters
   * cite the SRS and 25 cite the SAD**, against 3, 2, 1, 1 and 1 for the other five.
   * A list naming almost every chapter in the series answers "which chapters?" with
   * "all of them" — a paragraph of links confirming what the reader already assumed,
   * directly under the title of the document they came to read. The five short lists
   * are unaffected and still earn their place.
   *
   * A THRESHOLD WAS THE OTHER OPTION and is deliberately not taken. `citing.length > N`
   * reads as principled and would flip a page's behaviour the first time somebody
   * published a chapter, with no line in any diff saying so. This is one field in the
   * registry, beside the document it describes. */
  referencedBy?: boolean;
}

export const docs: DocEntry[] = [
  {
    slug: "product-vision",
    sourceDoc: "docs/01-product-vision.md",
    file: "01-product-vision.md",
    title: "Product vision",
    titleVi: "Tầm nhìn sản phẩm",
  },
  {
    slug: "personas",
    sourceDoc: "docs/02-personas.md",
    file: "02-personas.md",
    title: "Personas",
    titleVi: "Chân dung người dùng",
  },
  {
    slug: "journey-map",
    sourceDoc: "docs/03-journey-map.md",
    file: "03-journey-map.md",
    title: "Journey map",
    titleVi: "Bản đồ hành trình",
  },
  {
    slug: "srs",
    sourceDoc: "docs/04-srs.md",
    file: "04-srs.md",
    title: "SRS — Software Requirements Specification",
    titleVi: "SRS — Đặc tả yêu cầu phần mềm",
    referencedBy: false,  // 27 and 25 citing chapters — see the interface
  },
  {
    slug: "sad",
    sourceDoc: "docs/05-sad.md",
    file: "05-sad.md",
    title: "SAD — Software Architecture Document",
    titleVi: "SAD — Tài liệu kiến trúc phần mềm",
    referencedBy: false,  // 27 and 25 citing chapters — see the interface
  },
  {
    slug: "adr-deep-dives",
    sourceDoc: "docs/06-adr-deep-dives.md",
    file: "06-adr-deep-dives.md",
    title: "ADR deep dives",
    titleVi: "ADR — phân tích chuyên sâu",
  },
  // The seventh, and the first one the PLATFORM links to rather than the series
  // (chapter 3.12). Every error response's `docs_url` points at
  // `/docs/error-reference#<code>`, so this page's URL and its anchors are part of
  // the wire contract now — renaming the slug breaks links already in the field.
  {
    slug: "error-reference",
    sourceDoc: "docs/08-error-reference.md",
    file: "08-error-reference.md",
    title: "Error reference",
    titleVi: "Tham chiếu mã lỗi",
  },
];

export function getDoc(slug: string): DocEntry | null {
  return docs.find((d) => d.slug === slug) ?? null;
}

/**
 * Resolve a manifest `sourceDoc` field (possibly comma-separated) to registry
 * entries. Unresolved segments come back as plain-text labels so callers can
 * render them without a link — never a dead link.
 */
export function docsForSourceDoc(
  sourceDocField: string,
): Array<{ doc: DocEntry | null; label: string }> {
  return sourceDocField
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({
      doc: docs.find((d) => d.sourceDoc === label) ?? null,
      label,
    }));
}

/** Published chapters whose manifest sourceDoc cites this document. */
export function chaptersCiting(slug: string): Chapter[] {
  const entry = getDoc(slug);
  if (!entry) return [];
  return series
    .flatMap((part) => part.chapters)
    .filter(
      (chapter) =>
        chapter.status === "published" &&
        chapter.sourceDoc
          .split(",")
          .map((s) => s.trim())
          .includes(entry.sourceDoc),
    );
}
