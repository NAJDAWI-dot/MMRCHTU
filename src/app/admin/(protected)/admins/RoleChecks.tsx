import { ADMIN_ROLES, ROLE_HINTS, ROLE_LABELS, type AdminRole } from "@/lib/roles";

/** The role checkboxes, shared by the create form and each account's row. */
export function RoleChecks({ idPrefix, selected = [] }: { idPrefix: string; selected?: readonly AdminRole[] }) {
  return (
    <fieldset>
      <legend className="block text-xs font-medium text-ras-gray dark:text-white/70">Roles</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ADMIN_ROLES.map((role) => (
          <label
            key={role}
            htmlFor={`${idPrefix}-${role}`}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-ras-gray/20 p-2.5 text-sm hover:border-ras-purple/40 dark:border-white/10"
          >
            <input
              id={`${idPrefix}-${role}`}
              type="checkbox"
              name="roles"
              value={role}
              defaultChecked={selected.includes(role)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block font-semibold text-[var(--color-fg)]">{ROLE_LABELS[role]}</span>
              <span className="block text-xs text-ras-gray dark:text-white/60">{ROLE_HINTS[role]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
