"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/stores";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
  }, [theme]);
  return <>{children}</>;
}
