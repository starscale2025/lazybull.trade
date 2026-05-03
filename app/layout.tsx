import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const funnel = Bricolage_Grotesque({
  variable: "--font-funnel",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LAZYBULL // Options You Can See",
  description: "Drag across the chain to build options strategies. An AI teacher explains every Greek and trade in plain English. Paper-only, training wheels on by default.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jetbrainsMono.variable} ${funnel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg selection:bg-bull selection:text-bg">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
