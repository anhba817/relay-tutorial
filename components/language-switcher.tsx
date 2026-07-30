"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  counterpartPath,
  localeFromPath,
  localePath,
  locales,
  t,
  type Locale,
} from "@/lib/i18n";
import { hasBody, series } from "@/lib/tutorial";
import { cn } from "@/lib/utils";

function setLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale}; max-age=31536000; path=/; SameSite=Lax`;
}

/** Target for switching to `target` from `pathname` — never a dead mirror path.
 * If the counterpart page doesn't exist (a future en-only chapter), fall back
 * to the target locale's landing (FR-009). */
function switchTarget(pathname: string, target: Locale): string {
  const current = localeFromPath(pathname);
  if (current === target) return pathname;
  const enPath = current === "vi" ? counterpartPath(pathname) : pathname;
  if (enPath === "/") return localePath(target, "/");
  const chapter = series
    .flatMap((p) => p.chapters)
    .find((c) => c.path === enPath);
  if (chapter && !hasBody(chapter, target)) return localePath(target, "/");
  return localePath(target, enPath);
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const active = localeFromPath(pathname);

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Language">
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground">/</span>}
          <Link
            href={switchTarget(pathname, locale)}
            aria-label={t(locale).switcher.switchToThisLanguage}
            aria-current={active === locale ? "true" : undefined}
            onClick={() => setLocaleCookie(locale)}
            className={cn(
              "rounded-md px-1.5 py-0.5 font-medium",
              active === locale
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {t(locale).switcher.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
