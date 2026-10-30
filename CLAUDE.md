# Vantage

Open-source, self-hostable BI platform (Metabase/Superset alternative). TypeScript monorepo.

## Layout

- `apps/web` — Next.js 16 App Router, Tailwind v4, shadcn/ui (`components.json`). Proxies `/api/*` to the server.
- `apps/server` — Fastify 5 API with Zod type provider. Built with tsdown.
- `packages/shared` — Zod schemas + types used by both sides (query results, chart types, API errors).
- `packages/db` — Drizzle ORM + node-postgres. App metadata only, never customer data.
- `packages/connectors` — `ConnectorDefinition` / `Connection` interface, registry, `resolveQueryLimits`, Postgres connector.
- `packages/charts` — pure `buildChart(spec, result, mode)` → ECharts options, palette, `BigNumber`.
  The `EChart` component is at `@vantage/charts/echart` and must be loaded client-only.
- `tooling/*` — shared tsconfig and ESLint flat configs.
- Why a separate server: `docs/adr/0001-separate-api-server.md`.

## Commands

- `pnpm check` — what CI runs (prettier, eslint, tsc, vitest). Run before finishing any change.
- `pnpm dev`, `pnpm build`, `pnpm db:up`.
- Filter to one package: `pnpm --filter @vantage/server test`.
- Node 24 (`.nvmrc`, use fnm). pnpm 12. TypeScript is pinned to 6.0 because typescript-eslint doesn't support 7 yet.

## Rules

- Internal packages export TS source (`"exports": { ".": "./src/index.ts" }`). Use extensionless relative imports.
- No `any` at public boundaries. Validate all external input (HTTP, env, connector configs) with Zod.
- New Fastify routes: schemas from `@vantage/shared`, errors in the `ApiError` shape.
- Every tenant-owned table has `workspace_id`; every query filters by it.
- **User SQL is untrusted.** Connectors must use read-only transactions, database-side timeouts and row caps
  via `resolveQueryLimits`. Never log or return decrypted credentials.
- Env vars used at build time must be listed in `turbo.json` `env`, or Turborepo strips them.
- Server routes for user SQL go through `runForRequest` (apps/server/src/run-query.ts): workspace scoping,
  concurrency cap, limits, disconnect-cancel.
- Integration tests need `TEST_DATABASE_URL` (each suite creates and drops its own database).
- Conventional Commits.

## Project skills

- `.claude/skills/add-connector` — adding a data source type (safety rules for untrusted SQL).
- `.claude/skills/add-chart-type` — adding a visualization (spec → renderer → builder UI).
