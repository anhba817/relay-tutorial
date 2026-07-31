import { docs } from "@/lib/docs";
import { hasBody, series } from "@/lib/tutorial";

// Validation core for reader suggestions (feature 015). Pure — no I/O, no
// Prisma — so the route handler stays a thin pipeline and every rule lives in
// one place. Caps per research R5; error codes per data-model.

export const SELECTION_MAX = 1000;
export const CONTEXT_MAX = 250;
export const SUGGESTION_MAX = 2000;
export const BODY_MAX = 8192;
export const RATE_PER_MIN = 5;
export const RATE_PER_DAY = 30;

export type SuggestionErrorCode =
  | "invalid_page"
  | "invalid_selection"
  | "invalid_suggestion"
  | "invalid_body"
  | "rate_limited"
  | "storage_unavailable";

export interface SuggestionInput {
  pagePath: string;
  locale: "en" | "vi";
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  suggestion: string;
}

export type ValidationResult =
  | { ok: true; data: SuggestionInput }
  | { ok: true; honeypot: true }
  | { ok: false; code: SuggestionErrorCode };

// Every reading page in both locales, derived from the two existing
// registries — a newly published chapter is suggestible with zero edits here.
function buildAllowlist(): Set<string> {
  const paths = new Set<string>();
  for (const part of series) {
    for (const chapter of part.chapters) {
      if (chapter.status !== "published") continue;
      paths.add(chapter.path);
      if (hasBody(chapter, "vi")) paths.add(`/vi${chapter.path}`);
    }
  }
  for (const doc of docs) {
    paths.add(`/docs/${doc.slug}`);
    paths.add(`/vi/docs/${doc.slug}`);
  }
  return paths;
}

const allowlist = buildAllowlist();

const FIELDS = [
  "pagePath",
  "locale",
  "selectedText",
  "contextBefore",
  "contextAfter",
  "suggestion",
  "website",
] as const;

export function validateSuggestion(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, code: "invalid_body" };
  }
  const body = raw as Record<string, unknown>;

  // Exact field set: unknown fields are rejected (constitution VI's spirit).
  for (const key of Object.keys(body)) {
    if (!(FIELDS as readonly string[]).includes(key)) {
      return { ok: false, code: "invalid_body" };
    }
  }
  for (const key of FIELDS) {
    if (typeof body[key] !== "string") {
      return { ok: false, code: "invalid_body" };
    }
  }

  // Honeypot: bots fill it; humans never see it. The route fakes success.
  if (body.website !== "") {
    return { ok: true, honeypot: true };
  }

  const pagePath = body.pagePath as string;
  const locale = body.locale as string;
  if (locale !== "en" && locale !== "vi") {
    return { ok: false, code: "invalid_page" };
  }
  const isViPath = pagePath === "/vi" || pagePath.startsWith("/vi/");
  if ((locale === "vi") !== isViPath || !allowlist.has(pagePath)) {
    return { ok: false, code: "invalid_page" };
  }

  const selectedText = body.selectedText as string;
  const contextBefore = body.contextBefore as string;
  const contextAfter = body.contextAfter as string;
  if (
    selectedText.length < 1 ||
    selectedText.length > SELECTION_MAX ||
    contextBefore.length > CONTEXT_MAX ||
    contextAfter.length > CONTEXT_MAX
  ) {
    return { ok: false, code: "invalid_selection" };
  }

  const suggestion = (body.suggestion as string).trim();
  if (suggestion.length < 1 || suggestion.length > SUGGESTION_MAX) {
    return { ok: false, code: "invalid_suggestion" };
  }

  return {
    ok: true,
    data: { pagePath, locale, selectedText, contextBefore, contextAfter, suggestion },
  };
}
