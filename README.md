# Quscer HRM — Web App

Next.js 15 + Tailwind CSS frontend for Quscer HRM. It talks to the
`quscer-hrm-backend` API and runs standalone for now; later, Quscer OS will
open it in a new tab from a single button.

## What's in it

| Page | Who sees it | What it does |
|---|---|---|
| Sign in / Create account | Everyone | Company sign-up creates the org and its first HR admin |
| Dashboard | Everyone | Check-in widget, leave balance, latest payslip; HR also sees headcount, who's in, pending leave, expiring documents, latest payroll |
| Employees | `hrm.employee.read` | Directory with search and filters, add/edit, profile with emergency contacts, documents, bank (masked), salary & loans, login access |
| Attendance | `hrm.attendance.read` | Check in/out and monthly history; managers get the daily register to mark Present / Absent / Half day |
| Leave | `hrm.leave.read` | Balances, request and cancel leave; approvers get Approvals and per-employee allocations |
| Payroll | `hrm.payroll.read` | Create a monthly run, review each person's breakdown and exceptions, send for approval → approve → mark paid, download payslips and the bank payment file (CSV) |
| My payslips | Anyone linked to an employee record | Approved payslips with PDF download |
| Settings | `hrm.settings.write` | Company & weekend days, branches, departments, cost centres, shifts, holidays, leave types, users & roles (incl. resetting someone's password) |
| My account | Everyone | Change your own password |

Menu items only appear when the signed-in user has the permission for them.

## Run locally

```bash
npm install
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at the backend
npm run dev                  # http://localhost:3000
```

The backend must be running and seeded (`npm run prisma:seed` in
`quscer-hrm-backend`) or sign-up fails.

## Deploy (Vercel)

1. Import this repo in Vercel (framework preset: Next.js).
2. Add the environment variable `NEXT_PUBLIC_API_URL` = the backend's public
   URL, e.g. `https://quscer-hrm-backend.up.railway.app` (no trailing slash).
3. Deploy, then set `CORS_ORIGINS` on the backend to this site's URL.

## First-time setup in the app

1. Create the company account (you become HR admin + payroll approver).
2. Settings → check weekend days, add at least one branch (its province
   drives tax and social security), add holidays.
3. Employees → add people, set each salary, and give logins where needed.
   Add yourself too and use "Link my account" so you can check in and get
   payslips.

## Not built yet

- File upload for documents (paste a link for now)
- Emailed password-reset links (HR resets passwords from Settings → Users & roles)
- Org chart view, timesheets, reports, onboarding/offboarding screens
