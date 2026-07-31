"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { SeriesSidebar } from "@/components/reading/series-sidebar";
import { t, type Locale } from "@/lib/i18n";

// The mobile drawer for the series outline (feature 012, FR-007): a labeled
// toggle below lg opens the same SeriesSidebar as a dismissible overlay.
// Hand-rolled on purpose — no dialog primitive exists in the component
// library and one drawer does not justify importing one. Escape and the
// backdrop dismiss; focus moves into the panel on open; navigation closes it.
export function MobileSeriesNav({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const d = t(locale);

  // Close on navigation — state adjusted during render (the React-sanctioned
  // alternative to a setState-in-effect, which the lint config forbids).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="mt-4 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        ☰ {d.shell.openNav}
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label={d.shell.closeNav}
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={d.shell.openNav}
            className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto border-r border-border bg-background p-6 shadow-xl outline-none"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                {d.shell.openNav}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={d.shell.closeNav}
                className="rounded border border-border bg-card px-2 py-0.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
              >
                ✕
              </button>
            </div>
            <SeriesSidebar locale={locale} />
          </div>
        </div>
      )}
    </div>
  );
}
