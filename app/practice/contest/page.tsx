import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ContestBoard } from "@/components/practice/ContestBoard";

export const metadata = {
  // Per-route canonical, as every sibling.
  alternates: { canonical: "/practice/contest" },
  title: "Weekly set · Practice · lazybull",
  description:
    "Four problems, ninety minutes, every Sunday. Ranked on solves and time — never on money. A timed practice set, on paper.",
};

export default function PracticeContestPage() {
  return (
    <main className="page-aura tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <ContestBoard />
      <Footer />
    </main>
  );
}
