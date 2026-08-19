// The one canonical, numbered directory of the site. The numbers are for the
// landing front door's INDEX (components/GetStarted.tsx), which is a listing
// you read in order — there, a number tells you where you are in a set. The
// nav rail (components/Nav.tsx) and the mobile sheet consume the same list
// but NOT the numbers: a nav is a set of destinations you jump between, so
// the numerals encoded nothing there and only crowded the busiest element on
// every page. Keep `n` — it is load-bearing for the index.
// Numbering it here means a destination has the SAME number everywhere: the nav
// used to number its 7 items by index (Pricing = 06) while the landing numbered
// 8 incl. Portfolio (Pricing = 07), so the same link showed two different
// numbers on one page. The first 7 entries are the numbered content pages the
// nav rail shows (in its order); Portfolio (the account page) is entry 08 and
// appears only in the landing index, so it adds no conflicting number.
export const SITE_DIRECTORY = [
  { n: "01", l: "Learn", href: "/learn", d: "zero to your first spread, in plain English" },
  { n: "02", l: "Visual chain", href: "/trade", d: "drag across strikes — the payoff draws itself" },
  { n: "03", l: "Pro charts", href: "/pro", d: "the terminal: drawing tools, replay, paper trading" },
  { n: "04", l: "Quant", href: "/quant", d: "27 bots on live or seed tape, verdicts in English" },
  { n: "05", l: "Greeks", href: "/greeks", d: "every Greek as a picture, an AI teacher on top" },
  { n: "06", l: "Pricing", href: "/pricing", d: "free while we build. what pro will include" },
  { n: "07", l: "About", href: "/about", d: "why paper-only, and who's behind it" },
  { n: "08", l: "Portfolio", href: "/portfolio", d: "your paper account — positions, wagered, history" },
] as const;

// The nav rail shows the numbered content pages; Portfolio lives in the account
// cluster, not the numbered rail (width — see components/Nav.tsx).
export const NAV_DIRECTORY = SITE_DIRECTORY.filter((e) => e.href !== "/portfolio");
