import type { ReactNode } from "react";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The Building Relay recurring box conventions (docs/07 §2 in the relay repo).
// Styling uses Violet Bloom theme tokens exclusively so every box renders
// correctly in light and dark mode with zero per-chapter styling work.

interface BoxProps {
  children: ReactNode;
  /** Chapter language — localizes the box label only (feature 004). */
  locale?: Locale;
}

function Box({
  label,
  className,
  labelClassName,
  children,
}: BoxProps & {
  label: string;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <aside
      className={cn(
        "not-prose my-6 rounded-lg border px-5 py-4 text-sm leading-6",
        className,
      )}
    >
      <p
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-widest",
          labelClassName,
        )}
      >
        {label}
      </p>
      <div className="[&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
}

/** Links a claim in the chapter to its source document or requirement. */
export function Why({ source, locale = "en", children }: BoxProps & { source?: string }) {
  const label = t(locale).boxes.why;
  return (
    <Box
      label={source ? `${label} — ${source}` : label}
      className="border-accent-foreground/30 bg-accent text-accent-foreground"
      labelClassName="text-accent-foreground"
    >
      {children}
    </Box>
  );
}

/** The bug or mistake you would write naively. */
export function Trap({ locale = "en", children }: BoxProps) {
  return (
    <Box
      label={t(locale).boxes.trap}
      className="border-destructive/40 bg-destructive/10 text-foreground"
      labelClassName="text-destructive"
    >
      {children}
    </Box>
  );
}

/** Verify before continuing — what must be true or in hand. */
export function Checkpoint({ locale = "en", children }: BoxProps) {
  return (
    <Box
      label={t(locale).boxes.checkpoint}
      className="border-primary/40 bg-primary/10 text-foreground"
      labelClassName="text-primary"
    >
      {children}
    </Box>
  );
}

/** What may be skipped, and what the skipper must still take with them. */
export function SkipAhead({ locale = "en", children }: BoxProps) {
  return (
    <Box
      label={t(locale).boxes.skipAhead}
      className="border-border bg-muted text-muted-foreground"
      labelClassName="text-muted-foreground"
    >
      {children}
    </Box>
  );
}

/** A later part revised this content; prose and code never disagree silently. */
export function Revised({ note, locale = "en", children }: BoxProps & { note?: string }) {
  const label = t(locale).boxes.revised;
  return (
    <Box
      label={note ? `${label} — ${note}` : label}
      className="border-border bg-secondary text-secondary-foreground"
      labelClassName="text-secondary-foreground"
    >
      {children}
    </Box>
  );
}

/** Ties a Part 0 claim to the concrete artifact it becomes later. */
export function ForwardRef({ part, locale = "en", children }: BoxProps & { part: string }) {
  return (
    <Box
      label={`${t(locale).boxes.forwardRef} — ${part}`}
      className="border-accent-foreground/30 border-dashed bg-accent/50 text-foreground"
      labelClassName="text-accent-foreground"
    >
      {children}
    </Box>
  );
}
