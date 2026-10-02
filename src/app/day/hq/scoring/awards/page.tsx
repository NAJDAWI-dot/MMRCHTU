import type { Metadata } from "next";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { requireSection } from "@/lib/admin-access";
import { JUDGED_AWARDS, awardsList, picksOf } from "@/lib/awards";
import { THIRD_PLACE_ROUND } from "@/lib/bracket";
import { loadCompetition } from "@/lib/competition";
import { getCompetitionDayConfig } from "@/lib/site-config";
import { DeskForm, DeskHead, Submit } from "../../DeskKit";
import { addThirdPlace, revealAwards, saveJudgedAwards } from "./actions";

export const metadata: Metadata = { title: "Awards" };

/**
 * The awards, as the rulebook lists them: the podium and the highest score
 * from the bracket, and the judges' four picks entered here. Nothing reaches
 * the public until "Reveal the awards".
 */
export default async function AwardsDeskPage() {
  await requireSection("/day/hq/scoring/awards");
  const [state, config] = await Promise.all([loadCompetition(), getCompetitionDayConfig()]);
  const picks = picksOf(config, (id) => state.byId.has(id));
  const awards = awardsList(state.bracket, picks, true);
  const nameOf = (id: string | null) => (id ? (state.byId.get(id)?.name ?? "") : "");
  const playoff = state.bracket.find((match) => match.round === THIRD_PLACE_ROUND);
  const teams = [...state.competitors].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const decided = awards.filter((award) => award.teamId).length;

  return (
    <div className="space-y-8">
      <DeskHead
        icon="trophy"
        title="Awards"
        lead="The podium and the highest score work themselves out from the bracket. Pick the judged awards below, then reveal them all at the prize-giving."
      />

      <section className={`day-card flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6 ${config.awardsShown ? "ring-2 ring-day-good/40" : ""}`}>
        <div className="flex items-center gap-4">
          <DayIcon name={config.awardsShown ? "eye" : "lock"} className={`h-7 w-7 shrink-0 ${config.awardsShown ? "text-day-good" : "text-day-gold"}`} />
          <div>
            <p className="day-display text-2xl text-day-ink">{config.awardsShown ? "The awards are public" : `${decided} of ${awards.length} decided, held back`}</p>
            <p className="text-sm text-day-muted">
              {config.awardsShown
                ? "They are on the results page and the day site."
                : "Revealing plays them on the hall screen one by one, the champions last, and puts them on the results page. It also reveals the final."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.awardsShown ? (
            <DeskForm action={revealAwards} className="space-y-2">
              <input type="hidden" name="show" value="no" />
              <Submit pending="…" variant="secondary" size="sm">
                Hide them again
              </Submit>
            </DeskForm>
          ) : null}
          <DeskForm action={revealAwards} className="space-y-2">
            <input type="hidden" name="show" value="yes" />
            <Submit pending="…" size="sm">
              {config.awardsShown ? "Play them on the screen again" : "Reveal the awards"}
            </Submit>
          </DeskForm>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="day-display text-2xl text-day-ink">From the bracket</h2>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {awards
            .filter((award) => award.kind !== "judged")
            .map((award) => (
              <li key={award.key} className="day-card flex items-center gap-4 p-4">
                {award.teamId ? <Crest name={nameOf(award.teamId)} size={36} ring={award.place === 1} /> : <span className="h-11 w-11 shrink-0 rounded-[3px] border border-dashed border-day-line/25" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-day-gold">{award.title}</p>
                  <p className={`truncate font-semibold ${award.teamId ? "text-day-ink" : "italic text-day-faint"}`}>{award.teamId ? nameOf(award.teamId) : "Not decided yet"}</p>
                  <p className="text-xs text-day-muted">{award.detail || award.blurb}</p>
                </div>
              </li>
            ))}
        </ul>
        {!playoff && state.drawn ? (
          <DeskForm action={addThirdPlace} className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-day-live">This bracket has no third place play-off.</p>
            <Submit pending="Adding…" variant="secondary" size="sm">
              Add the play-off
            </Submit>
          </DeskForm>
        ) : null}
      </section>

      <section className="day-card p-5 sm:p-6">
        <h2 className="day-display text-2xl text-day-ink">The judges&rsquo; awards</h2>
        <p className="mt-1 text-sm text-day-muted">Judged during the source code review and the robot inspection.</p>
        <DeskForm action={saveJudgedAwards} className="mt-5 space-y-5">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            {JUDGED_AWARDS.map((award) => (
              <div key={award.key}>
                <label className="day-label" htmlFor={award.key}>
                  {award.title}
                </label>
                <select id={award.key} name={award.key} defaultValue={picks[award.key]} className="day-input">
                  <option value="">Not picked yet</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.teamCode ? `${team.teamCode} · ` : ""}
                      {team.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-day-muted">{award.blurb}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Submit pending="Saving…">Save the judges&rsquo; picks</Submit>
          </div>
        </DeskForm>
      </section>
    </div>
  );
}
