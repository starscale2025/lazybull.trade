"use client";

// The practice certificate — the diploma of components/learn/Diploma.tsx pointed
// at a track, on a calm panel: the name large, the three figures in the kit's
// stat row. It shows the track you are nearest to finishing. It is MINTED only by
// the server — POST /api/practice/certificate checks its own rows for an
// accepted submit on every problem in the track, writes one row per (user,
// track), and the row's id becomes the public record at
// /practice/certificate/<id>. Anonymous solvers can finish a track but not
// mint: the certificate names an account, and a device is not one.
//
// PROPS IN. The profile board owns the session, the ledger and the list of
// minted certificates and hands them down; this stays free of storage.

import { useEffect, useRef, useState } from "react";
import { Chip, PillButton, PillLink, Stats } from "@/components/calm/kit";
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

  return (
    <div className="calm-panel p-8 sm:p-10">
      <i aria-hidden className="lit-aura" />
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="t-eyebrow text-brand-ink">lazybull · practice certificate · {label}</div>
        {minted && <Chip tone="brand">Minted</Chip>}
      </div>
      <div className="mt-6 font-display text-[clamp(2rem,5vw,3.5rem)] leading-[0.98] tracking-[-0.04em] text-fg">
        {minted ? minted.displayName : name}
      </div>
      <p className="mt-3 t-body-sm text-fg-dim">{line}</p>

      <Stats
        className="mt-8"
        items={[
          {
            value: (
              <>
                {solved}
                <span className="text-fg-faint">/{total}</span>
              </>
            ),
            label: `${label.toLowerCase()} solved`,
          },
          {
            value: (
              <>
                {summary.solvedCount}
                <span className="text-fg-faint">/{summary.total}</span>
              </>
            ),
            label: "all tracks",
          },
          { value: "$0", label: "real risk" },
        ]}
      />

      <p className="mt-6 t-label text-fg-faint">
        {minted ? `Record ${minted.id} · minted ${minted.mintedAt.slice(0, 10)} · a` : "A"} completion record, not a professional credential · paper
        only · educational · not advice
      </p>

      {/* Whichever state this is, it has one primary: the page's one. */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {minted && url && (
          <>
            <PillLink href={url} kind="primary" size="sm">
              Verify
            </PillLink>
            <PillButton size="sm" onClick={copy}>
              {copied ? "✓ Copied" : "Copy link"}
            </PillButton>
          </>
        )}
        {!minted && complete && signedIn && (
          <PillButton kind="primary" size="sm" onClick={mint} disabled={minting}>
            {minting ? "Minting…" : "Mint certificate"}
          </PillButton>
        )}
        {!minted && complete && !signedIn && (
          <PillLink href="/auth/signin" kind="primary" size="sm">
            Sign in to mint
          </PillLink>
        )}
        {!minted && !complete && (
          <span className="t-label text-fg-faint">
            {total - solved} {label.toLowerCase()} problem{total - solved === 1 ? "" : "s"} left
          </span>
        )}
        {mintError && <span className="t-label text-fg">{mintError}</span>}
      </div>
    </div>
  );
}
