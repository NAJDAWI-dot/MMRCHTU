import type { Metadata } from "next";
import { DayIcon } from "@/components/day-site/icons";
import { requireSection } from "@/lib/admin-access";
import { FINAL_ROUND, phaseInfo } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { openDaySite } from "@/lib/day-links";
import { REVEAL_PHASES, advanceShown, anythingHidden, resultsShown, revealOf } from "@/lib/reveal";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { DeskForm, DeskHead, Submit } from "../../DeskKit";
import { setReveal, setRevealAll } from "./actions";

export const metadata: Metadata = { title: "Reveal" };

/** One switch: shows or holds back one thing for one phase. */
function RevealSwitch({ phase, kind, shown, label }: { phase: number; kind: "results" | "advance"; shown: boolean; label: string }) {
  return (
    <DeskForm action={setReveal} className="space-y-2">
      <input type="hidden" name="phase" value={phase} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="show" value={shown ? "no" : "yes"} />
      <button
        type="submit"
        role="switch"
        aria-checked={shown}
        aria-label={`${label}: ${shown ? "shown to the public" : "hidden from the public"}`}
        className={`group flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition-colors ${
          shown ? "bg-day-good/10 ring-day-good/30 hover:bg-day-good/15" : "bg-day-ink/[0.04] ring-day-line/[0.12] hover:bg-day-ink/[0.07]"
        }`}
      >
        <span>
          <span className="block text-sm font-semibold text-day-ink">{label}</span>
          <span className={`block text-xs font-semibold ${shown ? "text-day-good" : "text-day-muted"}`}>{shown ? "Shown to everyone" : "Hidden from the public"}</span>
        </span>
        <span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${shown ? "bg-day-good" : "bg-day-ink/20"}`} aria-hidden="true">
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${shown ? "translate-x-6" : "translate-x-1"}`} />
        </span>
      </button>
    </DeskForm>
  );
}

/**
 * What the day site and the hall screen show of the results, phase by phase.
 * Scores go in on the Qualifying and Bracket desks as they happen; here the
 * organisers choose when the room finds out.
 */
export default async function RevealDeskPage() {
  await requireSection("/day/hq/scoring/reveal");
  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  const reveal = revealOf(config);
  const hiddenCount = REVEAL_PHASES.length * 2 - REVEAL_PHASES.filter((p) => resultsShown(reveal, p)).length - REVEAL_PHASES.filter((p) => advanceShown(reveal, p)).length;

  const progressOf = (phase: number) => {
    if (phase === 1) {
      const ran = state.table.filter((row) => row.recorded).length;
      const through = state.table.filter((row) => row.qualified).length;
      return `${ran} of ${state.competitors.length} teams have run · ${through} going through${state.drawn ? ", drawn into the bracket" : ""}`;
    }
    const matches = state.bracket.filter((match) => match.round === phase && !match.void && !match.walkover);
    if (!state.drawn || !matches.some((match) => match.teamAId || match.teamBId)) return "Not reached yet";
    return `${matches.filter((match) => match.winnerId).length} of ${matches.length} matches decided`;
  };

  return (
    <div className="space-y-8">
      <DeskHead
        icon="eye"
        title="Reveal"
        lead="Everything is recorded on the desks as it happens. Here you choose what the day site and the hall screen show, and when."
      >
        <a href={openDaySite("/day/standings")} target="_blank" className="day-btn day-btn-soft day-btn-sm">
          <DayIcon name="live" className="h-4 w-4" />
          See what the public sees
        </a>
      </DeskHead>

      <section className="day-card flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span
            className={`grid h-12 w-12 place-items-center rounded-2xl ${anythingHidden(reveal) ? "bg-day-gold/15 text-day-gold" : "bg-day-good/15 text-day-good"}`}
          >
            <DayIcon name={anythingHidden(reveal) ? "lock" : "eye"} className="h-6 w-6" />
          </span>
          <div>
            <p className="day-display text-2xl text-day-ink">{anythingHidden(reveal) ? `${hiddenCount} of 12 held back` : "Everything is public"}</p>
            <p className="text-sm text-day-muted">Holding back who went through also hides the next round&rsquo;s pairings, which would give it away.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DeskForm action={setRevealAll} className="space-y-2">
            <input type="hidden" name="show" value="no" />
            <Submit pending="…" variant="secondary" size="sm">
              Hide everything
            </Submit>
          </DeskForm>
          <DeskForm action={setRevealAll} className="space-y-2">
            <input type="hidden" name="show" value="yes" />
            <Submit pending="…" size="sm">
              Reveal everything
            </Submit>
          </DeskForm>
        </div>
      </section>

      <ol className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        {REVEAL_PHASES.map((phase) => (
          <li key={phase} className="day-card space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="day-kicker">Phase {phase}</p>
                <h2 className="day-display mt-1 text-2xl text-day-ink">{phaseInfo(phase).name}</h2>
                <p className="mt-1 text-xs text-day-muted">{progressOf(phase)}</p>
              </div>
              {!resultsShown(reveal, phase) || !advanceShown(reveal, phase) ? (
                <span className="rounded-full bg-day-gold/15 px-2.5 py-1 text-[11px] font-bold text-day-gold">Held back</span>
              ) : (
                <span className="rounded-full bg-day-good/15 px-2.5 py-1 text-[11px] font-bold text-day-good">Public</span>
              )}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              <RevealSwitch phase={phase} kind="results" shown={resultsShown(reveal, phase)} label={phase === 1 ? "Scores, runs and places" : "Scores and runs"} />
              <RevealSwitch
                phase={phase}
                kind="advance"
                shown={advanceShown(reveal, phase)}
                label={phase === FINAL_ROUND ? "The champions" : phase === 1 ? "Who qualified" : "Who went through"}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
