import type { Metadata } from "next";
// Fonts from the design, bundled with the app (no Google Fonts request).
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { CodePrompt } from "@/components/two-step";

export const metadata: Metadata = {
  title: "Quscer HRM",
  description: "People, attendance, leave and payroll for your company",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <CodePrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
