"use client";

import { signIn } from "next-auth/react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BullMark } from "@/components/BullMark";
import { CalmLink, Chip, PillButton } from "@/components/calm/kit";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPanel />
    </Suspense>
  );
}

function SignInPanel() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/quant";
  const error = params.get("error");

  return (
    <main className="page-aura grid min-h-screen place-items-center overflow-x-clip bg-bg px-5 text-fg">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <Link href="/" className="flex items-center gap-2 font-display text-2xl tracking-tightest">
          <BullMark className="h-6 w-8" />
          lazybull<span className="text-fg-dim">.</span>
        </Link>

        <div className="calm-panel w-full p-8">
          <i aria-hidden className="lit-aura" />
          <div className="t-eyebrow text-brand-ink">Sign in</div>
          <h1 className="mt-3 font-display text-3xl tracking-tightest leading-[1.05] text-fg">
            Welcome back.
            <br />
            <span className="t-accent">Pick where to leave off.</span>
          </h1>
          <p className="mt-3 max-w-prose t-body-sm text-fg-dim">
            Signing in saves your workspaces, watchlists, custom bots, and paper-trading
            positions across devices. Free, no card.
          </p>

          {error && (
            <div className="mt-6 rounded-[14px] bg-fg/5 px-4 py-3 text-[0.875rem] leading-snug text-fg">
              {decodeURIComponent(error)}
            </div>
          )}

          {/* Secondary on purpose: Google's four-colour G sits on a neutral
              button, and the gradient would fight it. */}
          <PillButton size="lg" onClick={() => signIn("google", { callbackUrl })} className="mt-8 w-full">
            <GoogleG />
            Continue with Google
          </PillButton>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="t-label text-fg-faint">More soon</span>
            <Chip>GitHub</Chip>
            <Chip>Email link</Chip>
          </div>
        </div>

        <p className="text-center text-[0.8125rem] text-fg-faint">
          Don’t want to sign in? <CalmLink href="/quant">Try the workbench anonymously</CalmLink>
        </p>
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}
