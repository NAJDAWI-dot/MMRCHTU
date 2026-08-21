import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/brand/ThemeProvider";
import { SplashScreen } from "@/components/brand/SplashScreen";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import { splashPrePaintScript } from "@/lib/splash";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: {
    default: "MMRC 26 — Micro Mouse Robot Competition",
    template: "%s | MMRC 26",
  },
  description:
    "MMRC 26 is the IEEE RAS HTU Student Chapter's Micro Mouse Robot Competition — rules, schedule, registration, and the Pac Mouse game.",
  icons: {
    icon: "/brand/favicon/favicon.ico",
    apple: "/brand/favicon/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
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
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <SplashScreen />
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
