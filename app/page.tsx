import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Hero } from "@/components/Hero";
import { TeacherAvatar } from "@/components/ai-teacher/Avatar";
import { UseCases } from "@/components/UseCases";
import { TradeOverview } from "@/components/TradeOverview";
import { SocialProof } from "@/components/SocialProof";
import { Partners } from "@/components/Partners";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />
      <Hero />
      <UseCases />
      <TradeOverview />
      <SocialProof />
      <Partners />
      <Footer />
      <TeacherAvatar />
    </main>
  );
}
