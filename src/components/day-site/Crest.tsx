import { CrestMaze } from "@/components/brand/CrestMaze";
import { crestFor } from "@/lib/crest";

/**
 * A team's maze crest: the same one it was given while typing its name on the
 * register form, generated from the name, so every team has its own.
 *
 * The stroke is in the drawing's own units, so a crest drawn small needs a
 * heavier one or the walls fade to nothing and it reads as an empty tile.
 */
export function Crest({ name, size = 40, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const crest = crestFor(name);
  const box = size + Math.round(size * 0.34);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] border bg-day-sunk ${
        ring ? "border-day-gold/60 shadow-[0_0_0_4px_rgb(var(--day-gold)/0.14)]" : "border-day-line/10"
      }`}
      style={{ width: box, height: box }}
    >
      {crest ? <CrestMaze maze={crest} size={size} label={null} strokeWidth={size < 36 ? 4.4 : 2.8} /> : null}
    </span>
  );
}
