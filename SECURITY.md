# Security policy

Vantage stores database credentials and runs user-written SQL, so we take security reports seriously.

**Please do not open public issues for vulnerabilities.** Report them privately through
[GitHub Security Advisories](https://github.com/priyankavlt/vantage/security/advisories/new).

We aim to acknowledge reports within 3 business days. Vantage is pre-1.0; only the latest `main` is supported.

## Running Vantage safely

- **Connect with a least-privilege database role.** Vantage runs every query in a read-only
  transaction, one statement at a time, with a timeout and row limit. Read-only mode does **not**
  stop a superuser (or members of `pg_execute_server_program`, `pg_read_server_files`,
  `pg_write_server_files`, `pg_signal_backend`) from running server programs, reading files or
  ending other sessions. Use a role that can only `SELECT`; "Test connection" warns otherwise.
- **Set `VANTAGE_ENCRYPTION_KEY` and `BETTER_AUTH_SECRET`** (separate random values). The server
  refuses to start in production without them.
- **Public dashboard links** are created by workspace owners/admins only, expose only the columns
  each chart draws, are rate-limited and cached, and stop working as soon as they're revoked.
