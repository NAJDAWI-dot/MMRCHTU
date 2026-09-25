/**
 * A sponsor's logo on a white tile, in either theme: most logos are drawn for
 * white, and a dark tile would lose their dark lettering. A sponsor with no
 * logo gets its name set in the day site's type instead.
 */
export function SponsorLogo({ name, logoUrl, className = "", nameClass = "text-2xl" }: { name: string; logoUrl: string; className?: string; nameClass?: string }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-[4px] bg-white shadow-sm ring-1 ring-black/5 ${className}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className={`day-display px-4 text-center leading-tight text-[#24102a] ${nameClass}`}>{name}</span>
      )}
    </div>
  );
}
