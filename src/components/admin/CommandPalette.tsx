"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AdminIcon, type AdminIconName } from "@/components/admin/AdminIcons";
import { ADMIN_LINKS } from "@/lib/admin-nav";
import { type Command, rankCommands, wrapIndex } from "@/lib/command-palette";
import { PAYMENT_STATUS_LABELS, isPaymentStatus } from "@/lib/payment";

/**
 * Ctrl-K / Cmd-K, anywhere in the admin.
 *
 * Twelve sidebar items is past the point where scanning is faster than typing,
 * and the thing an admin most often wants is not a page at all — it is one
 * team, out of a hundred, whose name they already know. The palette answers
 * both with the same three keystrokes.
 *
 * Teams resolve to `/admin/registrations?q=<name>` rather than to a detail
 * page, because that filter already exists and already shows everything a team
 * row holds. The palette is a way in, not a new screen.
 *
 * Renders its own trigger as well as the dialog, so the sidebar can drop one
 * element in and get both — a shortcut with no visible affordance is a
 * shortcut only the person who wrote it will ever press.
 */

interface PaletteCommand extends Command {
  icon?: AdminIconName;
}

interface TeamHit {
  id: string;
  teamName: string;
  submitterEmail: string;
  paymentStatus: string;
}

const PAGE_COMMANDS: PaletteCommand[] = ADMIN_LINKS.map((link) => ({
  id: `page:${link.href}`,
  label: link.label,
  href: link.href,
  group: "Pages",
  keywords: link.keywords,
  icon: link.icon,
}));

/** Matches the API's own floor, so the palette never fires a request it knows returns nothing. */
const MIN_TEAM_QUERY = 2;

/** Long enough to swallow a burst of typing, short enough not to feel laggy. */
const DEBOUNCE_MS = 180;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamHit[]>([]);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  // Resolved after mount rather than during render: the server has no idea
  // what keyboard the reader has, and guessing produces a hydration mismatch.
  const [isMac, setIsMac] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // What had focus before the palette opened, so Escape puts it back rather
  // than dropping the reader at the top of the document.
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setIsMac(/mac|iphone|ipad/i.test(navigator.userAgent));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setTeams([]);
    setActive(0);
  }, []);

  // The global shortcut. Bound once, for the life of the admin session.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((wasOpen) => {
          if (wasOpen) return false;
          restoreTo.current = document.activeElement as HTMLElement | null;
          return true;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus in on open, focus back out on close, and hold the page still
  // underneath so dismissing the palette does not also lose your scroll place.
  useEffect(() => {
    if (!open) {
      restoreTo.current?.focus?.();
      return;
    }

    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Team lookup, debounced and abortable: every keystroke would otherwise be a
  // database query, and responses can arrive out of order, leaving the list
  // showing the results for a prefix of what is now in the box.
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < MIN_TEAM_QUERY) {
      setTeams([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/teams?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { teams?: TeamHit[] };
        setTeams(data.teams ?? []);
      } catch {
        // An abort is the normal path here, not a failure worth surfacing.
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const results = useMemo<PaletteCommand[]>(() => {
    const trimmed = query.trim();

    const teamCommands: PaletteCommand[] = teams.map((team) => ({
      id: `team:${team.id}`,
      label: team.teamName,
      href: `/admin/registrations?q=${encodeURIComponent(team.teamName)}`,
      group: "Teams",
      hint: `${team.submitterEmail} · ${
        isPaymentStatus(team.paymentStatus) ? PAYMENT_STATUS_LABELS[team.paymentStatus] : team.paymentStatus
      }`,
    }));

    // Always last, and only once there is something to search for: they are
    // the fallback when nothing above matched, not a suggestion.
    const actionCommands: PaletteCommand[] = trimmed
      ? [
          {
            id: "action:registrations",
            label: `Search registrations for “${trimmed}”`,
            href: `/admin/registrations?q=${encodeURIComponent(trimmed)}`,
            group: "Actions",
          },
          {
            id: "action:payments",
            label: `Search payments for “${trimmed}”`,
            href: `/admin/payments?q=${encodeURIComponent(trimmed)}`,
            group: "Actions",
          },
        ]
      : [];

    // Teams come back from the server already filtered and ordered by
    // recency, so they are not re-ranked here — only the fixed page list is.
    return [...rankCommands(PAGE_COMMANDS, trimmed), ...teamCommands, ...actionCommands];
  }, [query, teams]);

  // A new query means a new list, and holding the old row number would leave
  // the highlight on whatever happens to be in that position now.
  useEffect(() => {
    setActive(0);
  }, [query, teams]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open, results.length]);

  function go(command: PaletteCommand | undefined) {
    if (!command) return;
    close();
    router.push(command.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => wrapIndex(index + 1, results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => wrapIndex(index - 1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      // The input is the only focusable thing in the dialog — the rows are
      // driven by aria-activedescendant — so Tab has nowhere to usefully go
      // and would otherwise walk into the page behind the overlay.
      event.preventDefault();
    }
  }

  const shortcutLabel = isMac === null ? null : isMac ? "⌘K" : "Ctrl K";
  const activeId = results[active]?.id;

  const trigger = (
    <button
      type="button"
      onClick={() => {
        restoreTo.current = document.activeElement as HTMLElement | null;
        setOpen(true);
      }}
      className="flex w-full items-center gap-2 rounded-lg border border-ras-gray/25 bg-[var(--color-bg)] px-3 py-2 text-left text-sm text-ras-gray transition-colors hover:border-ras-purple/40 hover:text-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple dark:border-white/15 dark:text-white/60 dark:hover:border-white/30 dark:hover:text-white dark:focus-visible:ring-white"
    >
      <AdminIcon name="registrations" className="h-4 w-4 opacity-60" />
      <span className="flex-1">Jump to…</span>
      {shortcutLabel ? (
        <kbd className="rounded border border-ras-gray/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold dark:border-white/20">
          {shortcutLabel}
        </kbd>
      ) : null}
    </button>
  );

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-sm"
            onMouseDown={(event) => {
              // Only a press that both starts and ends on the backdrop closes
              // it — otherwise a drag that begins inside the panel and
              // releases outside dismisses the reader's own typing.
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search the admin"
              className="w-full max-w-lg overflow-hidden rounded-xl border border-ras-gray/20 bg-[var(--color-surface)] shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-ras-gray/15 px-4">
                <AdminIcon name="registrations" className="h-4 w-4 shrink-0 opacity-50" />
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="command-palette-results"
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Go to a page, or find a team…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  className="min-w-0 flex-1 bg-transparent py-4 text-base text-[var(--color-fg)] placeholder:text-ras-gray/70 focus:outline-none dark:placeholder:text-white/40"
                />
                <kbd className="hidden shrink-0 rounded border border-ras-gray/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ras-gray sm:block dark:border-white/20 dark:text-white/50">
                  esc
                </kbd>
              </div>

              <ul
                ref={listRef}
                id="command-palette-results"
                role="listbox"
                aria-label="Results"
                className="max-h-[min(60vh,26rem)] overflow-y-auto p-2"
              >
                {results.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-ras-gray dark:text-white/60">
                    Nothing matches “{query.trim()}”.
                  </li>
                ) : null}

                {results.map((command, index) => {
                  // A heading whenever the group changes, so Pages, Teams and
                  // Actions read as three lists rather than one long one.
                  const first = index === 0 || results[index - 1]!.group !== command.group;
                  const isActive = index === active;

                  return (
                    <li key={command.id}>
                      {first ? (
                        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ras-gray/70 dark:text-white/40">
                          {command.group}
                        </p>
                      ) : null}
                      <div
                        id={command.id}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        onMouseMove={() => setActive(index)}
                        onClick={() => go(command)}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
                          isActive
                            ? "bg-ras-purple text-white dark:bg-white/15"
                            : "text-ras-gray dark:text-white/70"
                        }`}
                      >
                        {command.icon ? (
                          <AdminIcon name={command.icon} className="h-4 w-4 shrink-0 opacity-70" />
                        ) : (
                          <span aria-hidden="true" className="h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{command.label}</span>
                          {command.hint ? (
                            <span
                              className={`block truncate text-xs ${
                                isActive ? "text-white/70" : "text-ras-gray/70 dark:text-white/40"
                              }`}
                            >
                              {command.hint}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {trigger}
      {dialog}
    </>
  );
}
