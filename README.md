# BMC Internal Tool

Blue Moon Creatives Tool is the internal operations workspace for **Blue Moon Creatives**. It brings day-to-day delivery, sales, planning, scheduling, and reporting into one responsive application so the team can work from a shared source of truth.

## Product scope

The workspace is organized around the following core modules:

- **Home** — operational overview and key activity.
- **Tasks** — work assignment, ownership, priority, status, and deadlines.
- **Leads** — prospect tracking and pipeline qualification.
- **Quotations** — preparation and follow-up of client estimates.
- **Calendars** — meetings, deadlines, and shared events.
- **Plans** — goals, milestones, and delivery planning.
- **Schedule** — team assignments and upcoming work.
- **Reports & Analytics** — performance, pipeline, and delivery insights.

The application uses a floating sidebar shell throughout, supports light and dark themes, and is responsive for desktop and mobile use.

## Current status

The application shell, authenticated route structure, sidebar navigation, command menu, theme controls, responsive layout, and initial module views are implemented. The module data currently uses local demonstration data while business workflows and persistence are developed.

## Technology

- Next.js 16 and React 19
- TypeScript
- TanStack Router and TanStack Query
- Tailwind CSS and shadcn/ui
- Vitest and Playwright browser testing

## Local development

Requirements: Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The Clerk routes are optional demonstrations. To enable them, copy `.env.example` to `.env.local` and provide a publishable key.

## Superadmin, email, and OTP setup

The MongoDB-backed authentication flow automatically creates or upgrades
`contact.bluemooncreatives@gmail.com` as the protected system owner. The owner
always has the `superadmin` role, remains active, and must complete email OTP
verification after entering a valid password.

1. Copy the variables from `.env.example` into `.env` or `.env.local`.
2. Set `MONGODB_URI` and a long random `JWT_SECRET`.
3. Enable 2-Step Verification on the Gmail account and create a Google App
   Password.
4. Put that 16-character App Password in `SMTP_PASSWORD` (never the normal
   Gmail password).
5. Optionally set `SUPERADMIN_PASSWORD` before the first request. If the owner
   already exists or no bootstrap password was set, use **Reset password** on
   the sign-in screen; the emailed OTP authorizes creation of a new password.

In local development only, a missing `SMTP_PASSWORD` prints the OTP to the
server console. Production refuses email delivery when SMTP is not configured.
OTP values are not stored directly: only keyed hashes are persisted. Codes are
single-use, expire after 10 minutes, allow five attempts, have a 60-second
resend cooldown, and are limited to five sends per email and purpose per hour.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Project structure

```text
src/app/                  Next.js application entry
src/components/           Shared UI and application shell
src/features/             Feature-level screens and workflows
src/routes/               TanStack file routes
src/context/              Theme, layout, direction, and search state
src/styles/               Global design tokens and styling
```

## Internal use

This repository is intended for Blue Moon Creatives' internal operations. Do not commit credentials, client-sensitive data, or production environment values. Use local environment files for secrets.

## Foundation

The initial interface was adapted from the open-source Shadcn Admin dashboard and is being developed into a purpose-built Blue Moon Creatives product.
