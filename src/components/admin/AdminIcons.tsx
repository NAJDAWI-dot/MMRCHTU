import type { ReactNode } from "react";

/**
 * The twelve admin nav glyphs, drawn here rather than installed.
 *
 * The project's only UI dependency is `@radix-ui/react-slot`; pulling an icon
 * package in for twelve 16px shapes would add a dependency, a bundle and a
 * version to keep current for something a few path strings cover. Everything
 * is stroked in `currentColor`, so an icon takes the colour of the nav item it
 * sits in — including the active one — with no per-state wiring.
 *
 * All of them are decorative: every icon in this app sits beside its own text
 * label, never instead of it, so they are hidden from assistive tech.
 */
export type AdminIconName =
  | "dashboard"
  | "analytics"
  | "schedule"
  | "competition"
  | "faq"
  | "gallery"
  | "pages"
  | "form"
  | "registrations"
  | "payments"
  | "email"
  | "admins";

const PATHS: Record<AdminIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  analytics: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5v-6" />
      <path d="M12 20.5V8" />
      <path d="M17 20.5v-9" />
    </>
  ),
  schedule: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3.5 10h17" />
    </>
  ),
  competition: (
    <>
      <path d="M6 21V3" />
      <path d="M6 4h12l-2.6 3.6L18 11.5H6z" />
    </>
  ),
  faq: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9" />
      <path d="M12 17.2h.01" />
    </>
  ),
  gallery: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 16.5l4.2-4a1.5 1.5 0 0 1 2.1 0l3 3" />
      <path d="M14 14l1.6-1.5a1.5 1.5 0 0 1 2.1 0L20.5 15" />
    </>
  ),
  pages: (
    <>
      <path d="M12 3.2l8.5 4.6L12 12.4 3.5 7.8z" />
      <path d="M3.5 12.6L12 17.2l8.5-4.6" />
      <path d="M3.5 16.6L12 21.2l8.5-4.6" />
    </>
  ),
  form: (
    <>
      <path d="M9.5 4.5H7a1.5 1.5 0 0 0-1.5 1.5v13.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-2.5" />
      <rect x="9" y="2.6" width="6" height="3.8" rx="1.2" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  registrations: (
    <>
      <circle cx="9.5" cy="7.5" r="3.5" />
      <path d="M3 20.5v-1.2A4.3 4.3 0 0 1 7.3 15h4.4a4.3 4.3 0 0 1 4.3 4.3v1.2" />
      <path d="M16.5 4.4a3.5 3.5 0 0 1 0 6.2" />
      <path d="M18.2 15.2A4.3 4.3 0 0 1 21 19.3v1.2" />
    </>
  ),
  payments: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6.5 14.6h3.5" />
    </>
  ),
  email: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.6l8.1 5.6a1.6 1.6 0 0 0 1.8 0L21 6.6" />
    </>
  ),
  admins: (
    <>
      <path d="M12 2.8l8 2.9v5.5c0 4.9-3.4 8.5-8 10-4.6-1.5-8-5.1-8-10V5.7z" />
      <path d="M8.8 11.9l2.3 2.3 4.1-4.3" />
    </>
  ),
};

export function AdminIcon({
  name,
  className = "h-4 w-4",
}: {
  name: AdminIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
