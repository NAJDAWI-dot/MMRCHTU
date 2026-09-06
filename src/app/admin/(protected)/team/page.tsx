import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/photo-storage";
import {
  COMMITTEE_RANKS,
  COMMITTEE_RANK_HINTS,
  COMMITTEE_RANK_LABELS,
  buildRoster,
  initials,
  rosterSize,
} from "@/lib/roster";
import { PortraitUploader } from "./PortraitUploader";
import {
  createDepartment,
  createMember,
  deleteDepartment,
  deleteMember,
  removeMemberPhoto,
  updateDepartment,
  updateMember,
} from "./actions";

export const metadata: Metadata = {
  title: "Admin — Team",
};

/**
 * The committee, as data.
 *
 * Laid out in the order the public page reads: leadership, then each
 * department, then anyone not in one. Editing somebody where you see them beats
 * a flat alphabetical table that gives no sense of the structure being built —
 * and the structure is the whole point of this screen.
 */

const FIELD =
  "w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-fg)] transition-colors focus-visible:border-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:focus-visible:border-white dark:focus-visible:ring-white/30";
const LABEL = "block text-xs font-medium text-ras-gray dark:text-white/60";

interface DepartmentOption {
  id: string;
  name: string;
}

function DepartmentSelect({
  departments,
  value,
  disabled,
}: {
  departments: readonly DepartmentOption[];
  value: string | null;
  disabled?: boolean;
}) {
  return (
    <select name="departmentId" defaultValue={value ?? ""} className={FIELD} disabled={disabled}>
      <option value="">— none —</option>
      {departments.map((department) => (
        <option key={department.id} value={department.id}>
          {department.name}
        </option>
      ))}
    </select>
  );
}

type MemberRecord = {
  id: string;
  name: string;
  role: string;
  rank: string;
  departmentId: string | null;
  photoUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
};

function MemberRow({
  member,
  departments,
}: {
  member: MemberRecord;
  departments: readonly DepartmentOption[];
}) {
  return (
    <li className="rounded-lg border border-ras-gray/20 bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="shrink-0">
          {member.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- blob-stored portrait; no optimisation to gain on a 56px circle */
            <img
              src={member.photoUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid h-14 w-14 place-items-center rounded-full bg-ras-purple/10 font-display text-sm font-bold text-ras-purple dark:bg-white/10 dark:text-white"
            >
              {initials(member.name)}
            </span>
          )}
        </div>

        <form action={updateMember} className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <input type="hidden" name="id" value={member.id} />

          <div>
            <label className={LABEL}>Name</label>
            <input name="name" defaultValue={member.name} required className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Role as written on the page</label>
            <input
              name="role"
              defaultValue={member.role}
              placeholder="Head of Logistics"
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Rank</label>
            <select name="rank" defaultValue={member.rank} className={FIELD}>
              {COMMITTEE_RANKS.map((rank) => (
                <option key={rank} value={rank}>
                  {COMMITTEE_RANK_LABELS[rank]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Department</label>
            {/* The chair and co-chair sit above the departments whatever this
                says, so it is offered but does not change where they appear. */}
            <DepartmentSelect departments={departments} value={member.departmentId} />
          </div>
          <div>
            <label className={LABEL}>Order</label>
            <input
              name="sortOrder"
              type="number"
              defaultValue={member.sortOrder}
              className={FIELD}
            />
          </div>
          <div className="flex items-end justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/80">
              <input type="checkbox" name="isPublished" defaultChecked={member.isPublished} />
              Show on the site
            </label>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ras-gray/15 pt-3">
        <PortraitUploader memberId={member.id} hasPhoto={Boolean(member.photoUrl)} />
        {member.photoUrl ? (
          <form action={removeMemberPhoto}>
            <input type="hidden" name="id" value={member.id} />
            <Button type="submit" variant="ghost" size="sm">
              Remove photo
            </Button>
          </form>
        ) : null}
        <span className="flex-1" />
        <form action={deleteMember}>
          <input type="hidden" name="id" value={member.id} />
          <Button type="submit" variant="destructive" size="sm">
            Remove from committee
          </Button>
        </form>
      </div>
    </li>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="font-display text-base font-bold text-ras-purple dark:text-white">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-ras-gray dark:text-white/60">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function AdminTeamPage() {
  const [departments, members] = await Promise.all([
    prisma.committeeDepartment.findMany(),
    prisma.committeeMember.findMany(),
  ]);

  const roster = buildRoster(departments, members);
  const options: DepartmentOption[] = roster.groups.map((group) => ({
    id: group.department.id,
    name: group.department.name,
  }));
  const hidden = members.filter((member) => !member.isPublished).length;
  const storage = isStorageConfigured();

  return (
    <div>
      <AdminPageHeader
        title="Team"
        subtitle={`${rosterSize(roster)} on the committee · ${departments.length} ${
          departments.length === 1 ? "department" : "departments"
        }${hidden > 0 ? ` · ${hidden} hidden` : ""}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <a href="/team" target="_blank" rel="noopener noreferrer">
              View the page ↗
            </a>
          </Button>
        }
      />

      {!storage ? (
        <p className="mt-4 rounded-md border border-ras-crimson/30 bg-ras-crimson/5 p-3 text-sm text-ras-gray dark:text-white/70">
          This deployment cannot see a photo storage token, so portrait uploads will probably
          fail. Everything else on this page works. If you have just created the Blob store,
          redeploy — Vercel captures environment variables when a deployment is built.
        </p>
      ) : null}

      {/* Departments first, because a member cannot be filed into one that
          does not exist yet, and that is the order somebody sets this up in. */}
      <Section
        title="Departments"
        hint="Deleting one does not delete its people — they move to “Not in a department” until you reassign them."
      >
        <div className="space-y-2">
          {roster.groups.map((group) => (
            <Card key={group.department.id} className="p-3">
              <form action={updateDepartment} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto_auto]">
                <input type="hidden" name="id" value={group.department.id} />
                <input
                  name="name"
                  defaultValue={group.department.name}
                  required
                  aria-label={`Name of ${group.department.name}`}
                  className={FIELD}
                />
                <input
                  name="description"
                  defaultValue={group.department.description}
                  placeholder="One line, shown under the heading"
                  aria-label={`Description of ${group.department.name}`}
                  className={FIELD}
                />
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={group.department.sortOrder}
                  aria-label={`Order of ${group.department.name}`}
                  className={`${FIELD} w-20`}
                />
                <Button type="submit" size="sm">
                  Save
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-ras-gray dark:text-white/60">
                  {group.heads.length + group.members.length === 0
                    ? "Nobody in this department yet."
                    : `${group.heads.length + group.members.length} ${
                        group.heads.length + group.members.length === 1 ? "person" : "people"
                      }`}
                </p>
                <form action={deleteDepartment}>
                  <input type="hidden" name="id" value={group.department.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    Delete department
                  </Button>
                </form>
              </div>
            </Card>
          ))}

          <Card className="p-3">
            <form action={createDepartment} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto_auto]">
              <input name="name" required placeholder="New department" aria-label="New department name" className={FIELD} />
              <input name="description" placeholder="One line (optional)" aria-label="New department description" className={FIELD} />
              <input name="sortOrder" type="number" defaultValue={departments.length} aria-label="New department order" className={`${FIELD} w-20`} />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          </Card>
        </div>
      </Section>

      <Section title="Add someone">
        <Card className="p-3">
          <form action={createMember} className="grid gap-2 sm:grid-cols-4">
            <input name="name" required placeholder="Full name" aria-label="New member name" className={FIELD} />
            <input name="role" placeholder="Role (e.g. Designer)" aria-label="New member role" className={FIELD} />
            <select name="rank" defaultValue="MEMBER" aria-label="New member rank" className={FIELD}>
              {COMMITTEE_RANKS.map((rank) => (
                <option key={rank} value={rank}>
                  {COMMITTEE_RANK_LABELS[rank]}
                </option>
              ))}
            </select>
            <DepartmentSelect departments={options} value={null} />
            <div className="sm:col-span-4">
              <Button type="submit" size="sm">
                Add to the committee
              </Button>
              <span className="ms-3 text-xs text-ras-gray dark:text-white/60">
                A photo can be added once they are on the list.
              </span>
            </div>
          </form>
        </Card>
      </Section>

      <Section
        title="Chair and co-chair"
        hint={COMMITTEE_RANK_HINTS.CHAIR}
      >
        {roster.leadership.length === 0 ? (
          <p className="text-sm text-ras-gray dark:text-white/60">
            Nobody has the Chair or Co-Chair rank yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {roster.leadership.map((member) => (
              <MemberRow key={member.id} member={member} departments={options} />
            ))}
          </ul>
        )}
      </Section>

      {roster.groups.map((group) => (
        <Section
          key={group.department.id}
          title={group.department.name}
          hint={group.department.description || undefined}
        >
          {group.heads.length + group.members.length === 0 ? (
            <p className="text-sm text-ras-gray dark:text-white/60">
              Nobody in this department yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {[...group.heads, ...group.members].map((member) => (
                <MemberRow key={member.id} member={member} departments={options} />
              ))}
            </ul>
          )}
        </Section>
      ))}

      {roster.unassigned.length > 0 ? (
        <Section
          title="Not in a department"
          hint="These people are on the committee but sit under no department — usually because one was deleted. They appear at the bottom of the public page until reassigned."
        >
          <ul className="space-y-3">
            {roster.unassigned.map((member) => (
              <MemberRow key={member.id} member={member} departments={options} />
            ))}
          </ul>
        </Section>
      ) : null}

      {members.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="font-display text-lg font-bold text-ras-purple dark:text-white">
            No committee yet
          </p>
          <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
            Add a department or two, then add people to them. The Team page stays out of the site
            menu until somebody on it is published.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
