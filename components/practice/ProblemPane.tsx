"use client";

// The left half of the workspace: the problem, in three tabs. A thin shell —
// the Panel frame from ./Panel.tsx with the underline tabs in its title row.
// The bodies live in ./ProblemTabs.tsx.

import { useState } from "react";
import type { ClientProblem } from "@/lib/practice/types";
import { Panel } from "./Panel";
import { DescriptionTab, EditorialTab, SubmissionsTab, UnderlineTabs, type TabDef } from "./ProblemTabs";

type PaneTab = "description" | "editorial" | "submissions";

const TABS: TabDef<PaneTab>[] = [
  { id: "description", label: "Description" },
  {
    id: "editorial",
    label: (
      <>
        Editorial <span className="ml-1 text-fg-faint">⊘ Plus</span>
      </>
    ),
  },
  { id: "submissions", label: "Submissions" },
];

export function ProblemPane({ problem, className = "" }: { problem: ClientProblem; className?: string }) {
  const [tab, setTab] = useState<PaneTab>("description");

  return (
    <Panel title={<UnderlineTabs tabs={TABS} value={tab} onChange={setTab} label="Problem tabs" />} className={className}>
      {tab === "description" && <DescriptionTab problem={problem} />}
      {tab === "editorial" && <EditorialTab problem={problem} />}
      {tab === "submissions" && <SubmissionsTab problem={problem} />}
    </Panel>
  );
}
