import { MouseMark } from "@/components/brand/MouseMark";

export interface RoadStep {
  phase: number;
  label: string;
  teams: number;
  blurb: string;
}

/**
 * The road to the final, drawn as a mouse's route: a post for each phase, the
 * wall between them crimson where the day has already been, and the mouse at
 * the phase that is running now. Under each phase a bar as wide as the field,
 * so the narrowing from forty teams to two is seen, not just read.
 *
 * Across the page on a laptop; down it on a phone, where six columns would
 * not fit and a list reads better anyway.
 */
export function Road({ steps, current }: { steps: RoadStep[]; current: number }) {
  const widest = Math.max(1, ...steps.map((step) => step.teams));
  return (
    <ol className="grid md:grid-cols-6" data-reveal>
      {steps.map((step, index) => {
        const done = step.phase < current;
        const now = step.phase === current;
        const last = index === steps.length - 1;
        return (
          <li key={step.phase} className="relative pb-9 pl-9 last:pb-0 md:pb-0 md:pl-0 md:pr-5 md:pt-12" aria-current={now ? "step" : undefined}>
            {/* The wall to the next phase: down on a phone, across on a laptop. */}
            {!last ? (
              <span
                aria-hidden="true"
                className={`absolute left-[5px] top-3 h-full w-[2px] md:left-3 md:top-[11px] md:h-[2px] md:w-full ${done ? "bg-day-crimson" : "bg-day-line/[0.18]"}`}
              />
            ) : null}
            {/* The post. */}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1.5 h-3 w-3 md:top-[6px] ${now ? "bg-day-crimson" : done ? "bg-day-ink" : "border-2 border-day-line/30 bg-day-bg"}`}
            />
            {now ? (
              <MouseMark className="absolute -top-1 left-5 hidden h-6 w-6 text-day-crimson md:block" />
            ) : null}
            <p className={`text-[0.8125rem] font-semibold ${now ? "text-day-crimson" : "text-day-muted"}`}>
              Phase {step.phase}
              {now ? " · now" : done ? " · done" : ""}
            </p>
            <p className={`day-display mt-1 text-[1.35rem] ${done ? "text-day-muted" : "text-day-ink"}`}>{step.label}</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className={`day-num day-display text-[2rem] leading-none ${done ? "text-day-muted" : "text-day-ink"}`}>{step.teams}</span>
              <span className="text-sm font-medium text-day-muted">{step.phase === 6 ? "finalists" : "teams"}</span>
            </p>
            <span className="mt-2.5 block h-1.5 max-w-[12rem] bg-day-line/[0.1]" aria-hidden="true">
              <span className={`block h-full ${now ? "bg-day-crimson" : done ? "bg-day-muted" : "bg-day-ink"}`} style={{ width: `${Math.max(4, (step.teams / widest) * 100)}%` }} />
            </span>
            <p className="mt-3 max-w-[16rem] text-[0.8125rem] leading-relaxed text-day-muted">{step.blurb}</p>
          </li>
        );
      })}
    </ol>
  );
}
