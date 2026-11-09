import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ProfileBoard } from "@/components/practice/ProfileBoard";

export const metadata = {
  // Per-route canonical, as every sibling.
  alternates: { canonical: "/practice/profile" },
  title: "Your practice ledger · lazybull",
  description: "Your solved ring, streak, heatmap and certificate across the 48 practice problems.",
  // Per-user, like /portfolio — app/robots.ts disallows it as well.
  robots: { index: false },
};

export default function PracticeProfilePage() {
  return (
    <main className="page-aura tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <ProfileBoard />
      <Footer />
    </main>
  );
}
