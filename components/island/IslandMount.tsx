"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useIsland } from "@/lib/island";

// The Island's code (and motion's layout animation with it) loads the first
// time a page has something to put on it, not with every page: most visits
// never drag a strike, and frame zero's byte budget is shared with the film.
const Island = dynamic(() => import("./Island").then((m) => m.Island), { ssr: false });

export function IslandMount() {
  const state = useIsland();
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (state) setWanted(true);
  }, [state]);
  return wanted ? <Island /> : null;
}
