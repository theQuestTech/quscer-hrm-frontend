export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <div className="grid size-10 place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white">Q</div>
        <span className="text-xl font-semibold text-slate-900">Quscer HRM</span>
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">{children}</div>
    </div>
  );
}
