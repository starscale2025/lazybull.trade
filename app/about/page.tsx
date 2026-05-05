import { Nav } from "@/components/Nav";
import { About } from "@/components/About";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "About — lazybull.trade",
  description:
    "Meet the founders of LazyBull — Shaurya Negi, Joshmann Singh, and Pratham Verma. Three NST students obsessed with making options trading radically clear.",
};

export default function AboutPage() {
  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <About />
      <Footer />
    </main>
  );
}
