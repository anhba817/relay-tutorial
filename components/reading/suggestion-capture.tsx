"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { t, type Locale } from "@/lib/i18n";
import {
  CONTEXT_MAX,
  SELECTION_MAX,
  SUGGESTION_MAX,
  type SuggestionErrorCode,
} from "@/lib/suggestions";

// Select-and-suggest capture (feature 015). Renders nothing until the reader
// selects text inside #reading-article. Fine pointers get a one-item custom
// context menu ON SELECTION ONLY — right-click without a selection is never
// intercepted (FR-001). Coarse pointers (Android long-press also fires
// contextmenu!) get ONLY the floating button, so the native selection toolbar
// survives (research R4).

interface Capture {
  text: string;
  before: string;
  after: string;
}

type Ui =
  | { mode: "idle" }
  | { mode: "menu"; x: number; y: number; capture: Capture }
  | { mode: "button"; x: number; y: number; capture: Capture }
  | { mode: "dialog"; capture: Capture };

type Status = "editing" | "submitting" | "sent" | SuggestionErrorCode;

const BLOCKS = "p, li, td, th, h2, h3, h4, blockquote, pre, figcaption, dd, dt";

function articleRoot(): HTMLElement | null {
  return document.getElementById("reading-article");
}

function captureSelection(): Capture | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const root = articleRoot();
  if (!root || !root.contains(range.commonAncestorContainer)) return null;
  const text = selection.toString();
  if (!text.trim()) return null;

  // Context: the enclosing block's text around the selection — plain strings,
  // no DOM paths, so a suggestion survives re-renders and small edits.
  let before = "";
  let after = "";
  const start = range.startContainer;
  const block = (start instanceof Element ? start : start.parentElement)?.closest(BLOCKS);
  const blockText = block?.textContent ?? "";
  const at = blockText.indexOf(text);
  if (at >= 0) {
    before = blockText.slice(Math.max(0, at - CONTEXT_MAX), at);
    after = blockText.slice(at + text.length, at + text.length + CONTEXT_MAX);
  }
  return { text, before, after };
}

export function SuggestionCapture({ locale }: { locale: Locale }) {
  const d = t(locale).suggest;
  const pathname = usePathname();
  const [ui, setUi] = useState<Ui>({ mode: "idle" });
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("editing");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uiRef = useRef<Ui>({ mode: "idle" });
  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const reset = useCallback(() => {
    setUi({ mode: "idle" });
    setBody("");
    setStatus("editing");
  }, []);

  // Route change: any open affordance belongs to the previous page.
  // Render-phase state adjustment (the sanctioned reset-on-prop-change form).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (ui.mode !== "idle") {
      setUi({ mode: "idle" });
      setBody("");
      setStatus("editing");
    }
  }

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const onContextMenu = (e: MouseEvent) => {
      if (coarse) return; // fine-pointer feature only (R4)
      if (uiRef.current.mode === "dialog") return;
      const capture = captureSelection();
      if (!capture) return; // native menu stays sacred
      e.preventDefault();
      setStatus("editing");
      setUi({ mode: "menu", x: e.clientX, y: e.clientY, capture });
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSelectionChange = () => {
      if (!coarse) return; // floating button is the touch affordance only
      if (uiRef.current.mode === "dialog") return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (uiRef.current.mode === "dialog") return;
        const capture = captureSelection();
        if (!capture) {
          if (uiRef.current.mode === "button") setUi({ mode: "idle" });
          return;
        }
        const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
        setStatus("editing");
        setUi({
          mode: "button",
          x: Math.min(rect.left + rect.width / 2, window.innerWidth - 56),
          y: Math.min(rect.bottom + 8, window.innerHeight - 48),
          capture,
        });
      }, 350);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && uiRef.current.mode !== "idle") {
        setUi({ mode: "idle" });
      }
    };
    const onPointerDown = (e: Event) => {
      const mode = uiRef.current.mode;
      if (mode !== "menu" && mode !== "button") return;
      if ((e.target as Element | null)?.closest("[data-suggest-ui]")) return;
      setUi({ mode: "idle" });
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  const openDialog = (capture: Capture) => {
    setUi({ mode: "dialog", capture });
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const submit = async (capture: Capture) => {
    const suggestion = body.trim();
    if (!suggestion) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pagePath: pathname,
          locale,
          selectedText: capture.text,
          contextBefore: capture.before,
          contextAfter: capture.after,
          suggestion,
          website: "",
        }),
      });
      if (res.status === 201) {
        setStatus("sent");
        setTimeout(reset, 2000);
        return;
      }
      const payload = (await res.json().catch(() => null)) as { code?: Status } | null;
      setStatus(payload?.code ?? "storage_unavailable");
    } catch {
      setStatus("storage_unavailable");
    }
  };

  if (ui.mode === "idle") return null;

  const errorText = (code: Status): string | null => {
    switch (code) {
      case "invalid_selection":
        return d.errorTooLong;
      case "invalid_suggestion":
      case "invalid_page":
      case "invalid_body":
        return d.errorInvalid;
      case "rate_limited":
        return d.errorRate;
      case "storage_unavailable":
        return d.errorOffline;
      default:
        return null;
    }
  };

  if (ui.mode === "menu" || ui.mode === "button") {
    const capture = ui.capture;
    return (
      <div
        data-suggest-ui
        role="menu"
        className="fixed z-50 rounded-md border border-border bg-card shadow-md"
        style={{ left: ui.x, top: ui.y }}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => openDialog(capture)}
          className="block px-3 py-1.5 text-sm text-card-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {d.action}
        </button>
      </div>
    );
  }

  const selectionTooLong = ui.capture.text.length > SELECTION_MAX;
  const remaining = SUGGESTION_MAX - body.length;
  const error = selectionTooLong && status === "editing" ? d.errorTooLong : errorText(status);

  return (
    <div
      data-suggest-ui
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) reset();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={d.dialogTitle}
        className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-card-foreground">{d.dialogTitle}</h2>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {d.selectedLabel}
        </p>
        <blockquote className="mt-1 max-h-32 overflow-y-auto rounded border-l-2 border-primary bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {ui.capture.text}
        </blockquote>
        {status === "sent" ? (
          <p className="mt-4 text-sm font-medium text-primary">{d.thanks}</p>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={SUGGESTION_MAX}
              rows={4}
              placeholder={d.placeholder}
              className="mt-4 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{error ?? ""}</span>
              <span>{d.counter.replace("{n}", String(remaining))}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                {d.cancel}
              </button>
              <button
                type="button"
                onClick={() => submit(ui.capture)}
                disabled={status === "submitting" || selectionTooLong || !body.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {status === "submitting" ? d.submitting : d.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
