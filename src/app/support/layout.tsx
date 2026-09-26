import type { Metadata } from "next";
import { SupportProvider } from "@/lib/support";

export const metadata: Metadata = {
  title: "Quscer Support",
  robots: { index: false, follow: false },
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <SupportProvider>{children}</SupportProvider>;
}
