import { DayIcon } from "@/components/day-site/icons";
import { DeskForm, Submit } from "../DeskKit";
import { importScores, importTimings } from "./actions";

const EXPORT = "/day/hq/scoring/export";

/**
 * Scores and match timings in and out as spreadsheets, on both scoring desks.
 * Every download can be edited and uploaded again; an upload is checked in
 * full and refused whole if anything in it is wrong, so it never half-applies.
 */
export function TransferPanel({ drawn }: { drawn: boolean }) {
  return (
    <section className="day-card space-y-6 p-5 sm:p-6" aria-labelledby="transfer-title">
      <div>
        <p className="day-kicker">Spreadsheets</p>
        <h2 id="transfer-title" className="day-display mt-2 text-2xl text-day-ink">
          Import and export
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-day-muted">
          Download a file, fill it in or correct it in Excel or Google Sheets, save it as CSV and upload it here. A file with a mistake in it is refused
          with the line to fix, and nothing changes.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`${EXPORT}?file=scores`} download className="day-btn day-btn-soft day-btn-sm">
          <DayIcon name="download" className="h-4 w-4" />
          Scores (every run)
        </a>
        <a href={`${EXPORT}?file=standings`} download className="day-btn day-btn-soft day-btn-sm">
          <DayIcon name="download" className="h-4 w-4" />
          Qualifying standings
        </a>
        <a href={`${EXPORT}?file=timings`} download className="day-btn day-btn-soft day-btn-sm">
          <DayIcon name="download" className="h-4 w-4" />
          Match timings
        </a>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <DeskForm action={importScores} className="day-sunk space-y-3 p-4" resetOnSuccess>
          <p className="font-semibold text-day-ink">Import scores</p>
          <p className="text-xs text-day-muted">
            One row per run: Phase, Match (knockout only), Team, Run, Result (Success or Fail), Time (s), Cells short. Each team or match side in the file
            gets exactly those runs; everyone else is left alone. The Score column is worked out again, not read.
          </p>
          <label className="day-label" htmlFor="import-scores">
            Scores file (.csv)
          </label>
          <input id="import-scores" name="file" type="file" accept=".csv,.txt,text/csv" required className="day-input text-sm" />
          {drawn ? (
            <label className="flex items-center gap-2 text-xs text-day-muted">
              <input type="checkbox" name="clearLater" value="yes" className="h-4 w-4" />
              Clear later results if a knockout result changes who plays next
            </label>
          ) : null}
          <Submit pending="Importing…" variant="secondary" size="sm">
            <DayIcon name="upload" className="h-4 w-4" />
            Import scores
          </Submit>
        </DeskForm>

        <DeskForm action={importTimings} className="day-sunk space-y-3 p-4" resetOnSuccess>
          <p className="font-semibold text-day-ink">Import match timings</p>
          <p className="text-xs text-day-muted">
            Qualifying rows set a team&rsquo;s place in the running order and its slot time. Knockout rows (Phase and Match) set the start time and the maze.
            A blank cell clears it.
          </p>
          <label className="day-label" htmlFor="import-timings">
            Timings file (.csv)
          </label>
          <input id="import-timings" name="file" type="file" accept=".csv,.txt,text/csv" required className="day-input text-sm" />
          <Submit pending="Importing…" variant="secondary" size="sm">
            <DayIcon name="upload" className="h-4 w-4" />
            Import timings
          </Submit>
        </DeskForm>
      </div>
    </section>
  );
}
