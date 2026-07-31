"use client";

import { useEffect, useId, useRef, useState } from "react";

// Renders a mermaid fence (reference documents) or chapter figure as an SVG
// diagram in the series' fixed diagram palette (PlantUML-style cream/red —
// user-specified theme, applied to ALL diagrams in both site themes; the cream
// nodes with black text stay legible on dark backgrounds). Until the library
// loads (and whenever rendering fails), the fallback is the diagram source in
// a plain fence — honest, never blank.
//
// Large diagrams shrink to fit the page width, which can make labels tiny, so
// each diagram carries GitHub-style controls: zoom in / out / reset, plus
// drag-to-pan inside the frame.
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

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const reactId = useId();

  useEffect(() => {
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
        const renderId = `mmd${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
        const { svg: rendered } = await mermaid.render(renderId, code);
        if (alive) setSvg(rendered);
      } catch {
        if (alive) setSvg(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, reactId]);

  if (!svg) {
    return (
      <pre className="overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }

  const zoomTo = (next: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    setScale(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  const zoomed = scale > 1;
  const buttonClass =
    "rounded border border-border bg-card px-2 py-0.5 text-sm leading-5 text-muted-foreground transition-colors hover:border-primary hover:text-primary";

  return (
    <div className="relative my-6 rounded-lg border border-border">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          className={buttonClass}
          onClick={() => zoomTo(scale / 1.5)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          title="Reset zoom"
          className={buttonClass}
          onClick={() => zoomTo(1)}
        >
          ⟲
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          className={buttonClass}
          onClick={() => zoomTo(scale * 1.5)}
        >
          +
        </button>
      </div>
      <div
        className={`overflow-hidden ${zoomed ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ touchAction: zoomed ? "none" : "auto" }}
        onPointerDown={(e) => {
          if (!zoomed) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
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
          className="flex justify-center p-4 [&_svg]:h-auto [&_svg]:max-w-full"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: dragging ? undefined : "transform 120ms ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
