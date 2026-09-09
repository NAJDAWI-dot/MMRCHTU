// Split out from registration.ts so client components (RegisterForm.tsx) can
// import this constant without pulling in registration.ts's server-only
// dependency chain (prisma, email sending, env vars) into the browser bundle.
export type IeeeStatus = "IEEE_RAS_MEMBER" | "IEEE_MEMBER" | "NON_MEMBER";

export const IEEE_STATUS_OPTIONS: { value: IeeeStatus; label: string }[] = [
  { value: "IEEE_RAS_MEMBER", label: "IEEE Robotics and Automation Society (RAS) Member" },
  { value: "IEEE_MEMBER", label: "IEEE Member" },
  { value: "NON_MEMBER", label: "Non-Member" },
];

export function isIeeeStatus(value: string): value is IeeeStatus {
  return IEEE_STATUS_OPTIONS.some((option) => option.value === value);
}

/**
 * The same three statuses, said shortly.
 *
 * The picker's labels are written to be unambiguous when read once and chosen
 * from, which makes them far too long to sit in a list of three team members
 * beside a membership number. Same values, same order, different job — so they
 * live next to each other rather than one being derived from the other by
 * chopping words off.
 */
export const IEEE_STATUS_SHORT_LABELS: Record<IeeeStatus, string> = {
  IEEE_RAS_MEMBER: "RAS member",
  IEEE_MEMBER: "IEEE member",
  NON_MEMBER: "Non-member",
};

/** Falls back to the stored value, which is the honest thing to show for a row
 *  holding something these three do not cover. */
export function shortIeeeStatusLabel(value: string): string {
  return isIeeeStatus(value) ? IEEE_STATUS_SHORT_LABELS[value] : value;
}
