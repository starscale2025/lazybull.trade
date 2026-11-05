import { TickerBar } from "@/components/TickerBar";
import { GetStarted } from "@/components/GetStarted";
import { HeroInstrument } from "@/components/HeroInstrument";
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

// FRAME ZERO (2026-11). The first frame is the hero instrument: "Options you
// can see." on the zero axis of a live payoff, server-rendered, the LCP. The
// film still plays on every load, but UNDER it: its section starts one viewport
// up beneath the hero, so scrolling lifts the hero off the pinned film like a
// curtain. When the film ends it collapses, and the hero sits directly above
// the landing again. No scroll lock, no baked plate, no toll booth.
export default function Home() {
  return (
    <main className="tap-floor relative flex min-h-screen flex-col bg-bg text-fg">
      {/* Atmosphere — fixed background layers */}
      <AmbientOrbs />
      <CursorSpotlight />
      <ScrollProgress />

      <div className="relative z-10 flex flex-col">
        <TickerBar />

        {/* Frame zero. Opaque and stacked above the film (z-30 over z-20). */}
        <HeroInstrument />

        {/* The film, under the curtain. Keep the section after it immediately
            after: collapse() anchors on its next sibling to keep the page still
            while ~12,000px of film leave the layout. */}
        <CinemaGate />

        {/* The landing begins with the eye band. */}
        <GetStarted />

        {/* The rest of the landing: workflow, product, safety, pricing. */}
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
