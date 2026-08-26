import type { Metadata, Viewport } from "next";
import { KillSwitchSentinel } from "@/components/safety/KillSwitch";
import { Fraunces, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { PaperSync } from "@/components/PaperSync";
import { Tracker } from "@/components/Tracker";
import { DockProvider } from "@/components/Dock";
import { CommandDeck } from "@/components/CommandDeck";
import { Narrator } from "@/components/Narrator";
import { GsapScroller } from "@/components/atmosphere/GsapScroller";
import { GlassAtmosphere } from "@/components/atmosphere/GlassAtmosphere";
import { RouteLoader } from "@/components/atmosphere/RouteLoader";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // The TRUE italic family. Every accent line on this site is italic, and for
  // months not one italic file shipped — the whole brand leaned on
  // browser-synthesized shears of the roman (font-synthesis-style: none in
  // globals.css now makes that regression impossible).
  style: ["normal", "italic"],
  // SOFT/WONK were preloaded dead weight for just as long. They're alive now:
  // --market-wonk (set from the live VIX by the ticker) drives them, so the
  // letterforms themselves carry the day's volatility. See .wonk-type.
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
  // An explicit fallback stack rather than the browser's default serif. NOTE:
  // this does NOT fix the display-headline re-wrap — `adjustFontFallback` (on
  // by default) synthesises its own size-adjusted face that sits AHEAD of this
  // list, so these families only apply if that face is unavailable too.
  // Measured: /learn's h1 still swaps 499px -> 368px (four wrapped lines to
  // three) with or without this line. That shift needs a reserved box on the
  // headline, not a different fallback family — see the CLS notes in the audit.
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

const funnel = Bricolage_Grotesque({
  variable: "--font-funnel",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

const DESCRIPTION =
  "Drag across the chain to build options strategies. An AI teacher explains every Greek and trade in plain English. Paper-only, training wheels on by default.";

// viewport-fit: cover is what makes env(safe-area-inset-*) resolve to anything
// other than 0. Without it, a full-bleed cinematic site letterboxes itself
// inside the notch/home-indicator gutters on every modern phone — and every
// safe-area padding written anywhere in the app silently does nothing.
export const viewport: Viewport = {
  themeColor: "#050505",
  viewportFit: "cover",
  colorScheme: "dark light",
};

export const metadata: Metadata = {
  // metadataBase is what makes every relative OG/canonical URL below resolve to
  // an absolute one. Without it Next warns and social crawlers get a relative
  // image path they cannot fetch.
  metadataBase: new URL(SITE_URL),
  title: "LAZYBULL // Options You Can See",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // There was NO openGraph and NO twitter block at all, so every share of this
  // site — Product Hunt, Twitter, Slack, the directory submissions the strategy
  // depends on — rendered as a bare text link with no image card.
  openGraph: {
    type: "website",
    siteName: "lazybull.trade",
    title: "LAZYBULL // Options You Can See",
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LAZYBULL // Options You Can See",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jetbrainsMono.variable} ${funnel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg selection:bg-bull selection:text-bg">
        {/* The aurora every glass surface refracts. First child, fixed and
            behind everything — pages with their own canvas paint over it. */}
        <GlassAtmosphere />
        <a href="#main" className="skip-link">
          skip to content
        </a>
        <SessionProvider>
          {/* display:contents — a real <main> landmark and skip target with
              ZERO layout effect on the flex chains inside. */}
          <ThemeProvider>
            <DockProvider>
              <main id="main" className="contents">
                {children}
              </main>
            </DockProvider>
          </ThemeProvider>
          {/* Cross-device paper-account replication — needs the session. */}
          <PaperSync />
          {/* Product events: one page_view per route change. */}
          <Tracker />
          {/* ⌘K — every action on the desk, keyboard-first. */}
          <CommandDeck />
          {/* The terminal's spoken voice: fills, kill switch, resets → aria-live. */}
          <Narrator />
        </SessionProvider>
        {/* Daily-loss guard: global, because share trades now book from /pro
            and /quant too, and the limit has to be watched everywhere. */}
        <KillSwitchSentinel />
        <GsapScroller />
        {/* Pending-navigation feedback. Pairs with the commit-side veil in
            app/template.tsx: that one covers the new page's first paint, this
            one covers the wait before it. Debounced, so fast hops draw nothing. */}
        <RouteLoader />
      </body>
    </html>
  );
}
