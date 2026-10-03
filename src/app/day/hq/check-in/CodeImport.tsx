"use client";

import { useFormState } from "react-dom";
import { DayIcon } from "@/components/day-site/icons";
import type { CodePlan } from "@/lib/team-codes";
import { Notice, Submit } from "../DeskKit";
import { EMPTY_CODE_LIST, EMPTY_DESK_STATE } from "../state";
import { checkCodeList, saveCodeList } from "./actions";

const Code = ({ code }: { code: string }) => <span className="day-num inline-block min-w-[2.25rem] bg-day-ink px-1.5 py-0.5 text-center text-xs font-bold text-day-on-ink">{code}</span>;

function Report({ plan }: { plan: CodePlan }) {
  const changed = plan.assign.filter((row) => row.before !== row.code).length;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-day-ink">
        {plan.assign.length} matched, {changed} of them new or changed
        {plan.unmatched.length ? `, ${plan.unmatched.length} not matched` : ""}.
      </p>

      {plan.unmatched.length ? (
        <section className="space-y-2">
          <h3 className="day-label text-day-live">Not matched, so not saved</h3>
          <ul className="divide-y divide-day-line/[0.07] border border-day-live/30">
            {plan.unmatched.map((row, index) => (
              <li key={`${row.code}-${index}`} className="flex items-start gap-3 px-3 py-2 text-sm">
                <Code code={row.code} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-day-ink" dir="auto">{row.label}</span>
                  <span className="block text-day-muted">{row.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.clear.length ? (
        <p className="text-sm text-day-muted">
          Taken off teams not on the list, so no code is shown twice:{" "}
          {plan.clear.map((team) => `${team.code} from ${team.teamName}`).join(", ")}.
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="day-label">Matched</h3>
        <ul className="max-h-80 divide-y divide-day-line/[0.07] overflow-y-auto border border-day-line/[0.12]">
          {plan.assign.map((row) => (
            <li key={row.teamId} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Code code={row.code} />
              <span className="min-w-0 flex-1 truncate font-semibold text-day-ink" dir="auto">{row.teamName}</span>
              <span className="shrink-0 text-xs text-day-muted">
                {row.via === "number" ? "by phone · " : ""}
                {row.before === row.code ? "unchanged" : row.before ? `was ${row.before}` : "new"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {plan.notListed.length ? (
        <p className="text-sm text-day-muted">
          Confirmed teams not on the list, left as they are: <span dir="auto">{plan.notListed.map((team) => (team.code ? `${team.teamName} (${team.code})` : team.teamName)).join(", ")}</span>.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Every team's code in one go, from the organisers' team sheet. The sheet is
 * pasted in and checked first; nothing is saved until the second button.
 */
export function CodeImport() {
  const [check, checkAction] = useFormState(checkCodeList, EMPTY_CODE_LIST);
  const [save, saveAction] = useFormState(saveCodeList, EMPTY_DESK_STATE);

  return (
    <details className="day-card group p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-day-ink [&::-webkit-details-marker]:hidden">
        <DayIcon name="badge" className="h-4 w-4 text-day-muted" />
        Set team codes from a list
        <span className="ml-auto text-xs font-medium text-day-muted group-open:hidden">Open</span>
      </summary>

      <form action={checkAction} className="mt-4 space-y-3">
        <label htmlFor="code-list" className="block text-sm text-day-muted">
          Copy the rows from the team sheet and paste them here: the code first (A0), then the team name, then anything else on the row. Each row is matched to a team by its name, or by a member&apos;s WhatsApp number. Nothing is saved until you check the list and press Save.
        </label>
        <textarea id="code-list" name="list" rows={8} required spellCheck={false} className="day-input w-full font-mono text-sm" placeholder={"A0\tTeam name\t...\nA1\tTeam name\t..."} />
        <div className="flex flex-wrap items-center gap-3">
          <Submit pending="Checking..." variant="secondary">
            Check the list
          </Submit>
        </div>
        {check.ok ? null : <Notice state={check} />}
      </form>

      {check.plan ? (
        <div className="mt-6 space-y-4 border-t border-day-line/[0.1] pt-5">
          <Report plan={check.plan} />
          {check.plan.assign.length ? (
            <form action={saveAction} className="space-y-3">
              <input type="hidden" name="list" value={check.list} />
              <Submit pending="Saving..." variant="good">
                Save {check.plan.assign.length} code{check.plan.assign.length === 1 ? "" : "s"}
              </Submit>
              <Notice state={save} />
            </form>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
