import type { Metadata, Viewport } from "next";
import { Cairo, Inter, JetBrains_Mono } from "next/font/google";
import { AmbientMice } from "@/components/brand/AmbientMice";
import { MazeDescent } from "@/components/layout/MazeDescent";
import { ThemeProvider } from "@/components/brand/ThemeProvider";
import { SplashScreen } from "@/components/brand/SplashScreen";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import { RouteLoader } from "@/components/layout/RouteLoader";
import { JsonLd } from "@/components/seo/JsonLd";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { splashPrePaintScript } from "@/lib/splash";
import { siteOrigin } from "@/lib/site-url";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/structured-data";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
// The site is English throughout; this is here for the two Arabic promotional
// words on the early-bird badge and banner. Without an Arabic subset those fall
// back to whatever the reader's system happens to ship, which is Tahoma on one
// machine and something quite different on the next.
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-arabic", display: "swap" });

const DESCRIPTION =
  "MMRC 26 is the IEEE RAS HTU Student Chapter's Micro Mouse Robot Competition — rules, schedule, registration, and the Pac Mouse game.";

export const metadata: Metadata = {
  // Without this, Next cannot turn the generated Open Graph image into the
  // absolute URL that every social crawler requires, and warns at build time.
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "MMRC 26 — Micro Mouse Robot Competition",
    template: "%s | MMRC 26",
  },
  description: DESCRIPTION,
  icons: {
    icon: "/brand/favicon/favicon.ico",
    apple: "/brand/favicon/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  // The image itself comes from app/opengraph-image.tsx; these supply the text
  // that sits beside it in a preview card.
  openGraph: {
    type: "website",
    siteName: "MMRC 26",
    title: "MMRC 26 — Micro Mouse Robot Competition",
    description: DESCRIPTION,
    url: "/",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "MMRC 26 — Micro Mouse Robot Competition",
    description: DESCRIPTION,
  },
  alternates: { canonical: "/" },
};

/**
 * Next supplies a sensible default, but two things here are worth being
 * explicit about.
 *
 * `viewportFit: "cover"` lets the page use the full screen on phones with a
 * notch or rounded corners, and is what makes the safe-area insets in
 * globals.css report real values rather than zero.
 *
 * Zoom is deliberately not capped. `maximumScale` or `userScalable: false`
 * would stop anyone who needs to magnify the page from doing so, and the
 * usual reason for reaching for them — iOS zooming on focused inputs — is
 * fixed properly in globals.css by sizing those inputs at 16px instead.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#2a0e2f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must run before first paint so the page cannot flash behind the
            splash — see src/lib/splash.ts. */}
        <script dangerouslySetInnerHTML={{ __html: splashPrePaintScript() }} />
        {/* Sitewide identity. The competition itself is described on the
            Competition Day page, where the date and venue actually live. */}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={webSiteJsonLd()} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${cairo.variable} font-sans antialiased`}>
        {/*
          The sitewide background image, behind every page.

          A real element rather than a background on <body> — see
          .site-background in globals.css for why, and for how one dark image
          serves both themes. Outside ThemeProvider because it is static markup
          that reads the theme through CSS alone, and aria-hidden because it is
          decoration with nothing to announce.
        */}
        <div className="site-background" aria-hidden="true" />
        <ThemeProvider>
          <ServiceWorkerRegistrar />
          <SplashScreen />
          <RouteLoader />
          {/*
            Sitewide, not just the landing page.

            Mounted here rather than inside a page for a reason beyond reach:
            this sits outside PageTransition, so it survives a navigation
            instead of being torn down and remounted with it. A mouse halfway
            across the screen when someone clicks a link keeps going rather
            than blinking out, and the thirty-second cadence belongs to the
            visitor rather than restarting on every page.
          */}
          <AmbientMice />
          {/* Sitewide for the same reason, and outside PageTransition for a
              second one — see the note in MazeDescent about fixed positioning
              inside an animating transform. */}
          <MazeDescent />
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Header />
          <main id="main-content">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
