import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// The pages under /dev are tools for the team. A production build (the deployed site, or `npm start`)
// answers "not found" for all of them.
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
