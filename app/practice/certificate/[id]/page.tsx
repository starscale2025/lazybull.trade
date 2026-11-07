// /practice/certificate/[id] — the public record behind a minted practice
// certificate. One row in practice_certificates (lib/db/practice.ts), written
// by POST /api/practice/certificate only after the server saw an accepted
// submit for every problem in the track; this page reads it back by id, so a
// link can be checked by anyone without signing in. Dynamic: the row is the
// truth, never a build-time snapshot. Not indexed — it is a person's page,
// like /practice/profile (app/robots.ts).
//
// Plain about what it is: a completion record for a free, paper-only
// education workbench, not a professional credential.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
import { Eyebrow, TrackGlyph } from "@/components/practice/Chips";
import { getCertificate } from "@/lib/db/practice";
import { trackStats } from "@/lib/practice/problems";
import { TRACK_META } from "@/lib/practice/tracks";
import type { CertificateRecord } from "@/lib/practice/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Practice certificate · lazybull",
  description: "A completion record for one lazybull practice track — verified against the server's own rows.",
  robots: { index: false },
};

function mintedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let cert: CertificateRecord | null = null;
  let unavailable = false;
  try {
    cert = await getCertificate(id);
  } catch {
    unavailable = true;
  }
  if (!cert && !unavailable) notFound();

  return (
    <main className="tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />
      <section className="shell section-y-sm">
        <Eyebrow>practice · certificate · record</Eyebrow>
        {cert ? <Record cert={cert} /> : <Unavailable />}
        <div className="mt-8 flex flex-wrap items-center gap-4 t-chrome text-fg-faint">
          <Link href="/practice" className="hover:text-bull">
            ← the problem set
          </Link>
          <span>paper only · educational · not advice</span>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Record({ cert }: { cert: CertificateRecord }) {
  const meta = TRACK_META[cert.track];
  const stats = trackStats(cert.track);
  return (
    <div className="mt-6 max-w-3xl">
      <div
        className="relative overflow-hidden border border-bull/50 bg-bg p-8 sm:p-10"
        style={{ boxShadow: "0 0 60px -20px rgba(82,255,165,0.4)" }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[16rem] leading-none text-bull/[0.05]">
          ✓
        </div>
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <TrackGlyph track={cert.track} size="md" />
            <div className="t-eyebrow text-bull">lazybull · practice certificate · {meta.label}</div>
            <span className="border border-bull/40 bg-bull/10 px-1.5 py-0.5 t-chrome text-bull">minted</span>
          </div>
          <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3.5rem)] font-light italic leading-[0.9] tracking-tightest text-fg">
            {cert.displayName}
          </h1>
          <p className="mt-4 max-w-[60ch] t-body-sm text-fg-dim">
            completed the {meta.label} track — {stats.total} problems, {stats.byDifficulty.easy} easy · {stats.byDifficulty.medium} medium ·{" "}
            {stats.byDifficulty.hard} hard — with an accepted submission on every one. Each submission ran the solver&apos;s own
            Python against hidden test cases and was graded on our server.
          </p>

          <dl className="mt-6 grid max-w-[35rem] grid-cols-3 gap-px border border-border bg-border">
            <div className="bg-bg p-4">
              <dt className="t-chrome text-fg-faint">track</dt>
              <dd className="mt-1 t-data text-[0.8125rem] text-fg">{meta.label}</dd>
            </div>
            <div className="bg-bg p-4">
              <dt className="t-chrome text-fg-faint">minted</dt>
              <dd className="mt-1 t-data text-[0.8125rem] text-fg">{mintedOn(cert.mintedAt)}</dd>
            </div>
            <div className="bg-bg p-4">
              <dt className="t-chrome text-fg-faint">record id</dt>
              <dd className="mt-1 break-all t-data text-[0.8125rem] text-fg">{cert.id}</dd>
            </div>
          </dl>

          <p className="mt-6 t-chrome text-fg-faint">
            this is a completion record for a free, paper-only education workbench — not a professional credential,
            licence or qualification. it says these problems were solved; it says nothing about trading.
          </p>
        </div>
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="mt-6 max-w-xl border border-dashed border-border bg-bg p-6">
      <div className="font-display text-lg tracking-tightest text-fg">The record store could not be reached.</div>
      <p className="mt-2 t-chrome text-fg-faint">nothing is cached here on purpose — try the link again in a minute.</p>
    </div>
  );
}
