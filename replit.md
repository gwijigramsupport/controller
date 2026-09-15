# WhatsApp Session Cloud

Multi-tenant control center for securely pairing, monitoring, and operating multiple linked WhatsApp accounts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/whatsapp-saas` — React dashboard, public landing page, Clerk sign-in, and session operations UI.
- `artifacts/api-server` — Express API, Clerk middleware, per-session WhatsApp worker manager, and protected routes.
- `lib/api-spec/openapi.yaml` — source of truth for dashboard/session API contracts.
- `lib/db/src/schema` — Drizzle schema for tenant-scoped sessions and activity events.

## Architecture decisions

- Clerk owns browser authentication; API routes derive the tenant from the Clerk user ID and never accept an owner ID from the client.
- Each WhatsApp account is isolated by an owner/session key and gets its own Baileys socket plus filesystem auth directory.
- PostgreSQL stores session metadata and activity; WhatsApp credentials stay in the per-session auth directory and are never returned by the API.
- OpenAPI is the contract source; generated React Query hooks and Zod schemas are used by the dashboard and API.

## Product

Users can create isolated WhatsApp sessions, request pairing codes, connect or stop workers, log out device credentials, delete sessions, and review fleet health and activity.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- The dashboard is tenant-protected; unauthenticated visitors see the landing page and must sign in before the API returns session data.
- Baileys session directories should be backed by persistent storage before production scale-out; the current manager is process-local and intended as the first operational foundation.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
