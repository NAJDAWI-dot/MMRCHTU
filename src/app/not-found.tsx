import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-mono text-sm text-ras-crimson dark:text-mood-rose">404</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ras-purple dark:text-white">
        This cell of the maze is empty
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-ras-purple">
        ← Back home
      </Link>
    </div>
  );
}
