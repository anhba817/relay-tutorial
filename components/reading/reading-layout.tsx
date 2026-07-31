import type { ReactNode } from "react";

import { OnThisPage } from "@/components/reading/on-this-page";
import { SeriesSidebar } from "@/components/reading/series-sidebar";
import { MobileSeriesNav } from "@/components/reading/mobile-series-nav";
import { SuggestionCapture } from "@/components/reading/suggestion-capture";
import type { Locale } from "@/lib/i18n";

// The shared reading shell (feature 012): left series outline (≥ lg), the
// article column at its prose measure, right on-this-page rail (≥ xl). Both
// side columns stick below the h-12 site header and scroll independently.
// Mounted on the two part-0 layouts and the doc reference page — nowhere
// else (landings keep their own layout, FR-008).
export function ReadingLayout({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 lg:px-8">
      <MobileSeriesNav locale={locale} />
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[16rem_minmax(0,1fr)_14rem]">
        <aside className="hidden lg:block">
          <div className="sticky top-12 max-h-[calc(100vh-3rem)] overflow-y-auto py-8 pr-2">
            <SeriesSidebar locale={locale} />
          </div>
        </aside>
        <div id="reading-article" className="min-w-0">
          {children}
          <SuggestionCapture locale={locale} />
        </div>
        <aside className="hidden xl:block">
          <div className="sticky top-12 max-h-[calc(100vh-3rem)] overflow-y-auto py-8">
            <OnThisPage locale={locale} />
          </div>
        </aside>
      </div>
    </div>
  );
}
