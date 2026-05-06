import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Hero } from "@/components/Hero";
import { TeacherAvatar } from "@/components/ai-teacher/Avatar";
import { UseCases } from "@/components/UseCases";
import { TradeOverview } from "@/components/TradeOverview";
import { SocialProof } from "@/components/SocialProof";
import { Partners } from "@/components/Partners";
import { Footer } from "@/components/Footer";
import { IntroSequence } from "@/components/atmosphere/IntroSequence";
import { CursorSpotlight } from "@/components/atmosphere/CursorSpotlight";
import { AmbientOrbs } from "@/components/atmosphere/AmbientOrbs";
import { ScrollProgress } from "@/components/atmosphere/ScrollProgress";
import { ScrollReveal } from "@/components/atmosphere/ScrollReveal";
import { SectionDivider } from "@/components/atmosphere/SectionDivider";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col bg-bg text-fg">
      {/* Atmosphere — fixed background layers */}
      <AmbientOrbs />
      <CursorSpotlight />
      <ScrollProgress />
      <IntroSequence />

      <div className="relative z-10 flex flex-col">
        <TickerBar />
        <Nav />

        <Hero />

        <SectionDivider flag="§ 02 — who" meta="04 profiles" />
        <ScrollReveal as="section">
          <UseCases />
        </ScrollReveal>

        <SectionDivider flag="§ 03 — how" meta="04 drags" />
        <ScrollReveal as="section">
          <TradeOverview />
        </ScrollReveal>

        <SectionDivider flag="§ 04 — receipts" meta="learners.log" />
        <ScrollReveal as="section">
          <SocialProof />
        </ScrollReveal>

        <SectionDivider flag="§ 05 — stack" meta="partners.json" />
        <ScrollReveal as="section">
          <Partners />
        </ScrollReveal>

        <ScrollReveal as="div" speed="slow">
          <Footer />
        </ScrollReveal>
      </div>

      <TeacherAvatar />
    </main>
  );
}
