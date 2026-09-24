"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crest } from "@/components/day-site/Crest";
import { DayIcon } from "@/components/day-site/icons";
import { callNext, saveMatch, saveSheet } from "@/app/day/hq/scoring/actions";
import { EMPTY_DESK_STATE, type DeskState } from "@/app/day/hq/state";
import { MATCH_SECONDS, MAZE_CELLS, formatPoints, formatTime, outcomeText, parseCell, parseRunTime, scoreSheet, type RunEntry } from "@/lib/score-sheet";

type Side = { id: string; name: string; log: RunEntry[] };

export interface JudgeData {
  mode: "qualifying" | "knockout";
  teams: (Side & { runOrder: number | null; note: string; hasSheet: boolean })[];
  /** The team the call queue has on the maze, if any. */
  onMaze: string;
  onDeck: string;
  queueActive: boolean;
  matches: { id: string; label: string; teamA: Side; teamB: Side; arena: string; time: string; decided: boolean; live: boolean }[];
}

/** A save the tablet could not send, kept until the connection is back. */
interface Pending {
  key: string;
  label: string;
  kind: "sheet" | "match";
  fields: [string, string][];
  at: number;
  error?: string;
}

const OUTBOX = "mmrc-judge-outbox";
const DRAFT = (key: string) => `mmrc-judge-draft:${key}`;
const CLOCK = "mmrc-judge-clock";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the tablet still works, it just cannot remember.
  }
};

const sameLog = (a: RunEntry[], b: RunEntry[]) => JSON.stringify(a) === JSON.stringify(b);

/** The fields the scoring actions read, for one side's runs. */
function logFields(log: RunEntry[], time: string, result: string, cell: string): [string, string][] {
  return log.flatMap((run): [string, string][] => [
    [time, run.ok && run.time !== null ? String(run.time) : ""],
    [result, run.ok ? "yes" : "no"],
    [cell, !run.ok && run.cell !== null ? String(run.cell) : ""],
  ]);
}

const formDataOf = (fields: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of fields) data.append(name, value);
  return data;
};

// ---------------------------------------------------------------- the clock

/** The eight minutes, kept on the tablet so a reload does not reset them. */
function useMatchClock() {
  const [clock, setClock] = useState<{ left: number; since: number | null }>({ left: MATCH_SECONDS * 1000, since: null });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setClock(read(CLOCK, { left: MATCH_SECONDS * 1000, since: null })), []);
  useEffect(() => {
    if (clock.since === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [clock.since]);
  const left = Math.max(0, clock.since === null ? clock.left : clock.left - (now - clock.since));
  const update = (next: { left: number; since: number | null }) => {
    setClock(next);
    write(CLOCK, next);
  };
  return {
    left,
    running: clock.since !== null && left > 0,
    start: () => clock.since === null && left > 0 && update({ left, since: Date.now() }),
    pause: () => clock.since !== null && update({ left, since: null }),
    reset: () => update({ left: MATCH_SECONDS * 1000, since: null }),
  };
}

function Clock({ clock }: { clock: ReturnType<typeof useMatchClock> }) {
  const minutes = Math.floor(clock.left / 60000);
  const seconds = Math.floor((clock.left % 60000) / 1000);
  const low = clock.left < 60000;
  const done = clock.left === 0;
  return (
    <div className={`flex items-center gap-4 rounded-3xl px-5 py-3 ring-1 ${done ? "bg-day-live/15 ring-day-live/40" : "bg-day-sunk ring-day-line/[0.08]"}`}>
      <span
        className={`day-num day-display text-5xl tabular-nums sm:text-6xl ${low ? "text-day-live" : "text-day-ink"}`}
        aria-label={`Match time left: ${minutes} minutes ${seconds} seconds`}
        role="timer"
      >
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={clock.running ? clock.pause : clock.start} disabled={done} className="day-btn day-btn-ink day-btn-sm min-w-[7rem]">
          {clock.running ? "Pause" : clock.left === MATCH_SECONDS * 1000 ? "Start 8 min" : done ? "Time" : "Resume"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (clock.left === MATCH_SECONDS * 1000 || window.confirm("Reset the match clock to 8:00?")) clock.reset();
          }}
          className="day-btn day-btn-soft day-btn-sm"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ the number pad

function Pad({
  kind,
  title,
  onDone,
  onCancel,
}: {
  kind: "cell" | "time";
  title: string;
  onDone: (value: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const value = kind === "cell" ? parseCell(text) : parseRunTime(text);
  const press = (key: string) =>
    setText((current) => {
      if (key === "back") return current.slice(0, -1);
      if (key === "." && (kind === "cell" || current.includes("."))) return current;
      const next = current + key;
      return next.length > (kind === "cell" ? 2 : 7) ? current : next;
    });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[0-9.]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("back");
      else if (event.key === "Enter" && value !== null) onDone(value);
      else if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", kind === "time" ? "." : "", "0", "back"];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-day-ink/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="day-card w-full max-w-sm space-y-4 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="day-display text-2xl text-day-ink">{title}</p>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="grid h-10 w-10 place-items-center rounded-xl text-day-faint hover:bg-day-ink/[0.06]">
            <DayIcon name="close" className="h-5 w-5" />
          </button>
        </div>
        <p
          className={`day-num day-display rounded-2xl px-4 py-3 text-right text-5xl ring-1 ${
            text && value === null ? "bg-day-live/10 text-day-live ring-day-live/40" : "bg-day-sunk text-day-ink ring-day-line/[0.08]"
          }`}
          aria-live="polite"
        >
          {text || (kind === "cell" ? "–" : "0.00")}
          <span className="ml-2 text-lg text-day-muted">{kind === "cell" ? `of ${MAZE_CELLS}` : "s"}</span>
        </p>
        <p className="text-xs text-day-muted">
          {kind === "cell" ? `The cell the mouse reached, 1 to ${MAZE_CELLS - 1}. Cell ${MAZE_CELLS} is the centre.` : "The run's time in seconds, like 25.41."}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {keys.map((key, index) =>
            key ? (
              <button
                key={index}
                type="button"
                onClick={() => press(key)}
                aria-label={key === "back" ? "Delete" : key}
                className="day-num grid h-16 place-items-center rounded-2xl bg-day-ink/[0.05] text-2xl font-semibold text-day-ink transition-colors active:bg-day-ink/15"
              >
                {key === "back" ? <DayIcon name="back" className="h-6 w-6" /> : key}
              </button>
            ) : (
              <span key={index} />
            ),
          )}
        </div>
        <button type="button" disabled={value === null} onClick={() => value !== null && onDone(value)} className="day-btn day-btn-ink h-14 w-full text-lg disabled:opacity-40">
          <DayIcon name="check" className="h-5 w-5" />
          {kind === "cell" ? (value !== null ? `Cell ${value}` : "Enter the cell") : value !== null ? formatTime(value) : "Enter the time"}
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- one side

function SideRecorder({
  side,
  log,
  setLog,
  onStartRun,
  compact,
}: {
  side: Side;
  log: RunEntry[];
  setLog: (log: RunEntry[]) => void;
  onStartRun: () => void;
  compact: boolean;
}) {
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [pad, setPad] = useState<null | { kind: "cell" | "time" }>(null);
  const [armed, setArmed] = useState<number | null>(null);
  useEffect(() => {
    if (started === null) return;
    const timer = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(timer);
  }, [started]);

  const sheet = scoreSheet({ times: [], remaining: null, log });
  const officialIndex = sheet.official === null ? -1 : log.findIndex((run) => run.ok && run.time === sheet.official);
  const elapsed = started === null ? 0 : (now - started) / 1000;

  const start = () => {
    const t = performance.now();
    setStarted(t);
    setNow(t);
    onStartRun();
  };
  const reached = () => {
    if (started === null) return setPad({ kind: "time" });
    const seconds = Math.round((performance.now() - started) / 10) / 100;
    setStarted(null);
    if (seconds > 0) setLog([...log, { ok: true, time: seconds, cell: null }]);
  };
  const failed = () => {
    setStarted(null);
    setPad({ kind: "cell" });
  };

  return (
    <section className="day-card flex min-w-0 flex-col gap-5 p-5 sm:p-6" aria-label={side.name}>
      <div className="flex items-center gap-4">
        <Crest name={side.name} size={compact ? 36 : 48} />
        <div className="min-w-0">
          <p className="day-kicker">{compact ? "Side" : "On the maze"}</p>
          <h2 className={`day-display truncate text-day-ink ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>{side.name}</h2>
        </div>
      </div>

      {/* The big buttons. */}
      {started === null ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          <button type="button" onClick={start} className="day-btn day-btn-ink h-20 text-xl">
            <DayIcon name="timer" className="h-6 w-6" />
            Start run {log.length + 1}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={reached} className="day-btn h-14 bg-day-good/15 text-base font-semibold text-day-good hover:bg-day-good/25">
              <DayIcon name="check" className="h-5 w-5" />
              Reached, type time
            </button>
            <button type="button" onClick={failed} className="day-btn h-14 bg-day-live/10 text-base font-semibold text-day-live hover:bg-day-live/20">
              <DayIcon name="close" className="h-5 w-5" />
              Failed
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="day-num day-display text-center text-6xl tabular-nums text-day-ink sm:text-7xl" role="timer" aria-live="off">
            {elapsed.toFixed(2)}
            <span className="ml-1 text-2xl text-day-muted">s</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={reached} className="day-btn h-24 bg-day-good text-xl font-bold text-day-on-ink hover:bg-day-good/90">
              <DayIcon name="check" className="h-7 w-7" />
              Reached the centre
            </button>
            <button type="button" onClick={failed} className="day-btn h-24 bg-day-live text-xl font-bold text-day-on-ink hover:bg-day-live/90">
              <DayIcon name="close" className="h-7 w-7" />
              Failed
            </button>
          </div>
          <button type="button" onClick={() => setStarted(null)} className="day-btn day-btn-soft day-btn-sm mx-auto flex">
            Cancel this run
          </button>
        </div>
      )}

      {/* The runs so far. */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-day-muted">{log.length ? `${outcomeText(sheet)} · tap a run twice to remove it` : "No runs yet"}</p>
        <ol className="flex flex-wrap gap-2" aria-label="Runs">
          {log.map((run, index) => {
            const best = index === officialIndex;
            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => {
                    if (armed === index) {
                      setLog(log.filter((_, i) => i !== index));
                      setArmed(null);
                    } else setArmed(index);
                  }}
                  onBlur={() => setArmed((current) => (current === index ? null : current))}
                  className={`day-num inline-flex h-11 items-center gap-2 rounded-xl px-3 text-base font-semibold ring-1 transition-colors ${
                    armed === index
                      ? "bg-day-live text-day-on-ink ring-day-live"
                      : run.ok
                        ? best
                          ? "bg-day-gold/15 text-day-gold ring-day-gold/40"
                          : "bg-day-good/10 text-day-good ring-day-good/25"
                        : "bg-day-live/10 text-day-live ring-day-live/25"
                  }`}
                  aria-label={`Run ${index + 1}: ${run.ok ? `reached the centre in ${formatTime(run.time)}` : `failed${run.cell !== null ? ` at cell ${run.cell}` : ""}`}${armed === index ? ". Tap again to remove it" : ""}`}
                >
                  <span className="text-[11px] opacity-70">R{index + 1}</span>
                  {armed === index ? "Remove?" : run.ok ? formatTime(run.time) : run.cell !== null ? `✗ Cell ${run.cell}` : "✗"}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3 rounded-2xl bg-day-ink p-4 text-day-on-ink" aria-live="polite">
        <div>
          <p className="text-[11px] font-semibold opacity-60">Successful</p>
          <p className="day-num day-display mt-1 text-2xl">
            {sheet.runs}
            {sheet.failed ? <span className="opacity-60"> / {sheet.runs + sheet.failed}</span> : null}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold opacity-60">Official</p>
          <p className="day-num day-display mt-1 text-2xl">{formatTime(sheet.official)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold opacity-60">Score</p>
          <p className="day-num day-display mt-1 text-3xl">{formatPoints(sheet.score)}</p>
        </div>
      </div>

      {pad ? (
        <Pad
          kind={pad.kind}
          title={pad.kind === "cell" ? `Run ${log.length + 1} failed: which cell?` : `Run ${log.length + 1}: its time`}
          onCancel={() => setPad(null)}
          onDone={(value) => {
            setLog([...log, pad.kind === "cell" ? { ok: false, time: null, cell: value } : { ok: true, time: value, cell: null }]);
            setPad(null);
          }}
        />
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------- the tablet

export function JudgeTablet({ data }: { data: JudgeData }) {
  const router = useRouter();
  const clock = useMatchClock();
  const knockout = data.mode === "knockout";

  const known = (id: string) => data.teams.some((item) => item.id === id);
  const firstTeam = (known(data.onMaze) && data.onMaze) || data.teams.find((item) => !item.hasSheet)?.id || data.teams[0]?.id || "";
  const [teamId, setTeamId] = useState(firstTeam);
  const [matchId, setMatchId] = useState(data.matches.find((match) => !match.decided)?.id ?? data.matches[0]?.id ?? "");
  const team = data.teams.find((item) => item.id === teamId);
  const match = data.matches.find((item) => item.id === matchId);
  const key = knockout ? `match:${matchId}` : `sheet:${teamId}`;
  const serverLogs = useMemo(
    () => (knockout ? (match ? [match.teamA.log, match.teamB.log] : []) : team ? [team.log] : []),
    [knockout, match, team],
  );

  // The runs on screen, with the team or match they belong to, so switching
  // never files one team's runs under another's name.
  const [sheet, setSheet] = useState<{ key: string; logs: RunEntry[][] }>({ key, logs: serverLogs });
  const logs = sheet.key === key ? sheet.logs : serverLogs;
  const setLogs = (update: (current: RunEntry[][]) => RunEntry[][]) => setSheet((current) => ({ key, logs: update(current.key === key ? current.logs : serverLogs) }));
  const [restored, setRestored] = useState(false);
  const [state, setState] = useState<DeskState>(EMPTY_DESK_STATE);
  const [busy, setBusy] = useState(false);
  const [tie, setTie] = useState(false);
  const [outbox, setOutbox] = useState<Pending[]>([]);
  const [online, setOnline] = useState(true);
  const dirty = logs.some((log, index) => !sameLog(log, serverLogs[index] ?? []));

  // Switching team or match: its unsaved runs on this tablet, or what the server has.
  useEffect(() => {
    const draft = read<RunEntry[][] | null>(DRAFT(key), null);
    const useDraft = !!draft && draft.length === serverLogs.length && draft.some((log, i) => !sameLog(log, serverLogs[i] ?? []));
    setSheet({ key, logs: useDraft ? draft! : serverLogs });
    setRestored(useDraft);
    setTie(false);
    setState(EMPTY_DESK_STATE);
  }, [key, serverLogs]);

  // Every change is kept on the tablet until it is saved.
  useEffect(() => {
    if (sheet.key === key) write(DRAFT(key), dirty ? logs : null);
  }, [key, sheet.key, logs, dirty]);

  // Follow the call queue while nothing unsaved is on the screen.
  useEffect(() => {
    if (!knockout && known(data.onMaze) && data.onMaze !== teamId && !dirty) setTeamId(data.onMaze);
    // Only when the queue moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.onMaze]);

  // --------------------------------------------------- saving, and the outbox
  const saveOutbox = (items: Pending[]) => {
    setOutbox(items);
    write(OUTBOX, items.length ? items : null);
  };
  useEffect(() => {
    setOutbox(read<Pending[]>(OUTBOX, []));
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const send = useCallback(async (item: Pending): Promise<DeskState> => {
    const form = formDataOf(item.fields);
    return item.kind === "sheet" ? saveSheet(EMPTY_DESK_STATE, form) : saveMatch(EMPTY_DESK_STATE, form);
  }, []);

  const flush = useCallback(async () => {
    const items = read<Pending[]>(OUTBOX, []);
    if (!items.length) return;
    const left: Pending[] = [];
    for (const item of items) {
      try {
        const result = await send(item);
        if (!result.ok) left.push({ ...item, error: result.message ?? "Refused" });
      } catch {
        left.push(item);
      }
    }
    saveOutbox(left);
    if (left.length < items.length) router.refresh();
  }, [router, send]);

  useEffect(() => {
    if (!online || !outbox.length) return;
    void flush();
    const timer = window.setInterval(() => void flush(), 15_000);
    return () => window.clearInterval(timer);
  }, [online, outbox.length, flush]);

  const fieldsFor = (winnerId = ""): [string, string][] | null => {
    if (!knockout && team) return [["teamId", team.id], ...logFields(logs[0] ?? [], "time", "result", "cell"), ["note", team.note]];
    if (knockout && match)
      return [
        ["id", match.id],
        ...logFields(logs[0] ?? [], "timesA", "resultA", "cellA"),
        ...logFields(logs[1] ?? [], "timesB", "resultB", "cellB"),
        ["winnerId", winnerId],
        ["status", "PENDING"],
        ["arena", match.arena],
        ["time", match.time],
      ];
    return null;
  };

  const save = async (winnerId = "") => {
    const fields = fieldsFor(winnerId);
    if (!fields) return;
    const item: Pending = { key, label: knockout ? (match?.label ?? "") : (team?.name ?? ""), kind: knockout ? "match" : "sheet", fields, at: Date.now() };
    setBusy(true);
    try {
      const result = await send(item);
      setState(result);
      if (result.ok) {
        write(DRAFT(key), null);
        setTie(false);
        router.refresh();
      } else if (knockout && /level on everything/.test(result.message ?? "")) {
        setTie(true);
      }
    } catch {
      // No connection: keep it on the tablet and send it when there is one.
      saveOutbox([...read<Pending[]>(OUTBOX, []).filter((pending) => pending.key !== key), item]);
      write(DRAFT(key), null);
      setState({ ok: true, message: "No connection. Saved on this tablet; it sends by itself when the connection is back." });
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    setBusy(true);
    try {
      const result = await callNext(EMPTY_DESK_STATE, new FormData());
      setState(result);
      if (result.ok) {
        clock.reset();
        router.refresh();
      }
    } catch {
      setState({ ok: false, message: "No connection. Call the next team from the scoring desk, or try again." });
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------ keep the screen awake
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => {
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock && document.visibilityState === "visible") lock.current = await nav.wakeLock.request("screen");
      } catch {
        // Not allowed here: the tablet's own settings decide.
      }
    };
    void request();
    const again = () => void request();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock.current?.release().catch(() => {});
    };
  }, []);

  const sides: Side[] = knockout ? (match ? [match.teamA, match.teamB] : []) : team ? [team] : [];

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b border-day-line/[0.08] bg-day-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-day-crimson/10 text-day-crimson">
              <DayIcon name="flag" className="h-5 w-5" />
            </span>
            <div>
              <p className="day-display text-xl leading-none text-day-ink">Judge</p>
              <p className="text-xs font-semibold text-day-muted">{knockout ? "Knockout" : "Phase 1 · Qualifying"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${online ? "bg-day-good/10 text-day-good" : "bg-day-live/10 text-day-live"}`}
              role="status"
            >
              <span className={`h-2 w-2 rounded-full ${online ? "bg-day-good" : "bg-day-live"}`} aria-hidden="true" />
              {online ? "Online" : "Offline"}
              {outbox.length ? ` · ${outbox.length} waiting to send` : ""}
            </span>
            <button
              type="button"
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
              className="day-btn day-btn-soft day-btn-sm"
            >
              <DayIcon name="expand" className="h-4 w-4" />
              Full screen
            </button>
            <Link href={knockout ? "/day/hq/scoring/bracket" : "/day/hq/scoring"} className="day-btn day-btn-soft day-btn-sm">
              Desk
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <label className="day-label" htmlFor="judge-pick">
              {knockout ? "Match" : "Team"}
            </label>
            {knockout ? (
              <select id="judge-pick" value={matchId} onChange={(event) => setMatchId(event.target.value)} className="day-input h-14 max-w-xl text-lg">
                {data.matches.length ? null : <option value="">No match ready</option>}
                {data.matches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.live ? "● " : item.decided ? "✓ " : ""}
                    {item.label}: {item.teamA.name} v {item.teamB.name}
                    {item.arena ? ` · ${item.arena}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <select id="judge-pick" value={teamId} onChange={(event) => setTeamId(event.target.value)} className="day-input h-14 max-w-xl text-lg">
                {data.teams.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id === data.onMaze ? "● " : item.hasSheet ? "✓ " : ""}
                    {item.runOrder ? `#${item.runOrder} ` : ""}
                    {item.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Clock clock={clock} />
        </div>

        {restored ? (
          <p className="rounded-2xl bg-day-gold/10 px-4 py-3 text-sm font-semibold text-day-ink ring-1 ring-day-gold/30" role="status">
            Unsaved runs from this tablet are back on the sheet. Save them, or remove them.
          </p>
        ) : null}

        {sides.length ? (
          <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 ${knockout ? "lg:grid-cols-2" : ""}`}>
            {sides.map((side, index) => (
              <SideRecorder
                key={`${key}:${side.id}`}
                side={side}
                compact={knockout}
                log={logs[index] ?? []}
                setLog={(log) => setLogs((current) => current.map((item, i) => (i === index ? log : item)))}
                onStartRun={clock.start}
              />
            ))}
          </div>
        ) : (
          <p className="day-card p-8 text-center text-day-muted">{knockout ? "No match is ready to be played." : "No team is ready to run."}</p>
        )}

        {sides.length ? (
          <div className="day-card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
            <div className="min-w-0 flex-1 space-y-2" aria-live="polite">
              {state.message ? (
                <p className={`text-sm font-semibold ${state.ok ? "text-day-good" : "text-day-live"}`} role="status">
                  {state.message}
                </p>
              ) : (
                <p className="text-sm text-day-muted">{dirty ? "Unsaved changes on this tablet." : "Saved. The standings and the hall screen have it."}</p>
              )}
              {tie && match ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void save(match.teamA.id)} className="day-btn day-btn-soft">
                    {match.teamA.name} goes through
                  </button>
                  <button type="button" disabled={busy} onClick={() => void save(match.teamB.id)} className="day-btn day-btn-soft">
                    {match.teamB.name} goes through
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {!knockout && data.queueActive ? (
                <button type="button" disabled={busy || dirty} onClick={() => void next()} className="day-btn day-btn-soft h-14 px-5 text-base" title={dirty ? "Save first" : undefined}>
                  Call the next team
                  <DayIcon name="arrow" className="h-5 w-5" />
                </button>
              ) : null}
              <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="day-btn day-btn-ink h-14 px-8 text-lg">
                <DayIcon name="check" className="h-5 w-5" />
                {busy ? "Saving…" : knockout ? "Save the result" : "Save the sheet"}
              </button>
            </div>
          </div>
        ) : null}

        {outbox.length ? (
          <section className="day-card space-y-2 p-4 sm:p-5" aria-label="Waiting to send">
            <p className="font-semibold text-day-ink">Waiting to send</p>
            <ul className="space-y-1 text-sm">
              {outbox.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-day-ink">
                    {item.label}
                    <span className="text-day-muted"> · {new Date(item.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  {item.error ? <span className="text-xs font-semibold text-day-live">Not accepted: {item.error}</span> : <span className="text-xs text-day-muted">Sends when online</span>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" onClick={() => void flush()} className="day-btn day-btn-soft day-btn-sm">
                Try now
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Forget everything waiting to send? It will not be saved.")) saveOutbox([]);
                }}
                className="day-btn day-btn-danger day-btn-sm"
              >
                Discard
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
