import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { seriesTitle } from "@/lib/tutorial";

// Slim site-wide header rendered from the root layout: the one place that puts
// the theme control on every current and future page (feature 003, FR-001).
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground hover:text-primary"
        >
          {seriesTitle}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
