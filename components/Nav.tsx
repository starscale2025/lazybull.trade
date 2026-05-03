import Link from "next/link";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex size-7 items-center justify-center border border-fg/40 bg-bg">
            <div className="absolute inset-[3px] bg-bull" />
            <span className="relative font-mono text-[9px] font-bold text-bg">LB</span>
          </div>
          <span className="font-display text-lg font-medium tracking-tightest text-fg">
            lazybull
            <span className="text-bull">.</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {[
            { l: "Visual chain", href: "/trade" },
            { l: "Pro charts", href: "/pro" },
            { l: "Quant", href: "/quant" },
            { l: "Teacher", href: "/trade" },
            { l: "Manifesto", href: "#" },
          ].map((item, i) => (
            <Link
              key={item.l}
              href={item.href}
              className="group relative flex h-9 items-center px-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-colors hover:text-fg"
            >
              <span className="text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
              <span className="ml-2">{item.l}</span>
              <span className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-bull transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button className="hidden h-9 items-center gap-2 border border-border px-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg sm:inline-flex">
            <span className="text-fg-faint">⌘</span>K
            <span className="text-fg-faint hidden lg:inline ml-1">Search</span>
          </button>
          <Link
            href="#"
            className="hidden h-9 items-center px-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-colors hover:text-fg sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/trade"
            className="group relative inline-flex h-9 items-center gap-2 bg-bull px-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg"
          >
            <span className="size-1.5 rounded-full bg-bg pulse-dot" />
            Open the chain
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
