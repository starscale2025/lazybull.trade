// The tier cards, derived from the plan constants and nothing else.
//
// Every feature line on /pricing is generated from PLAN_LIMITS
// (lib/billing/types.ts) — the same object the gates in app/api/explain and
// app/api/workspaces enforce — so a number can never be advertised here and
// enforced differently there. That gap is what the 2026-09 diligence memo
// found: "The '5 explains per day' free-tier limit on the pricing page does
// not exist in code."
//
// Paid tiers list as FEATURES only what code gates today: the explain cap,
// the workspace cap, and the Pro practice set (lib/practice/access.ts). The
// bot-library caps and BYO-bot import are in PLAN_LIMITS but enforced
// nowhere yet, so they appear as demoted roadmap lines, never as features —
// the memo's "the paid tiers sell data they don't have". Power is
// waitlist-only until the licensed IV feed it is defined by exists.
//
// Pure: safe for the client bundle.

import { PLAN_LIMITS, type Plan } from "@/lib/billing/types";

export type TierDef = {
  id: Plan;
  name: string;
  blurb: string;
  /** The lines that differentiate the tier — each one gated in code. */
  features: string[];
  /** Commodity or roadmap lines, rendered demoted. */
  extras: string[];
  /** The page's one filled CTA. Emphasis only: no popularity claim rides on it. */
  primary?: boolean;
  /** Not purchasable: waitlist-only. */
  soon?: boolean;
};

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const unlimitedOr = (n: number | null, one: string, many = `${one}s`) =>
  n === null ? `Unlimited ${many}` : count(n, one, many);
const explainsLine = (n: number | null) =>
  n === null ? "Unlimited AI-teacher explains" : `AI teacher · ${n} explains per day`;

export function buildTiers(): TierDef[] {
  const free = PLAN_LIMITS.free;
  const plus = PLAN_LIMITS.plus;
  const pro = PLAN_LIMITS.pro;
  const power = PLAN_LIMITS.power;
  return [
    {
      id: "free",
      name: "Free",
      blurb: "The whole primer. Real practice. Forever.",
      features: ["Full 14-chapter interactive primer", "Unlimited paper trades", explainsLine(free.explainsPerDay)],
      primary: true,
      extras: [
        unlimitedOr(free.workspaces, "saved workspace"),
        "Practice · the free problem set",
      ],
    },
    {
      id: "plus",
      name: "Plus",
      blurb: "For the learner who finished the primer.",
      features: [
        explainsLine(plus.explainsPerDay),
        unlimitedOr(plus.workspaces, "saved workspace"),
        ...(plus.practicePro ? ["Practice · Pro problems + editorials"] : []),
      ],
      extras: ["Everything in Free"],
    },
    {
      id: "pro",
      name: "Pro",
      blurb: "Plus today, and the bot library as it ships.",
      features: [
        explainsLine(pro.explainsPerDay),
        unlimitedOr(pro.workspaces, "saved workspace"),
        ...(pro.practicePro ? ["Practice · Pro problems + editorials"] : []),
      ],
      extras: [
        "Everything in Plus",
        `Roadmap · ${unlimitedOr(pro.bots, "bot", "bots").toLowerCase()}${pro.customBots ? " + bring-your-own-bot" : ""}`,
      ],
    },
    {
      id: "power",
      name: "Power",
      blurb: "For graduating quants. Ships with a licensed IV feed.",
      features: [
        "Everything in Pro",
        ...(power.practicePower ? ["Practice · Power-tier problems"] : []),
        "Licensed IV & Greeks feed",
      ],
      extras: ["Waitlist only until the feed is licensed"],
      soon: true,
    },
  ];
}
