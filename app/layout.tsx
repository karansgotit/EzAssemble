import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { FakeDataBadge } from "./dev/FakeDataBadge";
import "./globals.css";

// Downloaded at build time and served from our own site, so the app still works with no internet.
// Numerals and titles: heavy figures that read like the step numbers printed in a manual.
const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["800", "900"], variable: "--font-schibsted", display: "swap" });
// Everything read: drawn so letters can be told apart at a glance, from across the room.
const sans = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", display: "swap" });
// Counts and part numbers: 101339 must never read as 10l339.
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-atkinson-mono", display: "swap" });

export const metadata: Metadata = {
  title: "EzAssemble",
  description: "The manual shows you what. We show you how.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <FakeDataBadge />}
      </body>
    </html>
  );
}
