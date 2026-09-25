"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Spinner, cx } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: (ctx: { can: (p: string) => boolean; hasEmployee: boolean }) => boolean;
}

// Menu items show only when the user can actually use the page behind them.
const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, visible: () => true },
  { href: "/employees", label: "Employees", icon: Users, visible: ({ can }) => can("hrm.employee.read") },
  { href: "/attendance", label: "Attendance", icon: Clock, visible: ({ can }) => can("hrm.attendance.read") },
  { href: "/leave", label: "Leave", icon: CalendarDays, visible: ({ can }) => can("hrm.leave.read") },
  { href: "/payroll", label: "Payroll", icon: Wallet, visible: ({ can }) => can("hrm.payroll.read") },
  { href: "/payslips", label: "My payslips", icon: FileText, visible: ({ hasEmployee }) => hasEmployee },
  { href: "/settings", label: "Settings", icon: Settings, visible: ({ can }) => can("hrm.settings.write") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (loading || !me) return <Spinner />;

  const items = NAV.filter((item) => item.visible({ can, hasEmployee: !!me.employee }));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
            isActive(href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          <Icon className="size-5 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-16 items-center gap-2 px-6">
      <div className="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">Q</div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">Quscer HRM</p>
        <p className="max-w-40 truncate text-xs text-slate-500">{me.organization.name}</p>
      </div>
    </div>
  );

  const userBox = (
    <div className="border-t border-slate-200 p-4">
      <p className="truncate text-sm font-medium text-slate-900">
        {me.user.firstName} {me.user.lastName}
      </p>
      <p className="truncate text-xs text-slate-500">{me.roles.join(", ") || "No role"}</p>
      <button
        type="button"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="mt-3 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        {brand}
        {nav}
        {userBox}
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <button type="button" onClick={() => setMenuOpen(true)} className="rounded-md p-2 text-slate-600" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <p className="text-sm font-semibold">Quscer HRM</p>
        <span className="w-9" />
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-white">
            <button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-4 rounded-md p-1 text-slate-500" aria-label="Close menu">
              <X className="size-5" />
            </button>
            {brand}
            {nav}
            {userBox}
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

// Wrap page content that needs a permission the menu already hides — covers
// someone typing the URL directly.
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
        <p className="font-medium text-slate-900">You don&apos;t have access to this page</p>
        <p className="mt-1 text-sm text-slate-500">Ask your HR admin if you think you should.</p>
      </div>
    );
  }
  return <>{children}</>;
}
