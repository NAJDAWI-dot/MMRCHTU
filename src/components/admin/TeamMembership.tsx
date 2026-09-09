import { shortIeeeStatusLabel } from "@/lib/ieee-status";

/**
 * A team's IEEE membership numbers, on a card about their money.
 *
 * The fee tier is priced from the leader's status and nobody else's, so the
 * numbers behind a price belong on the same card as the price — checking one
 * against the other otherwise means opening the registrations list in a second
 * tab. The leader is marked for the same reason: a team whose leader is a
 * non-member pays the non-member fee however many RAS members sit behind them,
 * and that is the line to query when a tier looks wrong.
 *
 * One component rather than the same twenty lines on the list and again in the
 * review queue, which is the arrangement that ends with the two screens
 * disagreeing about the same team.
 */
export interface MembershipMember {
  id: string;
  firstName: string;
  lastName: string;
  ieeeStatus: string;
  ieeeMembershipId: string;
}

export function TeamMembership({
  members,
  className = "",
}: {
  members: readonly MembershipMember[];
  className?: string;
}) {
  return (
    <div className={`rounded-md border border-ras-gray/20 p-3 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ras-gray dark:text-white/60">
        IEEE membership
      </p>
      {members.length === 0 ? (
        <p className="mt-1 text-xs text-ras-gray dark:text-white/50">
          No members recorded on this registration.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-xs">
          {members.map((member, index) => (
            <li
              key={member.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
            >
              <span className="text-ras-gray dark:text-white/80">
                {member.firstName} {member.lastName}
                <span className="text-ras-gray/70 dark:text-white/50">
                  {" · "}
                  {shortIeeeStatusLabel(member.ieeeStatus)}
                  {index === 0 ? " · sets the tier" : ""}
                </span>
              </span>
              {/* Blank would be a hole where a number should be; the em dash
                  says the field was left empty, which is a fact about the
                  registration rather than about this card. */}
              <span className="break-all font-mono text-ras-gray dark:text-white/80">
                {member.ieeeMembershipId.trim() || "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
