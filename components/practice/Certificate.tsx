"use client";

// The practice certificate — the paper diploma from components/learn/Diploma.tsx
// (lines 88-141) pointed at a track: the `border-bull/50` card with the soft
// glow, the giant ✓ watermark, the italic display name, the 3-up hairline stat
// block. It shows the track you are nearest to finishing. It is MINTED only by
// the server — POST /api/practice/certificate checks its own rows for an
// accepted submit on every problem in the track, writes one row per (user,
// track), and the row's id becomes the public record at
// /practice/certificate/<id>. Anonymous solvers can finish a track but not
// mint: the certificate names an account, and a device is not one.
//
// PROPS IN. The profile board owns the session, the ledger and the list of
// minted certificates and hands them down; this stays free of storage.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { mintCertificate } from "@/lib/practice/client";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";
import type { CertificateRecord, ProgressSummary, TrackId } from "@/lib/practice/types";

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
    ? `minted — every ${label} problem accepted.`
    : complete
      ? signedIn
        ? `every ${label} problem accepted — mint it and it gets a public record.`
        : `every ${label} problem accepted on this device — sign in to mint it under your name.`
      : `mints when every ${label} problem is accepted — ${solved}/${total} so far.`;

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
        ? `the server has not seen an accepted submit for ${r.missing?.length ?? "some"} ${label.toLowerCase()} problem${(r.missing?.length ?? 2) === 1 ? "" : "s"} yet`
        : r.status === 401
          ? "sign in to mint"
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

  return (
    <div
      className="relative overflow-hidden border border-bull/50 bg-bg p-8 sm:p-10"
      style={{ boxShadow: "0 0 60px -20px rgba(0,255,135,0.4)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[16rem] leading-none text-bull/[0.05]"
      >
        ✓
      </div>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2 t-eyebrow text-bull">
          <span aria-hidden className="size-1.5 rounded-full bg-bull pulse-dot" />
          lazybull · practice certificate · {label}
          {minted && <span className="border border-bull/40 bg-bull/10 px-1.5 py-0.5 t-chrome text-bull">minted</span>}
        </div>
        <div className="mt-6 font-display text-[clamp(2rem,5vw,3.5rem)] font-light italic leading-[0.9] tracking-tightest text-fg">
          {minted ? minted.displayName : name}
        </div>
        <p className="mt-3 t-body-sm text-fg-dim">{line}</p>

        <div className="mt-6 grid max-w-[35rem] grid-cols-3 gap-px border border-border bg-border">
          <div className="bg-bg p-4">
            <div className="t-data text-2xl text-bull">
              {solved}
              <span className="text-fg-faint">/{total}</span>
            </div>
            <div className="mt-1 t-chrome text-fg-faint">{label.toLowerCase()} solved</div>
          </div>
          <div className="bg-bg p-4">
            <div className="t-data text-2xl text-fg">
              {summary.solvedCount}
              <span className="text-fg-faint">/{summary.total}</span>
            </div>
            <div className="mt-1 t-chrome text-fg-faint">all tracks</div>
          </div>
          <div className="bg-bg p-4">
            <div className="t-data text-2xl text-fg">$0</div>
            <div className="mt-1 t-chrome text-fg-faint">real risk</div>
          </div>
        </div>

        <div className="mt-5 t-chrome text-fg-faint">
          {minted ? `record ${minted.id} · minted ${minted.mintedAt.slice(0, 10)} · ` : ""}a completion record, not a professional credential · paper only ·
          educational · not advice
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {minted && url && (
            <>
              <Link
                href={url}
                className="h-9 inline-flex items-center border border-bull bg-bull/10 px-4 font-mono text-[0.6875rem] uppercase tracking-wider text-bull transition-colors hover:bg-bull hover:text-bg"
              >
                verify →
              </Link>
              <button
                type="button"
                onClick={copy}
                className="h-9 border border-border bg-bg px-4 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull hover:text-bull"
              >
                {copied ? "✓ copied" : "copy link"}
              </button>
            </>
          )}
          {!minted && complete && signedIn && (
            <button
              type="button"
              onClick={mint}
              disabled={minting}
              className="h-9 bg-bull px-4 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bull-dim disabled:opacity-50"
            >
              {minting ? "minting…" : "mint certificate"}
            </button>
          )}
          {!minted && complete && !signedIn && (
            <Link
              href="/auth/signin"
              className="h-9 inline-flex items-center border border-bull bg-bull/10 px-4 font-mono text-[0.6875rem] uppercase tracking-wider text-bull transition-colors hover:bg-bull hover:text-bg"
            >
              sign in to mint →
            </Link>
          )}
          {!minted && !complete && (
            <span className="t-chrome text-fg-faint">
              {total - solved} {label.toLowerCase()} problem{total - solved === 1 ? "" : "s"} left
            </span>
          )}
          {mintError && <span className="t-chrome text-bear">{mintError}</span>}
        </div>
      </div>
    </div>
  );
}
