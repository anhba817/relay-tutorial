"use client";

import { useRef, useState } from "react";

// Every code block's chrome: the <pre> plus a one-click copy button (feature
// request, post-013). Locale-neutral by design — the button is icon-only, so
// the same component serves en and vi pages without needing a locale prop
// (mdx-components cannot know the locale).
export function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — do nothing;
      // the text remains selectable.
    }
  };

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        title="Copy code"
        className="absolute right-2 top-2 z-10 rounded border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:border-primary hover:text-primary focus:opacity-100 group-hover:opacity-100"
      >
        {copied ? "✓" : "⧉"}
      </button>
      <pre ref={preRef} {...props} />
    </div>
  );
}
