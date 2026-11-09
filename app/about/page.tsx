import { Nav } from "@/components/Nav";
import { About } from "@/components/About";
import { Footer } from "@/components/Footer";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/about" },
  title: "About — lazybull",
  // Roles, not adjectives. The old description called three people "builders
  // obsessed with making options trading radically clear", which is warmth
  // where the diligence memo asked for proof. What each person actually owns
  // is checkable in the commit history; that is what this says.
  description:
    "Who builds lazybull — Shaurya Negi (pricing, order and market-data engines), Joshmann Singh (voice co-pilot), Pratham Verma (operations and research). Three students, one paper-only options workbench.",
};

export default function AboutPage() {
  return (
    <main className="page-aura flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      <About />
      <Footer marketing />
    </main>
  );
}
