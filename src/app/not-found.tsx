import Link from "next/link";
import { LostMaze } from "@/components/brand/LostMaze";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="font-mono text-sm text-ras-crimson dark:text-mood-rose">404</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ras-purple dark:text-white">
        This cell of the maze is empty
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        The page you&apos;re looking for doesn&apos;t exist. While you are here, so is this mouse —
        get it to the middle.
      </p>

      <div className="mt-8">
        <LostMaze />
      </div>

      {/*
        Real links, outside the game. A dead end should always offer a way on,
        and someone who cannot or does not want to play a maze must not be left
        with nothing but a maze.
      */}
      <nav aria-label="Where to next" className="mt-10 border-t border-ras-gray/15 pt-6">
        <p className="text-xs uppercase tracking-widest text-ras-gray dark:text-white/60">
          Or head somewhere real
        </p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          {[
            { href: "/", label: "Home" },
            { href: "/rules", label: "Rules" },
            { href: "/schedule", label: "Schedule" },
            { href: "/register", label: "Register" },
            { href: "/game", label: "Pac Mouse" },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="-mx-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-ras-purple transition-colors hover:underline dark:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
