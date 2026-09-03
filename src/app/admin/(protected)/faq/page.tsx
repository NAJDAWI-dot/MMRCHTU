import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createFaqEntry, updateFaqEntry, deleteFaqEntry, replyToQuestion, promoteQuestion } from "./actions";

export const metadata: Metadata = {
  title: "Admin — FAQ",
};

const inputClass =
  "mt-1 w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const labelClass = "block text-xs font-medium text-ras-gray dark:text-white/70";

export default async function AdminFaqPage() {
  const [entries, questions] = await Promise.all([
    prisma.faqEntry.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.faqQuestion.findMany({ where: { status: { not: "PROMOTED" } }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-ras-purple dark:text-white">FAQ</h1>

      <section className="mt-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Visitor questions
        </h2>
        <div className="mt-3 space-y-4">
          {questions.length === 0 ? (
            <p className="text-sm text-ras-gray dark:text-white/70">No open questions.</p>
          ) : null}
          {questions.map((q) => (
            <Card key={q.id}>
              <p className="font-semibold text-ras-purple dark:text-white">{q.question}</p>
              {q.askerEmail ? (
                <p className="mt-1 text-xs text-ras-gray dark:text-white/60">From: {q.askerEmail}</p>
              ) : null}
              {q.reply ? (
                <p className="mt-2 rounded-md bg-ras-purple/5 p-3 text-sm text-ras-gray dark:bg-white/5 dark:text-white/80">
                  Reply: {q.reply}
                </p>
              ) : null}
              <form action={replyToQuestion} className="mt-3">
                <input type="hidden" name="id" value={q.id} />
                <label className={labelClass}>Reply</label>
                <textarea name="reply" defaultValue={q.reply ?? ""} rows={2} className={inputClass} />
                <Button type="submit" className="mt-2">
                  Save reply
                </Button>
              </form>
              {q.reply ? (
                <form action={promoteQuestion} className="mt-2">
                  <input type="hidden" name="id" value={q.id} />
                  <Button type="submit" variant="ghost">
                    Promote to public FAQ
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ras-gray dark:text-white/70">
          Published FAQ entries
        </h2>
        <Card className="mt-3">
          <form action={createFaqEntry} className="grid gap-3">
            <div>
              <label className={labelClass}>Question</label>
              <input name="question" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Answer</label>
              <textarea name="answer" required rows={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Sort order</label>
              <input name="sortOrder" type="number" defaultValue={entries.length} className={inputClass} />
            </div>
            <div>
              <Button type="submit">Add FAQ entry</Button>
            </div>
          </form>
        </Card>

        <div className="mt-4 space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <form action={updateFaqEntry} className="grid gap-3">
                <input type="hidden" name="id" value={entry.id} />
                <div>
                  <label className={labelClass}>Question</label>
                  <input name="question" defaultValue={entry.question} required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Answer</label>
                  <textarea name="answer" defaultValue={entry.answer} required rows={2} className={inputClass} />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className={labelClass}>Sort order</label>
                    <input name="sortOrder" type="number" defaultValue={entry.sortOrder} className={inputClass} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ras-gray dark:text-white/80">
                    <input type="checkbox" name="isPublished" defaultChecked={entry.isPublished} />
                    Published
                  </label>
                </div>
                <div>
                  <Button type="submit">Save</Button>
                </div>
              </form>
              <form action={deleteFaqEntry} className="mt-2">
                <input type="hidden" name="id" value={entry.id} />
                <Button type="submit" variant="ghost" className="text-accent">
                  Delete
                </Button>
              </form>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
