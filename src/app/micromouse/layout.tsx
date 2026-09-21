import { guardHiddenPage } from "@/lib/page-visibility";

/** 404s this route while an admin has it hidden. See guardHiddenPage. */
export default async function MicromouseLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/micromouse");
  return <>{children}</>;
}
