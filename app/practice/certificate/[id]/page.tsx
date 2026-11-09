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
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CalmLink, CalmPanel, Chip, PageHeader } from "@/components/calm/kit";
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
    <main className="page-aura tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      {cert ? <Record cert={cert} /> : <Unavailable />}
      <section className="shell pb-16">
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
          <CalmLink href="/practice">The problem set</CalmLink>
          <span className="text-[0.8125rem] text-fg-faint">Paper only · educational · not advice</span>
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
    <>
      <PageHeader
        eyebrow={`lazybull · practice certificate · ${meta.label}`}
        title={cert.displayName}
        lede={
          <>
            Completed the {meta.label} track — {stats.total} problems, {stats.byDifficulty.easy} easy · {stats.byDifficulty.medium} medium ·{" "}
            {stats.byDifficulty.hard} hard — with an accepted submission on every one. Each submission ran the solver’s own Python against
            hidden test cases and was graded on our server.
          </>
        }
      />
      <section className="shell">
        <CalmPanel className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <TrackGlyph track={cert.track} size="md" />
            <Chip tone="brand">Minted</Chip>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="t-label text-fg-faint">Track</dt>
              <dd className="mt-1 t-data text-[0.8125rem] text-fg">{meta.label}</dd>
            </div>
            <div>
              <dt className="t-label text-fg-faint">Minted</dt>
              <dd className="mt-1 t-data text-[0.8125rem] text-fg">{mintedOn(cert.mintedAt)}</dd>
            </div>
            <div>
              <dt className="t-label text-fg-faint">Record id</dt>
              <dd className="mt-1 break-all t-data text-[0.8125rem] text-fg">{cert.id}</dd>
            </div>
          </dl>

          <p className="mt-6 t-label text-fg-faint">
            This is a completion record for a free, paper-only education workbench — not a professional credential,
            licence or qualification. It says these problems were solved; it says nothing about trading.
          </p>
        </CalmPanel>
      </section>
    </>
  );
}

function Unavailable() {
  return (
    <PageHeader
      eyebrow="Practice certificate"
      title="The record store could not be reached."
      lede="Nothing is cached here on purpose — try the link again in a minute."
    />
  );
}
