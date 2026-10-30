<p align="center">
  <img src="assets/icon.svg" width="64" height="64" alt="Vantage logo">
</p>

<h1 align="center">Vantage</h1>

<p align="center">
  Open-source, self-hostable business intelligence. Connect your data, write queries, build charts, share dashboards.
</p>

<p align="center">
  <a href="https://github.com/priyankavlt/vantage/actions/workflows/ci.yml"><img src="https://github.com/priyankavlt/vantage/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License: Apache-2.0"></a>
</p>

> **Status: early development.** The MVP is being built in the open. Nothing is production-ready yet.

## Why Vantage

Tools like Tableau and Power BI are expensive and closed. Metabase and Superset are open, but
Vantage aims for a modern, fully typed TypeScript stack and a first-class developer experience:

- **Self-hosted.** Your data and credentials stay on your infrastructure.
- **SQL-first.** Write queries, save them, and turn results into charts.
- **Dashboards you can share.** Grid layouts, auto-refresh, public read-only links.
- **Safe by default.** User SQL is treated as untrusted: every query runs in a read-only transaction,
  one statement at a time, with a server-side timeout and a row limit. Credentials are encrypted at rest (AES-256-GCM).
- **Built to extend.** A small connector interface makes new databases straightforward to add.

## MVP roadmap

1. [x] Monorepo scaffold, CI, Docker Compose
2. [x] Auth and workspaces (users, workspaces, memberships)
3. [x] Data sources: Postgres connections with encrypted credentials, test connection, schema browser
4. [ ] SQL editor: run queries, virtualized results table, saved queries
5. [ ] Chart builder: bar, line, area, pie, table, big number
6. [ ] Dashboards: grid layout, auto-refresh, public share links

Later: MySQL, SQLite and BigQuery connectors, scheduled reports, row-level permissions, an embedding SDK.

## Quickstart

**Requirements:** Node.js 24+, pnpm 12 (via `corepack enable`), Docker.

```sh
git clone git@github.com:priyankavlt/vantage.git
cd vantage
corepack enable
pnpm install
cp .env.example .env     # then fill in the secrets (see comments in the file)
pnpm db:up               # start Postgres in Docker
pnpm dev                 # web on :3000, API on :4000
```

Open <http://localhost:3000>, create an account, and add the **sample shop database**
(started by `pnpm db:up`) under **Data sources**:

| Field    | Value                                                          |
| -------- | -------------------------------------------------------------- |
| Host     | `localhost` (or `warehouse` when running everything in Docker) |
| Port     | `5434` (or `5432` inside Docker)                               |
| Database | `shop`                                                         |
| User     | `vantage_reader`                                               |
| Password | `reader`                                                       |

**Everything in Docker** (no local Node needed):

```sh
docker compose --profile app up --build
```

## Repository layout

```
apps/
  web/          Next.js App Router UI (Tailwind, shadcn/ui)
  server/       Fastify API: auth, data sources, query execution
packages/
  shared/       Zod schemas and types shared everywhere
  db/           Drizzle schema, client, migrations (app metadata)
  connectors/   Connector interface + database implementations
  charts/       Typed React chart components on Apache ECharts
tooling/
  tsconfig/     Shared TypeScript configs
  eslint-config/ Shared ESLint configs
docs/adr/       Architecture decision records
```

## Common commands

| Command       | What it does                        |
| ------------- | ----------------------------------- |
| `pnpm dev`    | Run all apps in watch mode          |
| `pnpm check`  | Format check, lint, typecheck, test |
| `pnpm build`  | Production build of every package   |
| `pnpm db:up`  | Start local Postgres                |
| `pnpm format` | Format the repo with Prettier       |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Found a security issue? See [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE)
