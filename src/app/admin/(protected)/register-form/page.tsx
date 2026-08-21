import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getRegisterFormConfig } from "@/lib/site-config";
import { updateFormConfig } from "./actions";

export const metadata: Metadata = {
  title: "Admin — Register Form",
};

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

function toLocalInputValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function AdminRegisterFormPage() {
  const config = await getRegisterFormConfig();

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">Register Form</h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        Controls the deadline/fee copy shown on the public <code>/register</code> page and whether it accepts
        submissions. The deadline is informational only — closing registration always requires flipping the
        toggle below.
      </p>

      <Card className="mt-6">
        <form action={updateFormConfig} className="grid gap-4">
          <div>
            <label className={labelClass}>Deadline text (shown to visitors)</label>
            <input name="deadlineText" defaultValue={config.deadlineText} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Deadline date (informational only, optional)</label>
            <input
              name="deadlineDate"
              type="datetime-local"
              defaultValue={toLocalInputValue(config.deadlineDate)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Fee info text</label>
            <input name="feeInfoText" defaultValue={config.feeInfoText} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/80">
            <input type="checkbox" name="isOpen" defaultChecked={config.isOpen} />
            Registration is open
          </label>

          <fieldset className="mt-2 rounded-md border border-ras-gray/25 p-4">
            <legend className="px-1 text-sm font-semibold text-ras-purple dark:text-white">
              CliQ payment
            </legend>
            <p className="text-xs text-ras-gray dark:text-white/70">
              Shown on the public register page, with a copy button for the alias. Nothing appears
              until this is switched on <em>and</em> an alias is entered — a blank alias would send
              transfers nowhere.
            </p>

            <label className="mt-3 flex items-center gap-2 text-sm text-ras-gray dark:text-white/80">
              <input type="checkbox" name="paymentEnabled" defaultChecked={config.paymentEnabled} />
              Show CliQ payment details
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>CliQ alias or mobile number</label>
                <input name="cliqAlias" defaultValue={config.cliqAlias} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Identifier type</label>
                <select
                  name="cliqAliasType"
                  defaultValue={config.cliqAliasType}
                  className={inputClass}
                >
                  <option value="ALIAS">CliQ alias</option>
                  <option value="MOBILE">Mobile number</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Account name</label>
                <input
                  name="cliqAccountName"
                  defaultValue={config.cliqAccountName}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Bank</label>
                <input name="cliqBankName" defaultValue={config.cliqBankName} className={inputClass} />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>Extra instructions (optional)</label>
              <textarea
                name="paymentNote"
                rows={3}
                defaultValue={config.paymentNote}
                className={inputClass}
              />
            </div>
          </fieldset>

          <div>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
