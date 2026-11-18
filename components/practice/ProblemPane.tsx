"use client";

// The left half of the workspace: the problem, in three tabs. A thin shell —
// the deck's pane-tab strip (the Playground mockup, slide 7: the active tab
// bone over a green underline that sits on the hairline) above a body that
// scrolls inside the desk at lg. The bodies live in ./ProblemTabs.tsx.

import { useState } from "react";
import type { ClientProblem } from "@/lib/practice/types";
import { DescriptionTab, EditorialTab, PaneTabs, SubmissionsTab, type TabDef } from "./ProblemTabs";

type PaneTab = "description" | "editorial" | "submissions";

const TABS: TabDef<PaneTab>[] = [
  { id: "description", label: "Description" },
  {
    id: "editorial",
    label: (
      <>
        {/* The plan it opens with, as a quiet mono tag beside the word. */}
        Editorial <span className="ml-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-faint">⊘ Plus</span>
      </>
    ),
  },
  { id: "submissions", label: "Submissions" },
];

export function ProblemPane({ problem, figure, className = "" }: { problem: ClientProblem; figure?: React.ReactNode; className?: string }) {
  const [tab, setTab] = useState<PaneTab>("description");

  return (
    <section className={`flex h-full flex-col ${className}`}>
      <div className="shrink-0 border-b border-border px-5 sm:px-6">
        <PaneTabs tabs={TABS} value={tab} onChange={setTab} label="Problem tabs" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "description" && <DescriptionTab problem={problem} figure={figure} />}
        {tab === "editorial" && <EditorialTab problem={problem} />}
        {tab === "submissions" && <SubmissionsTab problem={problem} />}
      </div>
    </section>
  );
}
