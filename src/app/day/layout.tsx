import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { DayBackdrop } from "@/components/day-site/DayBackdrop";
import "@/styles/day.css";

// Archivo with its width axis, so headings can run wide like a race poster.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-day", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Competition Day", template: "%s | MMRC 26 Competition Day" },
  description: "Live from MMRC 26: the bracket, the standings, every team and everything you need on the day.",
};

/**
 * What the public day site and Day HQ share: the type, the colours and the
 * artwork behind them. No access check here, and nothing that reads a cookie,
 * so this stays static; the public pages check access in (site)/layout.tsx and
 * HQ checks for a signed-in admin in hq/layout.tsx.
 */
export default function DayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`day-root ${archivo.variable}`}>
      <DayBackdrop />
      {children}
    </div>
  );
}
