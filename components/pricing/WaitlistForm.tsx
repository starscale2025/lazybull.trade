"use client";

// The inline waitlist — what a tier's CTA becomes when its rail is not
// configured, and always for Power. POSTs to app/api/waitlist, which writes
// the real list (lib/db/waitlist.ts) the 2026-09 diligence memo found
// missing ("Waitlist: None … there is no list").
//
// Works signed out (email typed) and signed in (email prefilled from the
// session, still editable — the route lets a provided address win). A
// repeat join is a calm "already on the list", never an error to explain.
// The tally is shown only once a tier has ten or more names; a single-digit
// count says less than nothing.

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Currency } from "@/lib/billing/config";
import { Chip, PillButton } from "@/components/calm/kit";

export type WaitlistTier = "plus" | "pro" | "power";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "joined"; already: boolean }
  | { kind: "error"; message: string };

const TIER_NAME: Record<WaitlistTier, string> = { plus: "Plus", pro: "Pro", power: "Power" };

/** Public threshold — under this the number is noise, not signal. */
export const SHOW_COUNT_FROM = 10;

export function WaitlistForm({
  tier,
  currency,
  count = 0,
  primary,
  soon,
  reason,
}: {
  tier: WaitlistTier;
  currency: Currency;
  count?: number;
  primary?: boolean;
  soon?: boolean;
  /** One line under the button saying why this is a list and not a checkout. */
  reason?: string;
}) {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  // Prefill from the session once it arrives; the field stays editable.
  useEffect(() => {
    const e = session?.user?.email;
    if (e) setEmail((cur) => cur || e);
  }, [session?.user?.email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind === "busy") return;
    setState({ kind: "busy" });
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, currency, email: email.trim() || undefined }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; already?: boolean; error?: string } | null;
      if (r.ok && j?.ok) {
        setState({ kind: "joined", already: j.already === true });
      } else {
        setState({
          kind: "error",
          message:
            r.status === 429
              ? "Too many tries — wait a minute"
              : typeof j?.error === "string"
                ? j.error
                : "Could not save — try again",
        });
      }
    } catch {
      setState({ kind: "error", message: "Offline — try again" });
    }
  };

  if (state.kind === "joined") {
    return (
      <div className="mt-6">
        <div className="flex h-11 items-center justify-center">
          <Chip tone="brand" dot>
            {state.already ? "Already on the list" : "On the list"} · {TIER_NAME[tier]} · {currency}
          </Chip>
        </div>
        <div className="mt-2 t-label text-fg-faint">We email when checkout opens · nothing is charged</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-2">
      <input
        type="email"
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={status === "loading" ? "…" : "you@example.com"}
        aria-label={`Email for the ${TIER_NAME[tier]} waitlist`}
        autoComplete="email"
        className="calm-input w-full"
      />
      <PillButton
        type="submit"
        kind={primary ? "primary" : "secondary"}
        disabled={state.kind === "busy"}
        className={`w-full ${soon ? "text-fg-dim!" : ""}`}
      >
        {state.kind === "busy" ? "Saving…" : "Join the waitlist"}
      </PillButton>
      <div className="t-label text-fg-faint">
        {reason ?? "No card · nothing charged"}
        {count >= SHOW_COUNT_FROM ? ` · ${count.toLocaleString("en-US")} waiting` : ""}
      </div>
      {state.kind === "error" && (
        <div className="t-label text-fg first-letter:uppercase" role="alert">
          {state.message}
        </div>
      )}
    </form>
  );
}
