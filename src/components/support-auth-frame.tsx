// The console's sign-in pages: a dark panel so staff never mistake them for
// a customer's HRM sign-in.
export function SupportAuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#10222a] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#10222a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/quscer-mark.png" alt="" className="size-7" />
          </span>
          <span>
            <span className="block text-lg font-bold leading-tight text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
              Quscer
            </span>
            <span className="block text-xs font-semibold text-[#00857a]">Support console · staff only</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
