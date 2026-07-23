import Link from "next/link";

const LINKS = [
  { href: "/game", label: "Robo-Maze Mouse" },
  { href: "/rules", label: "Rules" },
  { href: "/schedule", label: "Schedule" },
  { href: "/faq", label: "FAQ" },
  { href: "/register", label: "Register" },
];

export function Nav() {
  return (
    <nav aria-label="Primary" className="flex items-center gap-6">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm font-medium text-ras-gray transition-colors hover:text-ras-purple dark:text-white/80 dark:hover:text-white"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
