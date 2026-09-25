"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Employee, Paginated } from "@/lib/types";
import { Spinner, cx } from "./ui";
import { Icon } from "./figma-icons";
import { TimeSlider } from "./time-slider";
import { PersonAvatar } from "./photo";
import { initials } from "@/lib/format";

// Layout from the Figma Make design: white 200px sidebar with the Quscer
// People logo, 60px white top bar (search, time in/out slider, user), and
// a #f4f6f8 page. Menu items only appear for pages the person can use.

type IconName = Parameters<typeof Icon>[0]["name"];

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  visible: (ctx: { can: (p: string) => boolean; hasEmployee: boolean }) => boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home", visible: () => true },
  { href: "/feed", label: "Feed", icon: "feed", visible: () => true },
  { href: "/profile", label: "My Profile", icon: "user", visible: ({ hasEmployee }) => hasEmployee },
  { href: "/employees", label: "Employees", icon: "users", visible: ({ can }) => can("hrm.employee.read") },
  { href: "/attendance", label: "Attendance", icon: "clock", visible: ({ can }) => can("hrm.attendance.read") },
  { href: "/leave", label: "Leave", icon: "calendar", visible: ({ can }) => can("hrm.leave.read") },
  { href: "/payroll", label: "Payroll", icon: "pay", visible: ({ can }) => can("hrm.payroll.read") },
  { href: "/payslips", label: "My Payslips", icon: "doc", visible: ({ hasEmployee }) => hasEmployee },
  { href: "/settings", label: "Settings", icon: "settings", visible: ({ can }) => can("hrm.settings.write") },
];

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/quscer-mark.png" alt="" className={small ? "size-6" : "size-9"} />
      <div>
        <div
          className={cx("font-bold leading-none text-[#1a1a2e]", small ? "text-[10px]" : "text-sm")}
          style={{ fontFamily: "var(--font-display)" }}
        >
          Quscer
        </div>
        <div className={cx("font-semibold tracking-wide text-[#00b4a6]", small ? "text-[8px]" : "text-[10px]")}>People</div>
      </div>
    </div>
  );
}

export function roleLabel(roles: string[]) {
  return roles.length ? roles.join(", ") : "No role";
}

export { initials } from "@/lib/format";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, can } = useAuth();
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

  const sidebar = (
    <>
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active ? "bg-[#e8faf8] text-[#00857a]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
              )}
            >
              <Icon name={item.icon} size={17} color={active ? "#00b4a6" : "#9ca3af"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-50 px-5 py-5">
        <p className="mb-3 text-[10px] leading-relaxed text-gray-400">
          Better Teams
          <br />
          Build Greater
          <br />
          Businesses
        </p>
        <Logo small />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen text-[#1a1a2e]">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[200px] flex-col border-r border-gray-100 bg-white lg:flex">
        {sidebar}
      </aside>

      {/* Sidebar (phones / tablets) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-64 max-w-[85%] flex-col bg-white">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[200px]">
        <header className="sticky top-0 z-30 flex h-[60px] flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-gray-500 lg:hidden"
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>
          {can("hrm.employee.read") && <SearchBox />}
          <div className="hidden sm:block">
            <TimeSlider />
          </div>
          <div className="flex-1" />
          <UserMenu />
        </header>
        {me.employee && (
          <div className="border-b border-gray-100 bg-white px-4 py-2 sm:hidden">
            <TimeSlider />
          </div>
        )}
        <main className="flex-1 p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}

// Finds employees by name, number or email; Enter opens the first match.
function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const page = await api<Paginated<Employee>>("GET", `/employees?search=${encodeURIComponent(term)}&pageSize=6`);
        setResults(page.items);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function go(id: string) {
    setOpen(false);
    setQ("");
    router.push(`/employees/${id}`);
  }

  return (
    <div className="relative hidden max-w-lg flex-1 md:block">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#f9fafb] px-4 py-2.5">
        <Icon name="search" size={16} color="#9ca3af" />
        <input
          type="search"
          aria-label="Quick search: find an employee"
          placeholder="Search employees…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].id);
            if (e.key === "Escape") setOpen(false);
          }}
          className="w-full bg-transparent text-sm text-[#1a1a2e] placeholder:text-gray-400 focus:outline-none"
        />
      </div>
      {open && q.trim().length >= 2 && (
        <ul className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {results.length === 0 ? (
            <li className="px-4 py-2 text-sm text-gray-400">No one found</li>
          ) : (
            results.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => go(e.id)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#f9fafb]"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-[#e8faf8] text-[10px] font-semibold text-[#00857a]">
                    {initials(e)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#1a1a2e]">
                      {e.firstName} {e.lastName}
                    </span>
                    <span className="block truncate text-[11px] text-gray-400">
                      {e.designation} · {e.employeeNumber}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// Name + role chip from the design, opening a small menu: the company
// switcher (when you work for more than one), My account and Sign out.
function UserMenu() {
  const { me, logout, switchCompany } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!me) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors hover:bg-gray-50"
      >
        {me.employee?.photoUpdatedAt ? (
          <PersonAvatar
            person={me.user}
            photo={{ employeeId: me.employee.id, updatedAt: me.employee.photoUpdatedAt }}
            size={32}
          />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-[#e8faf8] text-xs font-semibold text-[#00857a]">
            {initials(me.user)}
          </span>
        )}
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-none text-[#1a1a2e]">
            {me.user.firstName} {me.user.lastName}
          </span>
          <span className="mt-0.5 block max-w-40 truncate text-[11px] text-gray-400">{roleLabel(me.roles)}</span>
        </span>
        <Icon name="chevron-down" size={14} color="#9ca3af" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          <p className="truncate px-4 py-2 text-xs text-gray-400">{me.organization.name}</p>
          {me.companies.length > 1 && (
            <div className="border-y border-gray-50 py-1">
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Switch company</p>
              {me.companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  disabled={c.id === me.organization.id}
                  onClick={async () => {
                    setOpen(false);
                    await switchCompany(c.id);
                    router.push("/");
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-600 hover:bg-[#f9fafb] disabled:text-[#00857a]"
                >
                  <span className="truncate">{c.name}</span>
                  {c.id === me.organization.id && <Icon name="check-circle" size={14} color="#00b4a6" />}
                </button>
              ))}
            </div>
          )}
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-[#f9fafb]"
          >
            <Icon name="settings" size={15} color="#9ca3af" /> My Account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-600 hover:bg-[#f9fafb]"
          >
            <Icon name="log-out" size={15} color="#9ca3af" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// Wrap page content that needs a permission the menu already hides — covers
// someone typing the URL directly.
export function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
        <p className="font-medium text-[#1a1a2e]">You don&apos;t have access to this page</p>
        <p className="mt-1 text-sm text-gray-500">Ask your HR admin if you think you should.</p>
      </div>
    );
  }
  return <>{children}</>;
}
