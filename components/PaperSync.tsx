"use client";

// Cross-device paper-account sync — the piece the sign-in page has been
// promising. Mounted once in the root layout; renders nothing but a brief
// toast when a reconcile actually moved data.
//
// Model: the client engine is the source of truth while it runs; this
// component replicates snapshots to /api/paper behind an optimistic `rev`.
// All decision rules live in lib/paper-sync-core.ts (pure, unit-tested).

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePaper } from "@/lib/stores";
import {
  decideInitial,
  isFactoryDefault,
  latestActivity,
  pickSnapshot,
  resolveFork,
  sanitizeSnapshot,
} from "@/lib/paper-sync-core";

const SYNC_KEY = "lb-paper-sync";
const DEBOUNCE_MS = 3000;

const readSyncedRev = (): number => {
  try {
    return JSON.parse(localStorage.getItem(SYNC_KEY) || "{}").rev || 0;
  } catch {
    return 0;
  }
};
const writeSyncedRev = (rev: number) => {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ rev }));
  } catch {}
};

export function PaperSync() {
  const { status } = useSession();
  const [toast, setToast] = useState<string | null>(null);
  // Guards the subscribe callback while we apply a server snapshot, so an
  // adopt can never echo back up as a push of the thing we just downloaded.
  const adopting = useRef(false);
  const revRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let alive = true;

    const say = (msg: string) => {
      if (!alive) return;
      setToast(msg);
      window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 5000);
    };

    const adopt = (state: unknown, rev: number, note?: string) => {
      adopting.current = true;
      try {
        usePaper.setState(sanitizeSnapshot(state));
      } finally {
        adopting.current = false;
      }
      revRef.current = rev;
      writeSyncedRev(rev);
      if (note) say(note);
    };

    const push = async (): Promise<void> => {
      try {
        const body = JSON.stringify({ baseRev: revRef.current, state: pickSnapshot(usePaper.getState()) });
        const r = await fetch("/api/paper", { method: "PUT", headers: { "content-type": "application/json" }, body });
        if (!alive) return;
        if (r.status === 409) {
          const j = await r.json();
          const serverAt = j.updatedAt ? new Date(j.updatedAt).getTime() : 0;
          const side = resolveFork(serverAt, latestActivity(pickSnapshot(usePaper.getState())));
          if (side === "adopt") {
            adopt(j.state, j.rev, "paper account updated from your other device");
          } else {
            revRef.current = j.rev; // rebase and overwrite — local is newer
            await push();
          }
          return;
        }
        const j = await r.json();
        if (j?.ok && typeof j.rev === "number") {
          revRef.current = j.rev;
          writeSyncedRev(j.rev);
        }
      } catch {
        /* offline — the next change or sign-in retries */
      }
    };

    // ── initial reconcile
    (async () => {
      try {
        const r = await fetch("/api/paper");
        if (!alive || !r.ok) return; // 401 while session settles, or server down
        const j = await r.json();
        if (!j?.ok) return;
        const localSnap = pickSnapshot(usePaper.getState());
        const decision = decideInitial({
          serverRev: j.rev ?? 0,
          serverHasState: !!j.state,
          localDefault: isFactoryDefault(localSnap),
          lastSyncedRev: readSyncedRev(),
        });
        revRef.current = j.rev ?? 0;
        if (decision.kind === "push") {
          await push();
          say("paper account backed up to your profile");
        } else if (decision.kind === "adopt") {
          adopt(j.state, j.rev, "paper account restored from your profile");
        } else if (decision.kind === "fork") {
          const serverAt = j.updatedAt ? new Date(j.updatedAt).getTime() : 0;
          const side = resolveFork(serverAt, latestActivity(localSnap));
          if (side === "adopt") adopt(j.state, j.rev, "paper account updated from your other device");
          else {
            await push();
            say("this device's paper account was newer — profile updated");
          }
        }
      } catch {
        /* offline — steady-state pushes will retry */
      }
    })();

    // ── steady state: every store change → debounced push
    const unsub = usePaper.subscribe(() => {
      if (adopting.current) return;
      dirtyRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        dirtyRef.current = false;
        void push();
      }, DEBOUNCE_MS);
    });

    // Best-effort flush of a pending change on tab close (sendBeacon = POST).
    const flush = () => {
      if (!dirtyRef.current) return;
      try {
        const body = JSON.stringify({ baseRev: revRef.current, state: pickSnapshot(usePaper.getState()) });
        navigator.sendBeacon?.("/api/paper", new Blob([body], { type: "application/json" }));
      } catch {}
    };
    window.addEventListener("pagehide", flush);

    return () => {
      alive = false;
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("pagehide", flush);
    };
  }, [status]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-5 left-5 z-[var(--z-toast)] surface-card border border-border bg-surface px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-fg shadow-2xl">
      ⇅ {toast}
    </div>
  );
}
