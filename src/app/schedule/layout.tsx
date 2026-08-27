import { guardHiddenPage } from "@/lib/page-visibility";

/** 404s this route while hidden. See guardHiddenPage. */
export default async function ScheduleLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/schedule");
  return <>{children}</>;
}
