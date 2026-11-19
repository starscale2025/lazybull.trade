"use client";

// The practice certificate — the diploma of components/learn/Diploma.tsx pointed
// at a track: the name large, the three figures under it. It shows the track you
// are nearest to finishing. It is MINTED only by the server — POST
// /api/practice/certificate checks its own rows for an accepted submit on every
// problem in the track, writes one row per (user, track), and the row's id
// becomes the public record at /practice/certificate/<id>. Anonymous solvers can
// finish a track but not mint: the certificate names an account, and a device
// is not one.
//
// A document, so it is set on the pitch deck's paper (2026-11-17): the light
// slides' bone and ink, hairline rules, mono labels, the name in Fraunces and
// the wordmark with its green full stop. `data-theme="light"` around a `.deck`
// element turns on the deck's own paper tokens (globals.css, THE DECK SKIN), so
// the sheet stays paper whatever the page around it is set in.
//
// PROPS IN. The profile board owns the session, the ledger and the list of
// minted certificates and hands them down; this stays free of storage.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { mintCertificate } from "@/lib/practice/client";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";
import type { CertificateRecord, ProgressSummary, TrackId } from "@/lib/practice/types";

/** The minted seal: a green-ink stamp outlined on the paper. Ink on the bare
    sheet rather than a tinted chip, so the word keeps its contrast. A tag's
    6px corner, not a pill: on the deck a pill is a button, and this is not one. */
const STAMP =
  "inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-brand-ink shadow-[inset_0_0_0_1px_var(--deck-green-line)]";

/** A complete track wins outright; otherwise the highest solved/total that is
    still open, ties to track order. */
function nearestTrack(summary: ProgressSummary): { track: TrackId; complete: boolean } {
  const complete = TRACK_ORDER.find((t) => {
    const { solved, total } = summary.byTrack[t];
    return total > 0 && solved === total;
  });
  if (complete) return { track: complete, complete: true };
  let best: TrackId = TRACK_ORDER[0];
  let bestRatio = -1;
  for (const t of TRACK_ORDER) {
    const { solved, total } = summary.byTrack[t];
    const ratio = total > 0 ? solved / total : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = t;
    }
  }
  return { track: best, complete: false };
}

export function Certificate({
  name,
  summary,
  signedIn,
  certificates,
  onMinted,
}: {
  name: string;
  summary: ProgressSummary;
  signedIn: boolean;
  certificates: CertificateRecord[];
  /** The server minted (or found) a certificate — the parent re-reads its ledger. */
  onMinted: (c: CertificateRecord) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // A minted track outranks the nearest one: the card shows what exists.
  const first = certificates[0];
  const { track, complete } = first ? { track: first.track, complete: true } : nearestTrack(summary);
  const minted = certificates.find((c) => c.track === track) ?? null;
  const label = TRACK_META[track].label;
  const { solved, total } = summary.byTrack[track];
  const url = minted ? `/practice/certificate/${minted.id}` : null;

  const line = minted
    ? `Minted — every ${label} problem accepted.`
    : complete
      ? signedIn
        ? `Every ${label} problem accepted — mint it and it gets a public record.`
        : `Every ${label} problem accepted on this device — sign in to mint it under your name.`
      : `Mints when every ${label} problem is accepted — ${solved}/${total} so far.`;

  const mint = async () => {
    setMinting(true);
    setMintError(null);
    const r = await mintCertificate(track);
    setMinting(false);
    if (r.ok) {
      onMinted(r.certificate);
      return;
    }
    setMintError(
      r.status === 409
        ? `The server has not seen an accepted submit for ${r.missing?.length ?? "some"} ${label.toLowerCase()} problem${(r.missing?.length ?? 2) === 1 ? "" : "s"} yet`
        : r.status === 401
          ? "Sign in to mint"
          : r.error
    );
  };

  const copy = () => {
    if (!url) return;
    navigator.clipboard?.writeText(`${window.location.origin}${url}`).then(
      () => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  };

  const figures = [
    {
      label: `${label.toLowerCase()} solved`,
      value: (
        <>
          {solved}
          <span className="text-fg-faint">/{total}</span>
        </>
      ),
    },
    {
      label: "all tracks",
      value: (
        <>
          {summary.solvedCount}
          <span className="text-fg-faint">/{summary.total}</span>
        </>
      ),
    },
    { label: "real risk", value: "$0" },
  ];

  return (
    <div data-theme="light">
      <div className="deck rounded-[14px] border border-border bg-bg px-5 py-7 text-fg sm:px-10 sm:py-9">
        {/* the letterhead: the wordmark, and what this sheet is */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-[var(--deck-rule)] pb-5">
          <span className="deck-wordmark text-[1.625rem]">
            lazybull<span className="text-brand">.</span>
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="deck-label">Practice certificate · {label}</span>
            {minted && (
              <span className={STAMP}>
                <span aria-hidden>✓</span>
                Minted
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-x-12 gap-y-8 pt-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="deck-display break-words text-[clamp(2.25rem,5vw,3.75rem)] leading-[1] tracking-[-0.03em] text-fg">
              {minted ? minted.displayName : name}
            </div>
            <p className="mt-4 max-w-[36rem] text-[0.9375rem] leading-relaxed text-fg-dim">{line}</p>
          </div>

          <dl className="grid grid-cols-3 border-t border-border lg:min-w-[26rem]">
            {figures.map((f, i) => (
              <div
                key={f.label}
                className={`flex flex-col gap-2 pt-4 ${i < figures.length - 1 ? "pr-2 sm:pr-3" : ""} ${i > 0 ? "border-l border-border pl-3 sm:pl-5" : ""}`}
              >
                <dt className="deck-label">{f.label}</dt>
                <dd className="deck-figure text-[clamp(1.5rem,6.5vw,2.625rem)] text-fg">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 flex flex-col gap-5 border-t border-border pt-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <p className="max-w-[44rem] break-words font-mono text-[0.75rem] leading-relaxed tracking-[0.02em] text-fg-faint">
            {minted ? `Record ${minted.id} · minted ${minted.mintedAt.slice(0, 10)} · a` : "A"} completion record, not a professional credential · paper
            only · educational · not advice
          </p>

          {/* Whichever state this is, it has one primary: the page's one.
              The site's focus ring is drawn in --bull; on paper that is the
              fill green (#00a85a, 2.9:1 on the sheet), so the controls take
              the paper's ink green (#00803f, 4.7:1) for it. */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 [--bull:var(--bull-ink)]">
            {minted && url && (
              <>
                <Link href={url} className="deck-btn deck-btn-primary deck-btn-sm">
                  Verify
                  <span aria-hidden className="deck-arrow">
                    →
                  </span>
                </Link>
                <button type="button" onClick={copy} className="deck-btn deck-btn-sm">
                  {copied ? "✓ Copied" : "Copy link"}
                </button>
              </>
            )}
            {!minted && complete && signedIn && (
              <button type="button" onClick={mint} disabled={minting} className="deck-btn deck-btn-primary deck-btn-sm">
                {minting ? "Minting…" : "Mint certificate"}
              </button>
            )}
            {!minted && complete && !signedIn && (
              <Link href="/auth/signin" className="deck-btn deck-btn-primary deck-btn-sm">
                Sign in to mint
              </Link>
            )}
            {!minted && !complete && (
              <span className="text-[0.8125rem] text-fg-faint">
                {total - solved} {label.toLowerCase()} problem{total - solved === 1 ? "" : "s"} left
              </span>
            )}
            {mintError && <span className="text-[0.8125rem] text-fg">{mintError}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
