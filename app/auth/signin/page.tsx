"use client";

import { signIn } from "next-auth/react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
    <main className="grid min-h-screen place-items-center bg-bg px-5 text-fg">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-20 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-bull/15 blur-[160px]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        <Link href="/" className="flex items-center gap-2 font-display text-2xl tracking-tightest">
          <div className="relative flex size-8 items-center justify-center border border-fg/40 bg-bg">
            <div className="absolute inset-1 bg-bull" />
            <span className="relative font-mono text-[10px] font-bold text-bg">LB</span>
          </div>
          lazybull<span className="text-bull">.</span>
        </Link>

        <div className="w-full border border-border bg-surface">
          <div className="border-b border-border bg-bg-soft px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">
            ⟢ sign in
          </div>
          <div className="p-8">
            <h1 className="font-display text-3xl tracking-tightest leading-[1.05] text-fg">
              Welcome back.
              <br />
              <span className="italic font-light text-bull">Pick where to leave off.</span>
            </h1>
            <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-fg-dim">
              Signing in saves your workspaces, watchlists, custom bots, and paper-trading
              positions across devices. Free, no card.
            </p>

            {error && (
              <div className="mt-6 border border-bear/40 bg-bear/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bear">
                ⚠ {decodeURIComponent(error)}
              </div>
            )}

            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="mt-8 group flex w-full items-center justify-center gap-3 border border-border bg-bg px-4 py-3 font-mono text-[12px] uppercase tracking-wider text-fg transition-colors hover:border-bull hover:bg-bull/5"
            >
              <GoogleG />
              Continue with Google
              <span className="ml-2 text-fg-faint group-hover:text-bull">→</span>
            </button>

            <div className="mt-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              <span className="h-px flex-1 bg-border" />
              more soon
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              <div className="border border-border bg-bg/50 px-3 py-2 text-center opacity-60">GitHub</div>
              <div className="border border-border bg-bg/50 px-3 py-2 text-center opacity-60">Email link</div>
            </div>
          </div>
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          Don't want to sign in?{" "}
          <Link href="/quant" className="text-fg-dim hover:text-bull">
            Try the workbench anonymously →
          </Link>
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
