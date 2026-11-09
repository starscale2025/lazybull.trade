"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The nav's one main button: the builder, except on the builder, where a link
 * to the page you are already on is a dead end (Gate A4 #6).
 *
 * The short label covers below sm AND the 1024–1279 hamburger band, where the
 * audit measured the full label clipping off the pill's edge.
 */
export function NavCta({ className }: { className: string }) {
  const onBuilder = usePathname() === "/trade";
  return (
    <Link href={onBuilder ? "/trade/chain" : "/trade"} className={className}>
      <span className="sm:hidden lg:inline xl:hidden">{onBuilder ? "Chain" : "Builder"}</span>
      <span className="hidden sm:inline lg:hidden xl:inline">{onBuilder ? "See the chain" : "Open the builder"}</span>
    </Link>
  );
}
