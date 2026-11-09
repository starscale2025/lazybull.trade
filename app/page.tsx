import { TickerBar } from "@/components/TickerBar";
import { FrameZero } from "@/components/FrameZero";
import { PayoffInstrument } from "@/components/PayoffInstrument";
import { CinemaGate } from "@/components/scrollstory/CinemaGate";
import { Footer } from "@/components/Footer";
import { MarketingSections } from "@/components/marketing/MarketingSections";
import { AmbientOrbs } from "@/components/atmosphere/AmbientOrbs";
import { ScrollReveal } from "@/components/atmosphere/ScrollReveal";

// The homepage's own canonical. It used to inherit this from the root layout,
// which meant every OTHER route inherited it too and claimed to be this page.
export const metadata = {
  alternates: { canonical: "/" },
};

// FRAME ZERO (2026-11). The first frame is the matter: "Options you can see."
// over a living wireframe in the brand palette, the H1 server-rendered and the
// LCP, the WebGL loaded after it. The film still plays on every load, but
// UNDER it: its section starts one viewport up beneath the hero, so scrolling
// lifts the hero off the pinned film like a curtain. When the film ends it
// collapses, and the hero sits directly above the landing again. The payoff
// instrument, frame zero until 2026-11-06, opens the landing after the eye band.
export default function Home() {
  return (
    <main className="tap-floor relative flex min-h-screen flex-col bg-bg text-fg">
      {/* Atmosphere: the soft orbs only. The cursor spotlight and the top
          progress bar went in the calm pass (M33, 2026-11-09): one followed
          the pointer for its own sake, and the film's rail already shows
          where you are. */}
      <AmbientOrbs />

      <div className="relative z-10 flex flex-col">
        <TickerBar />

        {/* Frame zero. Opaque and stacked above the film (z-30 over z-20). */}
        <FrameZero />
        {/* The curtain's soft edge. It takes no room in the page. */}
        <div aria-hidden className="fz-skirt film-desktop-only pointer-events-none relative z-30 h-0">
          <div className="absolute inset-x-0 top-0 h-[42vh] bg-gradient-to-b from-bg via-bg/60 to-transparent" />
        </div>

        {/* The film, under the curtain. Keep the section after it immediately
            after: collapse() anchors on its next sibling to keep the page still
            while ~12,000px of film leave the layout. */}
        <CinemaGate />

        {/* The landing begins with the thing the product does: drag a strike,
            watch the floor. The Matrix-eye band that stood between the film and
            this is gone (Gate A2: stock sci-fi, and about 1 MB of video); the
            film's dissolve lands here now. */}
        <PayoffInstrument />

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
