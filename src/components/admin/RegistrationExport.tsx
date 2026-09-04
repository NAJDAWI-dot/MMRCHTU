"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Getting registration data out, both ways.
 *
 * Two downloads for the two shapes the data comes in, and — behind a
 * disclosure — the instructions for pointing Excel at the same URLs so a
 * workbook keeps itself current instead of being re-exported by hand.
 *
 * The instructions live here rather than in a wiki nobody finds because the
 * one moment someone wants them is the moment they are looking at this page.
 * The token itself is never rendered: the server would have to send the
 * secret to the browser to do that, which would put it in the page source of
 * an admin screen and in any screenshot of it.
 */

const SHEETS = [
  { sheet: "teams", label: "Teams CSV", hint: "One row per team, with fees and payment state." },
  { sheet: "members", label: "Members CSV", hint: "One row per person, with contact details." },
] as const;

export function RegistrationExport({ feedConfigured }: { feedConfigured: boolean }) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="mt-4 rounded-lg border border-ras-gray/20 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-2">
        {SHEETS.map(({ sheet, label, hint }) => (
          <Button key={sheet} asChild variant="ghost" size="sm">
            <a href={`/api/registrations/export?sheet=${sheet}`} title={hint}>
              Download {label}
            </a>
          </Button>
        ))}
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="text-sm font-semibold text-accent underline"
        >
          {showHelp ? "Hide Excel setup" : "Keep an Excel file up to date"}
        </button>
      </div>

      {showHelp ? (
        <div className="mt-4 border-t border-ras-gray/15 pt-4 text-sm text-ras-gray dark:border-white/10 dark:text-white/70">
          {feedConfigured ? (
            <>
              <p>
                Excel can refresh itself from this site, so the sheet stays current without anyone
                re-exporting it. Set it up once:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  In Excel: <strong>Data → Get Data → From Web</strong>.
                </li>
                <li>
                  Paste the feed address, which is this page&rsquo;s site address followed by{" "}
                  <code className="rounded bg-ras-purple/10 px-1 font-mono text-xs dark:bg-white/10">
                    /api/registrations/export?sheet=teams&amp;token=YOUR_TOKEN
                  </code>
                  , with the token from your <code className="font-mono text-xs">.env</code>.
                </li>
                <li>
                  Choose <strong>Load</strong>, then right-click the query → <strong>Properties</strong>{" "}
                  and tick <strong>Refresh every 15 minutes</strong> and{" "}
                  <strong>Refresh data when opening the file</strong>.
                </li>
                <li>
                  Repeat with <code className="font-mono text-xs">sheet=members</code> for the
                  per-person sheet.
                </li>
              </ol>
              <p className="mt-3 rounded-md bg-ras-crimson/5 p-3 text-xs">
                <strong>Treat that address like a password.</strong> Anyone who has it can read every
                registrant&rsquo;s name, email, WhatsApp number and university without logging in — so
                keep the workbook off shared drives, and don&rsquo;t paste the address into chats or
                screenshots. Changing{" "}
                <code className="font-mono">REGISTRATIONS_EXPORT_TOKEN</code> revokes it immediately,
                and removing it switches the feed off while leaving these download buttons working.
              </p>
            </>
          ) : (
            <p>
              The self-refreshing Excel feed is switched off. To enable it, set{" "}
              <code className="rounded bg-ras-purple/10 px-1 font-mono text-xs dark:bg-white/10">
                REGISTRATIONS_EXPORT_TOKEN
              </code>{" "}
              to a random string of at least 32 characters in the site&rsquo;s environment variables,
              then reload this page for the setup steps. Until then the download buttons above are the
              way to get the data out.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
