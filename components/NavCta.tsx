"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The nav's one green button: the builder, except on the builder, where a
 * link to the page you are already on is a dead end (Gate A4 #6).
 *
 * The short label is for phones; from sm the bar has room for the full one.
 */
export function NavCta({ className }: { className: string }) {
  const onBuilder = usePathname() === "/trade";
  return (
    <Link href={onBuilder ? "/trade/chain" : "/trade"} className={className}>
      <span className="sm:hidden">{onBuilder ? "Chain" : "Builder"}</span>
      <span className="hidden sm:inline">{onBuilder ? "See the chain" : "Open the builder"}</span>
      <span aria-hidden className="deck-arrow">
        →
      </span>
    </Link>
  );
}
