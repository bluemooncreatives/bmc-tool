# BMC Internal Tool

BMC Tool is the internal operations workspace for **Blue Moon Creatives**. It brings day-to-day delivery, sales, planning, scheduling, and reporting into one responsive application so the team can work from a shared source of truth.

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
