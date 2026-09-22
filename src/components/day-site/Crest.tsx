import { CrestMaze } from "@/components/brand/CrestMaze";
import { crestFor } from "@/lib/crest";

/**
 * A team's maze crest: the same one it was given while typing its name on the
 * register form, generated from the name, so every team has its own.
 */
export function Crest({ name, size = 40, glow = false }: { name: string; size?: number; glow?: boolean }) {
  const crest = crestFor(name);
  const box = size + Math.round(size * 0.3);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] ${
        glow ? "shadow-[0_0_40px_-8px_rgba(242,169,0,0.55)]" : ""
      }`}
      style={{ width: box, height: box }}
    >
      {crest ? <CrestMaze maze={crest} size={size} label={null} strokeWidth={2.8} /> : null}
    </span>
  );
}
