"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/stores";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Contrast mode: RADAR (AA, default) vs STEALTH (the opt-in whisper
    // terminal — see [data-contrast="stealth"] in globals.css). Persisted by
    // the footer toggle; applied here so every page boots into the choice.
    try {
      if (localStorage.getItem("lb-contrast") === "stealth") {
        root.dataset.contrast = "stealth";
      }
    } catch {}
  }, [theme]);
  return <>{children}</>;
}
