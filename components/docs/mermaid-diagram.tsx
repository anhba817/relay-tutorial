"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";

// Renders a mermaid fence from a reference document as an SVG diagram, themed
// to match the site (mermaid "default" in light, "dark" in dark) and re-rendered
// on theme change. Until the library loads (and whenever rendering fails), the
// fallback is the diagram source in a plain fence — honest, never blank.
//
// Large diagrams shrink to fit the page width, which can make labels tiny, so
// each diagram carries GitHub-style controls: zoom in / out / reset, plus
// drag-to-pan inside the frame.
const MIN_SCALE = 1;
const MAX_SCALE = 8;

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const { resolvedTheme } = useTheme();
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
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });
        const renderId = `mmd${reactId.replace(/[^a-zA-Z0-9]/g, "")}${
          resolvedTheme === "dark" ? "d" : "l"
        }`;
        const { svg: rendered } = await mermaid.render(renderId, code);
        if (alive) setSvg(rendered);
      } catch {
        if (alive) setSvg(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, resolvedTheme, reactId]);

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
