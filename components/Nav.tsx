import Link from "next/link";
import { AuthButtons } from "./AuthButtons";
import { MobileMenu } from "./MobileMenu";
import { NavAutoHide } from "./NavAutoHide";
import { NavCta } from "./NavCta";
import { NavRail } from "./NavRail";
import { NavSearch } from "./NavSearch";

/**
 * The site navbar, as the pitch deck draws it (2026-11-17).
 *
 * The deck's product mockups (slides 7 and 9) all carry the same bar: the
 * "lazybull." wordmark with its green full stop, the destinations in mono
 * capitals with the current one on a raised fill, search with its ⌘K, and the
 * account at the right. So the bar is a flat ink strip with one hairline under
 * it, full width, its contents on the page's own measure (.shell), instead of
 * the floating glass pill it replaces. It carries `.deck`, the scope that
 * holds the deck's palette (globals.css, THE DECK SKIN), so it reads the same
 * over every route, the /pro canvas included.
 *
 * Breakpoint budget, unchanged in substance: the rail is xl+ (Quant joins at
 * 2xl, the reference pages stay in More), Portfolio is xl+, and below xl the
 * menu button carries every destination. `--nav-h` is published on the
 * wrapper and kept in step with :root's copy in globals.css: 2.75rem of bar
 * (h-11, which the site's 110% root font makes 48.4px) and its 1px rule.
 *
 * `.nav-pill` stays on the bar as a hook: the Island (components/island)
 * finds the bar by it to sit underneath.
 *
 * The landing does NOT mount this at the top (see app/page.tsx): the film is
 * that page's navigation, and the bar arrives with the marketing region.
 */
export function Nav({ wide = false }: { wide?: boolean }) {
  return (
    <div className="nav-bar deck pointer-events-none sticky top-0 z-50" style={{ ["--nav-h" as string]: "calc(2.75rem + 1px)" }}>
      <NavAutoHide />
      <nav aria-label="Primary" className="nav-pill deck-navbar pointer-events-auto relative">
        <div className={`shell ${wide ? "shell-wide" : ""} flex h-11 items-center gap-3 xl:gap-7`}>
          <Link
            href="/"
            aria-label="lazybull, home"
            className="deck-wordmark flex shrink-0 items-center [view-transition-name:nav-mark]"
          >
            lazybull<span className="text-bull">.</span>
          </Link>

          <NavRail />

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <NavSearch />
            <Link href="/portfolio" className="deck-navlink hidden xl:inline-flex">
              Portfolio
            </Link>
            <AuthButtons />
            <NavCta className="deck-btn deck-btn-primary deck-btn-sm" />
            <MobileMenu />
          </div>
        </div>
      </nav>
    </div>
  );
}
