import { ScrollReveal } from "./ScrollReveal";

type Props = {
  flag?: string;
  meta?: string;
};

export function SectionDivider({ flag = "§", meta = "" }: Props) {
  return (
    <ScrollReveal as="div" className="relative mx-auto max-w-[1400px] px-5 py-10">
      <div className="relative grid grid-cols-12 items-center gap-x-5">
        <div className="col-span-3 md:col-span-4 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint chapter-flag">
            {flag}
          </span>
          <span className="divider-tick-l h-px flex-1 bg-gradient-to-r from-transparent via-border to-fg-faint/60" />
        </div>

        <div className="col-span-6 md:col-span-4 flex items-center justify-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-bull">⌖</span>
          <span className="divider-diamond relative inline-flex size-3 rotate-45 items-center justify-center bg-bull">
            <span className="absolute inset-0 -rotate-45 bg-bull blur-md opacity-60" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-bull">⌖</span>
        </div>

        <div className="col-span-3 md:col-span-4 flex items-center gap-3">
          <span className="divider-tick-r h-px flex-1 bg-gradient-to-l from-transparent via-border to-fg-faint/60" />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint chapter-flag text-right">
            {meta}
          </span>
        </div>
      </div>
    </ScrollReveal>
  );
}
