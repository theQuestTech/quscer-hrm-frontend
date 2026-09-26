import { Icon } from "@/components/figma-icons";

// Sign in / sign up: a teal brand panel on the left (wide screens only) and
// the form on the right, in the same look as the app.

const FEATURES = [
  { icon: "clock", text: "Attendance with slide-to-check-in, shifts and late marks" },
  { icon: "pay", text: "Payroll with Pakistani tax, EOBI and social security, payslips and bank files" },
  { icon: "calendar", text: "Leave requests, balances and approvals" },
  { icon: "chart", text: "Performance reviews, training and recruitment" },
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden px-16 py-14 text-white lg:flex"
        style={{ background: "linear-gradient(150deg, #006e65 0%, #00857a 45%, #00b4a6 100%)" }}
      >
        {/* soft circles for depth */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-4">
          <div className="grid size-20 place-items-center rounded-[22px] bg-white shadow-lg shadow-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/quscer-mark.png" alt="" className="size-14" />
          </div>
          <div>
            <p className="text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
              Quscer
            </p>
            <p className="mt-1 text-base font-semibold tracking-wide text-white/80">People</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Better teams,
            <br />
            build greater businesses.
          </h2>
          <p className="mt-4 max-w-md text-base text-white/85">Everything HR needs to run a Pakistani company, in one place.</p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15">
                  <Icon name={f.icon} size={18} color="white" />
                </span>
                <span className="pt-1.5 text-sm text-white/90">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Quscer · hrm.quscer.com</p>
      </aside>

      <main className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 lg:w-1/2">
        {/* On small screens the green side is hidden, so the logo sits above the form. */}
        <div className="mb-10 flex items-center gap-3.5 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/quscer-mark.png" alt="" className="size-16" />
          <div>
            <p className="text-[26px] font-bold leading-none text-[#1a1a2e]" style={{ fontFamily: "var(--font-display)" }}>
              Quscer
            </p>
            <p className="text-sm font-semibold tracking-wide text-[#00b4a6]">People</p>
          </div>
        </div>
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}
