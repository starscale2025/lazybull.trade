import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { GetStarted } from "@/components/GetStarted";
import { CinemaGate } from "@/components/scrollstory/CinemaGate";
import { Footer } from "@/components/Footer";
import { TeacherAvatar } from "@/components/ai-teacher/Avatar";
import { AmbientOrbs } from "@/components/atmosphere/AmbientOrbs";
import { CursorSpotlight } from "@/components/atmosphere/CursorSpotlight";
import { ScrollProgress } from "@/components/atmosphere/ScrollProgress";
import { ScrollReveal } from "@/components/atmosphere/ScrollReveal";

// The homepage is now the scroll-cinema: it tells the whole product story as one
// animated sequence, then hands off to a single Get Started. Signed-in visitors
// skip the intro (see CinemaGate). The marketing sections it replaced live on in
// git history if we ever want them back.
export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col bg-bg text-fg">
      {/* Atmosphere — fixed background layers */}
      <AmbientOrbs />
      <CursorSpotlight />
      <ScrollProgress />

      <div className="relative z-10 flex flex-col">
        <TickerBar />
        <Nav />

        <CinemaGate />

        <GetStarted />

        <ScrollReveal as="div" speed="slow">
          <Footer />
        </ScrollReveal>
      </div>

      <TeacherAvatar />
    </main>
  );
}
