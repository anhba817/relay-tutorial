"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { localePath, t, type Locale } from "@/lib/i18n";

const emptySubscribe = () => () => {};

function readLocaleCookie(): Locale | null {
  const match = document.cookie.match(/(?:^|;\s*)locale=(en|vi)/);
  return (match?.[1] as Locale) ?? null;
}

/** Cookie value on the client, `null` during server render (hydration-safe). */
function useLocaleCookie(): Locale | null {
  return useSyncExternalStore(emptySubscribe, readLocaleCookie, () => null);
}

/** Dismissible cross-locale hint shown on a landing page when the stored
 * preference disagrees with the page's locale. Never redirects (research R3).
 * Cookie readers: this component only. Cookie writers: the switcher only. */
export function LocaleHint({ locale }: { locale: Locale }) {
  const stored = useLocaleCookie();
  const [dismissed, setDismissed] = useState(false);

  if (!stored || stored === locale || dismissed) return null;
  const d = t(stored);

  return (
    <aside
      lang={stored}
      className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-accent-foreground/30 bg-accent px-4 py-2 text-sm text-accent-foreground"
    >
      <Link href={localePath(stored, "/")} className="font-medium hover:underline">
        {d.hint.readInThisLanguage}
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-md px-2 py-0.5 text-xs text-accent-foreground/80 hover:bg-accent-foreground/10"
      >
        {d.hint.dismiss}
      </button>
    </aside>
  );
}
