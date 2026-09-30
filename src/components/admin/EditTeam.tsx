"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateTeam, type TeamEditState } from "@/app/admin/(protected)/registrations/actions";
import { Button } from "@/components/ui/Button";
import { IEEE_STATUS_OPTIONS, type IeeeStatus } from "@/lib/ieee-status";
import { MAX_MEMBERS } from "@/lib/team-edit";
import { UNIVERSITIES } from "@/lib/universities";

export interface EditableMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  university: string;
  major: string;
  ieeeStatus: string;
  ieeeMembershipId: string;
}

export interface EditableTeam {
  id: string;
  teamName: string;
  submitterEmail: string;
  technicalExperience: string;
  motivation: string;
  members: EditableMember[];
}

/** A row in the editor: a stored member (id set) or one added here (id empty). */
interface Row extends Omit<EditableMember, "id"> {
  key: string;
  id: string;
}

const initialState: TeamEditState = { status: "idle" };

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none aria-[invalid=true]:border-accent";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

let fresh = 0;
const blankRow = (): Row => ({
  key: `new-${++fresh}`,
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  whatsapp: "",
  university: "",
  major: "",
  ieeeStatus: "NON_MEMBER",
  ieeeMembershipId: "Non-Member",
});

/**
 * Edit a registered team in place: its details, and its members. Removing or
 * adding a member only changes the list here; nothing is written until Save,
 * and Cancel throws the whole edit away. The first member is the team leader.
 */
export function EditTeam({ team }: { team: EditableTeam }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        {saved ? (
          <span role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Saved
          </span>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
        >
          Edit team
        </Button>
      </div>
    );
  }

  return (
    <TeamForm
      team={team}
      onCancel={() => setOpen(false)}
      onSaved={() => {
        setOpen(false);
        setSaved(true);
      }}
    />
  );
}

function TeamForm({ team, onCancel, onSaved }: { team: EditableTeam; onCancel: () => void; onSaved: () => void }) {
  const [state, formAction] = useFormState(updateTeam, initialState);
  const [rows, setRows] = useState<Row[]>(() => team.members.map((m) => ({ ...m, key: m.id })));
  const removed = team.members.filter((m) => !rows.some((row) => row.id === m.id));
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    if (state.status === "saved") onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per save
  }, [state]);

  const field = (name: string) => ({
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${team.id}-${name}-error` : undefined,
  });
  const error = (name: string) =>
    errors[name] ? (
      <p id={`${team.id}-${name}-error`} className="mt-1 text-xs text-accent">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="w-full space-y-5 rounded-md border border-ras-purple/30 p-4" aria-label={`Edit ${team.teamName}`}>
      <input type="hidden" name="id" value={team.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${team.id}-teamName`}>
            Team name
          </label>
          <input ref={first} id={`${team.id}-teamName`} defaultValue={team.teamName} className={inputClass} {...field("teamName")} />
          {error("teamName")}
        </div>
        <div>
          <label className={labelClass} htmlFor={`${team.id}-submitterEmail`}>
            Contact email
          </label>
          <input id={`${team.id}-submitterEmail`} type="email" defaultValue={team.submitterEmail} className={inputClass} {...field("submitterEmail")} />
          {error("submitterEmail")}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${team.id}-technicalExperience`}>
            Experience
          </label>
          <textarea id={`${team.id}-technicalExperience`} rows={2} defaultValue={team.technicalExperience} className={inputClass} name="technicalExperience" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${team.id}-motivation`}>
            Motivation
          </label>
          <textarea id={`${team.id}-motivation`} rows={2} defaultValue={team.motivation} className={inputClass} name="motivation" />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-widest text-ras-gray dark:text-white/60">
          Members · {rows.length} of {MAX_MEMBERS}
        </legend>

        {rows.map((row, i) => {
          const p = `m.${i}.`;
          const id = (name: string) => `${team.id}-${row.key}-${name}`;
          return (
            <div key={row.key} className="rounded-md border border-ras-gray/20 p-3">
              <input type="hidden" name={`${p}id`} value={row.id} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ras-purple dark:text-white">
                  {i === 0 ? "Team leader" : `Member ${i + 1}`}
                  {row.id ? null : <span className="ml-2 text-xs font-medium text-ras-gray dark:text-white/60">New</span>}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length <= 1}
                  title={rows.length <= 1 ? "A team needs at least one member" : undefined}
                  onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}
                >
                  Remove
                </Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["firstName", "First name", "text"],
                    ["lastName", "Last name", "text"],
                    ["email", "Email", "email"],
                    ["whatsapp", "WhatsApp", "tel"],
                  ] as const
                ).map(([name, label, type]) => (
                  <div key={name}>
                    <label className={labelClass} htmlFor={id(name)}>
                      {label}
                    </label>
                    <input id={id(name)} type={type} defaultValue={row[name]} className={inputClass} {...field(p + name)} />
                    {error(p + name)}
                  </div>
                ))}
                <div>
                  <label className={labelClass} htmlFor={id("university")}>
                    University
                  </label>
                  <input id={id("university")} list={`${team.id}-universities`} defaultValue={row.university} className={inputClass} name={`${p}university`} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={id("major")}>
                    Major
                  </label>
                  <input id={id("major")} defaultValue={row.major} className={inputClass} name={`${p}major`} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={id("ieeeStatus")}>
                    IEEE status
                  </label>
                  <select id={id("ieeeStatus")} defaultValue={row.ieeeStatus as IeeeStatus} className={inputClass} name={`${p}ieeeStatus`}>
                    {IEEE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor={id("ieeeMembershipId")}>
                    IEEE ID
                  </label>
                  <input id={id("ieeeMembershipId")} defaultValue={row.ieeeMembershipId} className={inputClass} name={`${p}ieeeMembershipId`} />
                </div>
              </div>
            </div>
          );
        })}

        <datalist id={`${team.id}-universities`}>
          {UNIVERSITIES.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" size="sm" disabled={rows.length >= MAX_MEMBERS} onClick={() => setRows((all) => [...all, blankRow()])}>
            Add member
          </Button>
          {rows.length >= MAX_MEMBERS ? <span className="text-xs text-ras-gray dark:text-white/60">The team is full.</span> : null}
        </div>
      </fieldset>

      {removed.length ? (
        <p className="text-xs text-accent">
          Saving removes {removed.map((m) => `${m.firstName} ${m.lastName}`.trim()).join(", ")} from the team.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}
