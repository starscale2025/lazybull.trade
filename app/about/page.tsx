import { Nav } from "@/components/Nav";
import { About } from "@/components/About";
import { Footer } from "@/components/Footer";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/about" },
  title: "About — lazybull.trade",
  description:
    "Meet the founders of LazyBull — Shaurya Negi, Joshmann Singh, and Pratham Verma. Three builders obsessed with making options trading radically clear.",
};

export default function AboutPage() {
  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <About />
      <Footer marketing />
    </main>
  );
}
