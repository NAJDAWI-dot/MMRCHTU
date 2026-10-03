"use client";

import { useEffect, useRef, useState } from "react";
import { DARK_TILE, type LogoBackground } from "@/lib/sponsors";

/**
 * A sponsor's logo on its tile, the same in either theme: white for most
 * logos, which are drawn for white, and dark for a light logo that would
 * vanish on white (the Sponsors desk picks which). A sponsor with no logo, or
 * one whose image will not load, gets its name set in the day site's type
 * instead, so a tile is never left blank.
 */
export function SponsorLogo({
  name,
  logoUrl,
  background = "WHITE",
  className = "",
  nameClass = "text-2xl",
}: {
  name: string;
  logoUrl: string;
  background?: LogoBackground;
  className?: string;
  nameClass?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  // An image that failed before the page woke up never fires onError here.
  useEffect(() => {
    const img = image.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(logoUrl);
  }, [logoUrl]);
  const dark = background === "DARK";
  const showLogo = logoUrl && failed !== logoUrl;
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-[4px] shadow-sm ring-1 ${dark ? "ring-white/10" : "bg-white ring-black/5"} ${className}`}
      style={dark ? { backgroundColor: DARK_TILE } : undefined}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={image} src={logoUrl} alt={name} onError={() => setFailed(logoUrl)} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className={`day-display px-4 text-center leading-tight ${dark ? "text-white" : "text-[#24102a]"} ${nameClass}`}>{name}</span>
      )}
    </div>
  );
}
