"use client";

// The left half of the workspace: the problem, in three tabs. A thin shell —
// the Panel frame from ./Panel.tsx with the tab pills in its title row. The
// bodies live in ./ProblemTabs.tsx.

import { useState } from "react";
import type { ClientProblem } from "@/lib/practice/types";
import { Panel } from "./Panel";
import { DescriptionTab, EditorialTab, PaneTabs, SubmissionsTab, type TabDef } from "./ProblemTabs";

type PaneTab = "description" | "editorial" | "submissions";

const TABS: TabDef<PaneTab>[] = [
  { id: "description", label: "Description" },
  {
    id: "editorial",
    label: (
      <>
        {/* Opacity, not a faint token: the pill inverts when it is on. */}
        Editorial <span className="ml-1 opacity-60">⊘ Plus</span>
      </>
    ),
  },
  { id: "submissions", label: "Submissions" },
];

export function ProblemPane({ problem, className = "" }: { problem: ClientProblem; className?: string }) {
  const [tab, setTab] = useState<PaneTab>("description");

  return (
    <Panel title={<PaneTabs tabs={TABS} value={tab} onChange={setTab} label="Problem tabs" />} className={className}>
      {tab === "description" && <DescriptionTab problem={problem} />}
      {tab === "editorial" && <EditorialTab problem={problem} />}
      {tab === "submissions" && <SubmissionsTab problem={problem} />}
    </Panel>
  );
}
