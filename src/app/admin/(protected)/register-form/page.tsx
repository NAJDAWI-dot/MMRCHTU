import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getRegisterFormConfig } from "@/lib/site-config";
import { updateFormConfig } from "./actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
      <AdminPageHeader
        title="Register Form"
        subtitle={
          <>
            Controls the deadline and fee copy shown on the public <code>/register</code> page, and
            whether it accepts submissions. The deadline is informational only — closing
            registration always requires flipping the toggle below. Prices, CliQ details and the
            early-bird discount live under{" "}
            <a href="/admin/payments" className="font-semibold text-ras-purple underline dark:text-white">
              Payments
            </a>
            .
          </>
        }
      />

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

          <div>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
