"use client";

// "Manage consent" — the way back into the dialog.
//
// Without a control like this the gate is answer-once-forever: a visitor who
// turned analytics off, or who wants to switch the teacher-training toggle on
// after reading the privacy page, has no route back to the choice. Both the
// DPDP rules and the promise on /privacy say consent is withdrawable, so a
// withdrawal path is a commitment, not a nicety.
//
// It exists as its own client component because components/Footer.tsx is a
// SERVER component and openConsentSettings() is client-only — the same reason
// ContrastToggle sits beside it in that row rather than being inlined.

import { openConsentSettings, useConsent } from "./ConsentGate";

export function ConsentLink() {
  const { consent, ready, analytics } = useConsent();

  // Until the first client render, "no consent" and "not read yet" are the
  // same value, so the label is held back rather than guessing (the gate's
  // own `ready` flag exists for this). The button still renders, so the row's
  // layout never shifts under it.
  const decided = ready && Boolean(consent);

  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[0.75rem] text-fg-dim transition-colors hover:text-fg"
      title="Review what lazybull records, and change it"
    >
      <span
        aria-hidden
        className={`size-1 rounded-full ${decided && analytics ? "bg-bull" : "bg-fg-faint"}`}
      />
      Consent
    </button>
  );
}
