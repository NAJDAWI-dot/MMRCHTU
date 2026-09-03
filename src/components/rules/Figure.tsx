import type { ReactNode } from "react";

/**
 * The frame around every diagram in the rulebook.
 *
 * `not-prose` matters more than it looks: the rules page wraps its content in
 * Tailwind Typography's `prose`, which restyles headings, buttons and captions
 * inside anything it contains. Without the opt-out these figures would inherit
 * article margins and link underlines meant for running text, and the controls
 * would not look like controls.
 */
export function Figure({
  title,
  caption,
  controls,
  children,
  id,
}: {
  title: string;
  /** What the reader should take from the diagram. */
  caption: ReactNode;
  /** Buttons and inputs, kept beside the title rather than lost below it. */
  controls?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <figure
      id={id}
      className="not-prose my-8 rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h3 className="font-display text-base font-bold text-ras-purple dark:text-white">
          {title}
        </h3>
        {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
      <figcaption className="mt-4 text-sm leading-relaxed text-ras-gray dark:text-white/70">
        {caption}
      </figcaption>
    </figure>
  );
}

export type SwatchKind = "line" | "dashed" | "cell" | "dot";

/**
 * Names the marks on a diagram.
 *
 * The routes are drawn over the maze itself, and where two of them agree the
 * upper one hides the lower — so what a reader actually sees of the ideal route
 * is whichever fragments diverge from the run they got. That is the useful
 * part, but a stub of dashed line means nothing without being told what it is.
 */
export function Legend({
  items,
}: {
  items: Array<{ kind: SwatchKind; className: string; label: string }>;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true" className="shrink-0">
            {item.kind === "cell" ? (
              <rect x={7} y={1} width={12} height={10} rx={2} className={item.className} />
            ) : item.kind === "dot" ? (
              <circle cx={13} cy={6} r={4.5} strokeWidth={2} className={item.className} />
            ) : (
              <line
                x1={1}
                y1={6}
                x2={25}
                y2={6}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={item.kind === "dashed" ? "5 4" : undefined}
                className={item.className}
              />
            )}
          </svg>
          <span className="text-xs text-ras-gray dark:text-white/70">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** A labelled number beside a diagram — the figures a caption would bury. */
export function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "good" | "bad";
}) {
  const valueTone =
    tone === "good"
      ? "text-ras-purple dark:text-white"
      : tone === "bad"
        ? "text-accent dark:text-rose-300"
        : "text-ras-purple dark:text-white";

  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-ras-gray dark:text-white/60">
        {label}
      </dt>
      <dd className={`font-mono text-lg font-bold ${valueTone}`}>{value}</dd>
    </div>
  );
}
