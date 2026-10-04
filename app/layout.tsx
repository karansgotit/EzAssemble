import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FakeDataBadge } from "./dev/FakeDataBadge";
import "./globals.css";

export const metadata: Metadata = {
  title: "EzAssemble",
  description: "Turn a confusing IKEA assembly manual into clear, animated 3D steps.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <FakeDataBadge />}
      </body>
    </html>
  );
}
