"use client";

import { useEffect, useState } from "react";
import { aliasTypeLabel, isMobileAlias, type CliqDetails } from "@/lib/payment";

/**
 * How to pay the registration fee over CliQ.
 *
 * CliQ transfers are made from the payer's own banking app, so this page cannot
 * take the money — it can only make the details impossible to get wrong. The
 * alias is the part that must be copied exactly: a mistyped one either fails or,
 * worse, pays a stranger. Hence the copy button, the monospace, and the fact
 * that the alias is never wrapped or abbreviated.
 */
export function CliqPanel({ config, feeInfoText }: { config: CliqDetails; feeInfoText: string }) {
  const alias = config.cliqAlias.trim();

  return (
    <section
      aria-labelledby="cliq-heading"
      className="rounded-lg border border-ras-purple/25 bg-gradient-to-br from-ras-purple/8 via-transparent to-ras-crimson/8 p-5"
    >
      <h2
        id="cliq-heading"
        className="font-display text-lg font-bold text-ras-purple dark:text-white"
      >
        Paying the fee with CliQ
      </h2>
      <p className="mt-1 text-sm text-ras-gray dark:text-white/70">{feeInfoText}</p>

      <dl className="mt-4 space-y-3">
        <Field label={aliasTypeLabel(config.cliqAliasType)} value={alias} copyable mono />
        {config.cliqAccountName.trim() ? (
          <Field label="Account name" value={config.cliqAccountName} />
        ) : null}
        {config.cliqBankName.trim() ? <Field label="Bank" value={config.cliqBankName} /> : null}
      </dl>

      <ol className="mt-5 list-decimal space-y-1 pl-5 text-sm text-ras-gray dark:text-white/70">
        <li>
          Open your banking app and choose CliQ{" "}
          {isMobileAlias(config.cliqAliasType) ? "transfer to a mobile number" : "transfer to an alias"}.
        </li>
        {/* Spelled out rather than lowercasing the label: "CliQ" is a brand
            name and reads as a typo in lower case. */}
        <li>
          Send your team&apos;s fee to the{" "}
          {isMobileAlias(config.cliqAliasType) ? "mobile number" : "CliQ alias"} above.
        </li>
        <li>Copy the transaction reference your app gives you into the form below.</li>
      </ol>

      {config.paymentNote.trim() ? (
        <p className="mt-4 whitespace-pre-line rounded-md border border-ras-gray/20 bg-[var(--color-surface)] p-3 text-sm text-ras-gray dark:text-white/70">
          {config.paymentNote}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-ras-gray dark:text-white/60">
        You can register first and pay afterwards — send us the reference when you have it. Your
        place is only final once we have matched the payment.
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  copyable = false,
  mono = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <dt className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">
        {label}
      </dt>
      <dd
        className={`min-w-0 font-bold text-ras-purple dark:text-white ${
          mono ? "break-all font-mono text-base" : "text-sm"
        }`}
      >
        {copyable ? <CopyValue value={value} /> : value}
      </dd>
    </div>
  );
}

/**
 * The alias plus a button that copies it.
 *
 * The value stays selectable text rather than living only inside the button:
 * clipboard access is refused in some browsers and on insecure origins, and
 * someone has to be able to read and retype it when that happens.
 */
function CopyValue({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <span className="inline-flex items-center gap-2">
      <span>{value}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setState("copied");
          } catch {
            setState("failed");
          }
        }}
        className="min-h-[44px] rounded-md border border-ras-purple/40 px-2 text-xs font-semibold text-ras-purple transition-[background-color,transform] duration-200 hover:bg-ras-purple/10 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-white/30 dark:text-white dark:hover:bg-white/10"
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
      </button>
      {/* Announced rather than only coloured, so the outcome is not visual-only. */}
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy" : ""}
      </span>
    </span>
  );
}
