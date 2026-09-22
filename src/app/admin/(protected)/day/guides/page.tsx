import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { requireSection, rolesOf } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { GUIDE_BODY_MAX, GUIDE_DEFAULTS, GUIDE_SLUGS } from "@/lib/day-guides";
import { ArmedForm, DeskForm, Submit, inputClass, labelClass } from "../DeskKit";
import { DeskTabs } from "../DeskTabs";
import { resetGuide, saveGuide } from "./actions";

export const metadata: Metadata = { title: "Admin | Guides" };

/** The four long pages of the day site, in plain text. */
export default async function GuidesDeskPage() {
  const admin = await requireSection("/admin/day/guides");
  const rows = await prisma.dayGuide.findMany();

  return (
    <div>
      <AdminPageHeader
        title="Guides"
        subtitle="The competitor, volunteer, organizer and venue pages. Plain text: “## ” starts a heading, “- ” a list item, and a blank line a new paragraph."
      />
      <DeskTabs roles={rolesOf(admin)} current="/admin/day/guides" />

      <div className="mt-6 space-y-6">
        {GUIDE_SLUGS.map((slug) => {
          const row = rows.find((r) => r.slug === slug);
          const fallback = GUIDE_DEFAULTS[slug];
          return (
            <Card key={slug}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">{fallback.kicker}</h2>
                <Link href={`/day/${slug}`} className="text-sm font-semibold text-accent hover:underline">
                  View on the day site →
                </Link>
              </div>
              <p className="text-xs text-ras-gray dark:text-white/55">
                {row ? `Edited ${row.updatedAt.toLocaleString("en-GB", { timeZone: "Asia/Amman" })}` : "Showing the original text"}
              </p>
              <DeskForm action={saveGuide} className="mt-3 space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <div>
                  <label className={labelClass} htmlFor={`${slug}-title`}>
                    Title
                  </label>
                  <input id={`${slug}-title`} name="title" defaultValue={row?.title ?? fallback.title} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${slug}-body`}>
                    Text
                  </label>
                  <textarea
                    id={`${slug}-body`}
                    name="body"
                    rows={14}
                    maxLength={GUIDE_BODY_MAX}
                    defaultValue={row?.body ?? fallback.body}
                    className={`${inputClass} font-mono text-[13px] leading-relaxed`}
                  />
                </div>
                <Submit pending="Saving…">Save</Submit>
              </DeskForm>
              {row ? (
                <div className="mt-3">
                  <ArmedForm
                    action={resetGuide}
                    label="Back to the original text"
                    destructive
                    confirm="Yes, put it back"
                    warning="Your edits to this guide are thrown away."
                  >
                    <input type="hidden" name="slug" value={slug} />
                  </ArmedForm>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
