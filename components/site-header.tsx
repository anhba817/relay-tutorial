"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { localeFromPath, localePath } from "@/lib/i18n";
import { seriesTitle } from "@/lib/tutorial";

// Slim site-wide header rendered from the root layout: the one place that puts
// the theme and language controls on every current and future page. Client
// because locale derives from the pathname, which a server component rendered
// once from the root layout cannot know (feature 004).
export function SiteHeader() {
  const locale = localeFromPath(usePathname());

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-6">
        <Link
          href={localePath(locale, "/")}
          className="text-sm font-semibold tracking-tight text-foreground hover:text-primary"
        >
          {seriesTitle}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
