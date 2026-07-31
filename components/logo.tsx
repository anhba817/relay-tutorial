// The series mark: a speech bubble carrying a three-node relay chain —
// messages passed hop to hop, inside chat. Colors ride the theme tokens
// (bubble = foreground, chain = primary), so it adapts to light/dark and any
// future palette change without edits.
export function RelayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* speech bubble with tail */}
      <path
        d="M9 4h14a6 6 0 0 1 6 6v7a6 6 0 0 1-6 6h-8.5L9 28.5V23a6 6 0 0 1-6-6v-7a6 6 0 0 1 6-6Z"
        className="stroke-foreground"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* the relay chain: a message hopping node to node */}
      <line
        x1="10"
        y1="13.5"
        x2="22"
        y2="13.5"
        className="stroke-primary"
        strokeWidth="2"
      />
      <circle cx="9.5" cy="13.5" r="2.4" className="fill-primary" />
      <circle
        cx="16"
        cy="13.5"
        r="2.4"
        className="fill-background stroke-primary"
        strokeWidth="2"
      />
      <circle cx="22.5" cy="13.5" r="2.4" className="fill-primary" />
    </svg>
  );
}
