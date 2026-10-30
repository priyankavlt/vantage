# Contributing to Vantage

Thanks for helping build Vantage!

## Setup

1. Install Node.js 24+ (the repo has an `.nvmrc`; `fnm` or `nvm` will pick it up) and Docker.
2. `corepack enable` (gives you the pinned pnpm version).
3. `pnpm install`, `cp .env.example .env`, `pnpm db:up`, `pnpm dev`.

## Before you open a PR

```sh
pnpm check   # prettier, eslint, tsc, vitest — the same checks CI runs
```

## Conventions

- **Conventional Commits** for commit messages and PR titles:
  `feat(connectors): add MySQL connector`, `fix(web): …`, `docs: …`, `chore(deps): …`.
  Scopes are package names without the prefix: `web`, `server`, `db`, `shared`, `connectors`, `charts`.
- **Strict TypeScript.** No `any` at package boundaries (ESLint enforces it). Prefer `unknown` + Zod.
- **Validate with Zod at every API boundary**: request bodies, query params, env vars, connector configs.
  Put shared schemas in `@vantage/shared` so the web app and server agree.
- **Tests** live next to the code as `*.test.ts` and run with Vitest.
- **Packages export TypeScript source.** No build step for internal packages; apps compile them.

## Security rules for query execution

Vantage runs SQL written by users against databases they connect. Treat it as untrusted:

- Every connector runs queries in a **read-only** transaction or session.
- Every query has a **database-side timeout** and a **row limit** (`resolveQueryLimits` in `@vantage/connectors`).
- Credentials are **encrypted at rest** and never logged or returned by the API.
- Encourage users to connect with a dedicated read-only database role.

## Adding a connector

1. Create `packages/connectors/src/<name>/` implementing `ConnectorDefinition`.
2. Add the type to `ConnectorType` and register it.
3. Implement `test`, `introspect`, `execute` (honoring the rules above) and `close`.
4. Add tests and document the required database permissions.

## License

By contributing, you agree your contributions are licensed under the Apache License 2.0.
