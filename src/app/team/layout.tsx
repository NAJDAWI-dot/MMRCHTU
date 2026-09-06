import { guardHiddenPage } from "@/lib/page-visibility";

/** 404s the committee page while an admin has it hidden. See guardHiddenPage. */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/team");
  return <>{children}</>;
}
