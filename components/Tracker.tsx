"use client";

// One page_view per route change — the backbone of the events stream.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

export function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) track("page_view");
  }, [pathname]);
  return null;
}
