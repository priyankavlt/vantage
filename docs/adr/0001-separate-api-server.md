# ADR 0001: A separate Fastify API server

- Status: accepted
- Date: 2026-10-30

## Context

Vantage needs a backend for auth, data source management and running queries against customer
databases. Options: Next.js route handlers inside `apps/web`, or a separate service.

## Decision

Run a separate Fastify service in `apps/server`. The Next.js app proxies `/api/*` to it, so the
browser only ever talks to one origin.

## Why

- **Long-lived connection pools.** Each data source needs a pool kept warm across requests.
  A long-running Node process does this naturally; route handlers may run in short-lived or edge contexts.
- **Query control.** Timeouts, cancellation, row limits and (later) streaming results and job
  queues for scheduled reports are easier in a plain server we fully control.
- **A real public API.** The future embedding SDK and integrations need a stable HTTP API that
  doesn't depend on the UI framework.
- **Independent scaling.** Query execution can be scaled or isolated separately from page rendering.
- Fastify has first-class Zod support (`fastify-type-provider-zod`) and is fast.

## Costs

- Two processes in development and deployment (Turborepo and Docker Compose handle this).
- Auth sessions must work across both. The same-origin `/api` proxy keeps cookies simple.

## Other choices made with this ADR

- **Auth:** better-auth, using its organization plugin for workspaces and memberships.
- **Charts:** Apache ECharts, wrapped in typed components in `@vantage/charts`.
- **Internal packages ship TypeScript source.** Next.js transpiles them; the server bundles them with tsdown.
- **App directory naming:** deployable services live in `apps/` (`web`, `server`), libraries in `packages/`.
