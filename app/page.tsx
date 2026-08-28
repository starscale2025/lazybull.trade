import { TickerBar } from "@/components/TickerBar";
import { GetStarted } from "@/components/GetStarted";
import { CinemaGate } from "@/components/scrollstory/CinemaGate";
import { Footer } from "@/components/Footer";
import { MarketingSections } from "@/components/marketing/MarketingSections";
import { AmbientOrbs } from "@/components/atmosphere/AmbientOrbs";
import { CursorSpotlight } from "@/components/atmosphere/CursorSpotlight";
import { ScrollProgress } from "@/components/atmosphere/ScrollProgress";
import { ScrollReveal } from "@/components/atmosphere/ScrollReveal";

// The homepage's own canonical. It used to inherit this from the root layout,
// which meant every OTHER route inherited it too and claimed to be this page.
export const metadata = {
  alternates: { canonical: "/" },
};

// The homepage is now the scroll-cinema: it tells the whole product story as one
// animated sequence, then hands off to a single Get Started. It auto-plays on
// every load for everyone — logged in or not (see CinemaGate). The marketing
// sections it replaced live on in git history if we ever want them back.
export default function Home() {
  return (
    <main className="tap-floor relative flex min-h-screen flex-col bg-bg text-fg">
      {/* Atmosphere — fixed background layers */}
      <AmbientOrbs />
      <CursorSpotlight />
      <ScrollProgress />

      <div className="relative z-10 flex flex-col">
        <TickerBar />
        {/* No navbar here — the landing IS the navigation: the cinema hands off
            to the hero, and the page directory inside GetStarted links every
            page. Product pages keep the full <Nav />. */}

        <CinemaGate />

        {/* NOTE: keep GetStarted immediately after the cinema — its opening block
            ("Options you can see." + Get started) is pixel-matched to the cinema's
            final overlay, which is what makes the collapse hand-off invisible.
            Never insert a section between them. The crystal-bull showcase renders
            INSIDE GetStarted, above the eye band. */}
        <GetStarted />

        {/* The marketing recomposition (design system: ui_kits/site-redesign +
            ui_kits/site-glass) — workflow, product, safety, pricing. It mounts
            HERE, strictly after GetStarted, because the cinema→hero hand-off
            above depends on those two being adjacent and pixel-matched. This
            region is additive: nothing above it changed. */}
        <MarketingSections />

        <ScrollReveal as="div" speed="slow">
          <Footer marketing />
        </ScrollReveal>
      </div>

      {/* No <TeacherAvatar/> here. It was mounted with no `onAsk`, and the
          component's onClick IS onAsk — so it was a labelled button wired to
          nothing, parked bottom-right over every frame of the film and measured
          2.0-4.7x brighter than the entire frame at the climax. The one place
          it is actually wired is /trade/chain. */}
    </main>
  );
}
