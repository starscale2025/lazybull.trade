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
//
// In the pitch deck's hand (2026-11-17): the record is a document, so it is
// set as one sheet of the deck's paper on the ink page — the wordmark with its
// green full stop as the letterhead, the name in Fraunces, mono labels over
// hairline rules. `data-theme="light"` around a `.deck` element turns on the
// deck's own paper tokens (globals.css, THE DECK SKIN). The same sheet as the
// profile's certificate card (components/practice/Certificate.tsx).

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { TrackGlyph } from "@/components/practice/Chips";
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

const at = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;

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
    <main className="deck tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      {cert ? <Record cert={cert} /> : <Unavailable />}
      <section className="shell pb-[clamp(4rem,8vw,6rem)]">
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link href="/practice" className="deck-link">
            The problem set
            <span aria-hidden className="deck-arrow">
              →
            </span>
          </Link>
          <span className="font-mono text-[0.75rem] tracking-[0.04em] text-fg-faint">Paper only · educational · not advice</span>
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
    <section className="shell pt-[clamp(3rem,7vw,5.5rem)]">
      <div data-theme="light" className="deck-rise">
        <article className="deck max-w-3xl rounded-[14px] border border-border bg-bg px-5 py-8 text-fg sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          {/* the letterhead: the wordmark, the track's tile, the seal */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--deck-rule)] pb-5">
            <span className="deck-wordmark text-[1.625rem]">
              lazybull<span className="text-brand">.</span>
            </span>
            <div className="flex items-center gap-2.5">
              <TrackGlyph track={cert.track} size="sm" />
              {/* the seal: green ink outlined on the bare paper, as on the
                  profile's certificate card */}
              <span className="inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-brand-ink shadow-[inset_0_0_0_1px_var(--deck-green-line)]">
                <span aria-hidden>✓</span>
                Minted
              </span>
            </div>
          </div>

          <p className="deck-eyebrow mt-9">Practice certificate · {meta.label}</p>
          <h1 className="deck-h1 mt-5 break-words text-fg">{cert.displayName}</h1>
          <p className="deck-lede mt-6 max-w-[38rem]">
            Completed the {meta.label} track — {stats.total} problems, {stats.byDifficulty.easy} easy · {stats.byDifficulty.medium} medium ·{" "}
            {stats.byDifficulty.hard} hard — with an accepted submission on every one. Each submission ran the solver’s own Python against
            hidden test cases and was graded on our server.
          </p>

          <dl className="mt-10 grid border-t border-[var(--deck-rule)] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="py-5 sm:pr-4">
              <dt className="deck-label">Track</dt>
              <dd className="mt-2 t-data text-[0.875rem] text-fg">{meta.label}</dd>
            </div>
            <div className="border-t border-border py-5 sm:border-l sm:border-t-0 sm:px-5">
              <dt className="deck-label">Minted</dt>
              <dd className="mt-2 t-data text-[0.875rem] text-fg">{mintedOn(cert.mintedAt)}</dd>
            </div>
            <div className="border-t border-border py-5 sm:border-l sm:border-t-0 sm:pl-5">
              <dt className="deck-label">Record id</dt>
              <dd className="mt-2 break-all t-data text-[0.875rem] text-fg">{cert.id}</dd>
            </div>
          </dl>

          <p className="border-t border-border pt-5 text-[0.8125rem] leading-relaxed text-fg-faint">
            This is a completion record for a free, paper-only education workbench — not a professional credential,
            licence or qualification. It says these problems were solved; it says nothing about trading.
          </p>
        </article>
      </div>
    </section>
  );
}

function Unavailable() {
  return (
    <header className="shell pb-10 pt-[clamp(3rem,7vw,5.5rem)]">
      <p className="deck-eyebrow deck-rise">Practice · Certificate</p>
      <h1 className="deck-h1 deck-rise mt-5 max-w-[20ch] text-fg" style={at(1)}>
        The record store could not be reached.
      </h1>
      <p className="deck-lede deck-rise mt-6 max-w-[38rem]" style={at(2)}>
        Nothing is cached here on purpose — try the link again in a minute.
      </p>
    </header>
  );
}
