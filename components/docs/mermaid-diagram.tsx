"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MaximizeIcon, XIcon } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Renders a mermaid fence (reference documents) or chapter figure as an SVG
// diagram in the series' fixed diagram palette (PlantUML-style cream/red —
// user-specified theme, applied to ALL diagrams in both site themes; the cream
// nodes with black text stay legible on dark backgrounds). Until the library
// loads (and whenever rendering fails), the fallback is the diagram source in
// a plain fence — honest, never blank.
//
// Large diagrams shrink to fit the page width, which can make labels tiny, so
// each diagram carries GitHub-style controls: zoom in / out / reset, drag to
// pan inside the frame, and expand into a near-fullscreen modal for the ones
// that are simply too wide to read in a column of prose.
const MIN_SCALE = 1;
const MAX_SCALE = 8;

const DIAGRAM_THEME_VARIABLES = {
  primaryColor: "#FEFECE",
  primaryTextColor: "#000000",
  lineColor: "#A80036",
  actorBorder: "#A80036",
  actorBkg: "#FEFECE",
  activationBorderColor: "#A80036",
  activationBkgColor: "#FEFECE",
  noteBkgColor: "#FDFDCD",
  noteBorderColor: "#A80036",
  signalColor: "#A80036",
  signalLineColor: "#A80036",
  // Extends the user-specified set: flowchart node borders read
  // primaryBorderColor (the sequence-diagram border vars above don't apply to
  // flowcharts), so without this the most common diagram type would lose the
  // red border the palette clearly intends.
  primaryBorderColor: "#A80036",
  // xychart-beta derives its plot lines from primaryColor — cream lines are
  // invisible on the page background. Give it explicit line colors: dark,
  // saturated, mutually distinguishable, led by the palette's red. Series
  // take colors in order; eight covers future multi-line charts.
  xyChart: {
    plotColorPalette:
      "#A80036, #2E5AAC, #1A7F37, #B25000, #6A3FA0, #0E7490, #8A6D00, #555555",
  },
};

/** Render `code` to SVG markup, or null while loading and on failure.
 *
 * `idSalt` keeps two renders of the same diagram apart. The expanded copy is a
 * SECOND render rather than a copy of the same markup, because mermaid mints
 * element ids (arrowhead markers, gradients) from the render id and refers to
 * them with `url(#id)` — two identical id sets in one document would have the
 * modal's arrows quietly pointing at the inline diagram's definitions.
 */
function useMermaidSvg(code: string | null, idSalt: string): string | null {
  // The render is stored WITH the source it came from, so a stale SVG is
  // never shown for new source — and no state has to be cleared on the way
  // out, which would mean calling setState straight from an effect.
  const [rendered, setRendered] = useState<{ code: string; svg: string } | null>(
    null,
  );
  const reactId = useId();

  useEffect(() => {
    if (code === null) return;
    let alive = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          // "antiscript" keeps the docs' <br/> label line-breaks working while
          // still stripping script content; "strict" would render the tags as
          // literal text and garble the labels.
          securityLevel: "antiscript",
          theme: "base",
          themeVariables: DIAGRAM_THEME_VARIABLES,
        });
        const renderId = `mmd${idSalt}${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
        const { svg } = await mermaid.render(renderId, code);
        if (alive) setRendered({ code, svg });
      } catch {
        // Leave the previous render in place if there was one; the caller
        // falls back to the source fence when there is nothing to show.
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, idSalt, reactId]);

  return rendered && rendered.code === code ? rendered.svg : null;
}

const controlClass =
  "rounded border border-border bg-card px-2 py-0.5 text-sm leading-5 text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** The diagram itself: zoom, drag-to-pan, and whatever extra control the
 * caller wants beside the zoom cluster (expand inline; nothing in the modal,
 * where the dialog owns closing). Both placements share this one
 * implementation, so the two never drift apart. */
function DiagramCanvas({
  svg,
  fill = false,
  extraControls,
}: {
  svg: string;
  fill?: boolean;
  extraControls?: ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  const zoomTo = (next: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    setScale(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  const zoomed = scale > 1;

  return (
    <>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          className={controlClass}
          onClick={() => zoomTo(scale / 1.5)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          title="Reset zoom"
          className={controlClass}
          onClick={() => zoomTo(1)}
        >
          ⟲
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          className={controlClass}
          onClick={() => zoomTo(scale * 1.5)}
        >
          +
        </button>
        {extraControls}
      </div>
      <div
        className={`overflow-hidden ${fill ? "h-full" : ""} ${
          zoomed ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        style={{ touchAction: zoomed ? "none" : "auto" }}
        onPointerDown={(e) => {
          if (!zoomed) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
          };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          setOffset({
            x: drag.ox + (e.clientX - drag.x),
            y: drag.oy + (e.clientY - drag.y),
          });
        }}
        onPointerUp={() => {
          dragRef.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragging(false);
        }}
      >
        <div
          className={`flex justify-center p-4 [&_svg]:h-auto [&_svg]:max-w-full ${
            fill ? "h-full items-center [&_svg]:max-h-full" : ""
          }`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: dragging ? undefined : "transform 120ms ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </>
  );
}

export function MermaidDiagram({ code }: { code: string }) {
  const [expanded, setExpanded] = useState(false);
  const svg = useMermaidSvg(code, "a");
  // Rendered only while the modal is open: an expanded copy nobody asked for
  // is parse work on every diagram on the page.
  const expandedSvg = useMermaidSvg(expanded ? code : null, "b");

  if (!svg) {
    return (
      <pre className="overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <div className="relative my-6 rounded-lg border border-border">
        <DiagramCanvas
          svg={svg}
          extraControls={
            <DialogTrigger
              type="button"
              aria-label="Expand diagram"
              title="Expand diagram"
              className={controlClass}
            >
              <MaximizeIcon className="size-3.5" aria-hidden="true" />
            </DialogTrigger>
          }
        />
      </div>
      <DialogContent
        // Near-fullscreen, because the whole point is the space: a diagram
        // that needed expanding needs room, not a centred card.
        className="h-[92vh] w-[96vw] max-w-none gap-0 p-0 sm:h-[90vh] sm:w-[92vw]"
        // The dialog's own corner button is suppressed: it sits exactly where
        // the zoom cluster does, and the first browser check found it covered
        // and unclickable. Closing joins the cluster instead — one row of
        // controls, the way GitHub groups them.
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Expanded diagram</DialogTitle>
        <div className="relative h-full overflow-hidden rounded-lg">
          {expandedSvg ? (
            <DiagramCanvas
              svg={expandedSvg}
              fill
              extraControls={
                <DialogClose
                  type="button"
                  aria-label="Close expanded diagram"
                  title="Close (Esc)"
                  className={controlClass}
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </DialogClose>
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Rendering…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
