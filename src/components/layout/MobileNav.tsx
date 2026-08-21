"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

/**
 * The site menu on phones.
 *
 * The desktop menu is a row of links that does not fit a narrow screen, and
 * hiding it left phone visitors with no navigation at all — from any page but
 * the homepage there was no way to reach another one. This is that menu.
 *
 * Closes on Escape, on tapping outside, and whenever the route changes: a
 * panel that stays open over the page you just navigated to feels broken, and
 * is easy to miss because it never happens while clicking around a desktop.
 */

export interface NavLink {
  href: string;
  label: string;
}

export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A tap on a link navigates without unmounting this component, so without
  // this the menu would still be sitting open over the new page.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Send focus back to the control that opened it, or a keyboard user is
      // dropped at the top of the document.
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        // 44px square: the smallest comfortable touch target, and the reason
        // this is a button with padding rather than a bare icon.
        className="flex h-11 w-11 items-center justify-center rounded-md text-ras-purple transition-[background-color,transform] duration-200 hover:bg-ras-purple/10 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 dark:text-white dark:hover:bg-white/10"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          {open ? (
            <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          // Anchored to the header rather than the button so it spans the full
          // width; a narrow dropdown would put the links in a cramped column.
          // page-enter doubles as the panel's own drop-in: it mounts fresh on
          // every open, so the animation replays without needing a key.
          className="page-enter absolute left-0 right-0 top-full z-50 border-b border-ras-gray/15 bg-[var(--color-bg)] shadow-lg"
        >
          <nav aria-label="Site" className="mx-auto max-w-6xl px-4 py-2">
            <ul className="flex flex-col">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      // py-3 gives each row a 44px-plus hit area without
                      // needing a fixed height that would clip long labels.
                      className={`block rounded-md px-3 py-3 text-base font-medium transition-colors ${
                        active
                          ? "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white"
                          : "text-ras-gray hover:bg-ras-purple/5 hover:text-ras-purple dark:text-white/80 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
