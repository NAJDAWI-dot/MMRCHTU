import { guardHiddenPage } from "@/lib/page-visibility";

/** 404s the album index and every album under it while hidden. See guardHiddenPage. */
export default async function GalleryLayout({ children }: { children: React.ReactNode }) {
  await guardHiddenPage("/gallery");
  return <>{children}</>;
}
