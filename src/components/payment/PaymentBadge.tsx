import { PAYMENT_STATUS_LABELS, isPaymentStatus } from "@/lib/payment";

/**
 * Where a team's fee stands, as a word.
 *
 * Shared between the Payments tab, which acts on it, and the Registrations tab,
 * which only reports it — one definition so "Awaiting check" can never mean two
 * different colours on two screens. Colour carries the same meaning as the
 * words, never instead of them.
 */
export function PaymentBadge({ status }: { status: string }) {
  const known = isPaymentStatus(status) ? status : "UNPAID";
  const tone =
    known === "VERIFIED"
      ? "bg-ras-purple/15 text-ras-purple dark:bg-white/15 dark:text-white"
      : known === "SUBMITTED"
        ? "bg-[#F2A900]/20 text-[#8a6200] dark:text-[#F2A900]"
        : known === "REJECTED"
          ? "bg-ras-crimson/15 text-ras-crimson dark:text-rose-300"
          : "bg-ras-gray/15 text-ras-gray dark:text-white/60";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {PAYMENT_STATUS_LABELS[known]}
    </span>
  );
}
