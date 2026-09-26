// Icons exactly as drawn in the Figma Make design (same paths, 1.8 stroke).
// Only "users", "feed", "log-in", "log-out", "arrow-right" and "help" are added,
// drawn in the same style, for pages the design doesn't show.

type IconName =
  | "home" | "user" | "users" | "clock" | "calendar" | "pay" | "doc" | "chart" | "book" | "briefcase"
  | "settings" | "bell" | "search" | "chevron-right" | "chevron-left" | "chevron-down" | "check-circle"
  | "arrow-up" | "star" | "feed" | "log-in" | "log-out" | "arrow-right" | "x-circle" | "menu" | "help";

export function Icon({
  name,
  size = 18,
  color = "currentColor",
  className,
}: {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}) {
  const s = { width: size, height: size, flexShrink: 0 };
  const p = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };
  switch (name) {
    case "home":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" /><polyline points="9,21 9,12 15,12 15,21" /></svg>;
    case "user":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case "users":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
    case "clock":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case "calendar":
      return <svg style={s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case "pay":
      return <svg style={s} viewBox="0 0 24 24" {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>;
    case "doc":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case "chart":
      return <svg style={s} viewBox="0 0 24 24" {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>;
    case "book":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
    case "briefcase":
      return <svg style={s} viewBox="0 0 24 24" {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /><line x1="12" y1="12" x2="12" y2="12" /><path d="M2 12h20" /></svg>;
    case "settings":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
    case "help":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case "bell":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>;
    case "search":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case "chevron-right":
      return <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="9 18 15 12 9 6" /></svg>;
    case "chevron-left":
      return <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="15 18 9 12 15 6" /></svg>;
    case "chevron-down":
      return <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="6 9 12 15 18 9" /></svg>;
    case "check-circle":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
    case "x-circle":
      return <svg style={s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
    case "arrow-up":
      return <svg style={s} viewBox="0 0 24 24" fill="none" aria-hidden className={className}><path d="M12 19V5m0 0l-7 7m7-7l7 7" stroke={color} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "star":
      return <svg style={s} viewBox="0 0 24 24" {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    case "feed":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>;
    case "log-in":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>;
    case "log-out":
      return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
    case "arrow-right":
      return <svg style={s} viewBox="0 0 24 24" {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
    case "menu":
      return <svg style={s} viewBox="0 0 24 24" {...p}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>;
  }
}
