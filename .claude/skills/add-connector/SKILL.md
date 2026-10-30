---
name: add-connector
description: Checklist for adding a new database connector to Vantage (MySQL, SQLite, BigQuery, …) end to end — shared config schema, connector implementation with the untrusted-SQL safety rules, registry, server, web form, tests and docs. Use when someone asks to support a new data source type.
---

# Add a data source connector

User SQL is **untrusted**. A connector is only done when every safety rule below is enforced
and tested. Use the Postgres connector as the reference implementation:
`packages/connectors/src/postgres/`.

## 1. Shared types — `packages/shared/src/data-source.ts`

- Add the type to `connectorTypeSchema` (e.g. `'mysql'`).
- Add `<name>ConfigSchema` (Zod). Secrets (passwords, service-account JSON) live inside it.
- Add a branch to the `dataSourceConfigSchema` discriminated union.
- `DataSource` (the API shape) must never include secrets. `host`/`database` are display-only;
  pick sensible display values for non-host databases (e.g. BigQuery project / dataset).

## 2. Connector — `packages/connectors/src/<name>/`

Implement `ConnectorDefinition<Config>` from `src/types.ts`; `connect(config)` returns a `Connection`:

| Method                                         | Requirements                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `test()`                                       | Never throws. Returns `{ ok, serverVersion?, message?, latencyMs }`. Messages must not contain secrets. |
| `introspect()`                                 | Tables, views (and materialized views) with columns the user can read. Bounded (limit rows, timeout).   |
| `execute(sql, { timeoutMs, maxRows, signal })` | See safety rules. Returns `QueryResult` with normalized `ColumnType`s and JSON-safe cells.              |
| `close()`                                      | Releases pools. Called on delete and when config changes.                                               |

**Safety rules for `execute` (all required):**

1. **Read-only**: read-only transaction/session (or the engine's equivalent, e.g. BigQuery dry-run
   check that the statement is a `SELECT`). Writes must fail with a clear `QueryError`.
2. **One statement** per call. Reject multi-statement input.
3. **Server-side timeout** from `timeoutMs`, plus a client-side backstop.
4. **Row cap**: read at most `maxRows + 1`, return `maxRows`, set `truncated`. Stream/cursor — never
   load the full result first.
5. **Cancellation**: abort the remote query when `signal` fires.
6. **No session leakage**: reset session state after each query; destroy broken connections.
7. Map failures to `QueryError` codes: `QUERY_FAILED` (with `position` if available), `TIMEOUT`,
   `CANCELLED`, `CONNECTION_FAILED`.
8. Values: integers/decimals → numbers when lossless (else strings), dates/timestamps → ISO-like
   strings **without time-zone shifting**, binary → `\x…` hex, objects → JSON strings.

## 3. Register it

- Export from `packages/connectors/src/index.ts` and add to `createDefaultRegistry()`.
- Nothing else on the server should need to change: routes use the registry and
  `ConnectionManager`. Credentials are sealed by `SecretBox` automatically.

## 4. Web — `apps/web/src/app/w/[workspaceId]/data-sources/new/page.tsx`

- Add a type picker if there's more than one connector, and the form fields for the new config.
- Update the read-only-role guidance box with the right SQL/IAM for the engine.
- Schema browser and SQL editor work unchanged; set the CodeMirror dialect in
  `components/sql-editor.tsx` per connector type.

## 5. Tests

- Unit tests for value/type mapping (`types.test.ts`).
- Integration tests gated on an env var (like `TEST_DATABASE_URL`), covering **each safety rule**:
  write refused, multi-statement refused, timeout, cancel, row cap + `truncated`, syntax error
  position, session can't be escaped (e.g. a `SET` that turns off read-only), bad credentials
  without leaking the secret, introspection.
- Add a service to `.github/workflows/ci.yml` if the engine can run in a container.

## 6. Docs

- README "MVP roadmap / Later" list, `.env.example` if new settings, and a sample database in
  `docker-compose.yml` if practical.

Finish with `pnpm check` (and the integration tests with their env var set).
