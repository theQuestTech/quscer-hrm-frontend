import type { Metadata } from "next";

export const metadata: Metadata = { title: "Careers" };

// Public pages — no sign-in, no app menu.
export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">{children}</main>
      <footer className="pb-10 text-center text-xs text-slate-400">
        Powered by{" "}
        <a href="https://quscer.com" className="font-medium text-[#00857a] hover:underline">
          Quscer People
        </a>
      </footer>
    </div>
  );
}
