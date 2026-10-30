/**
 * App metadata schema. Tables arrive in later MVP steps:
 * - step 2: users, sessions, workspaces, memberships (better-auth)
 * - step 3: data_sources (credentials encrypted at rest)
 * - step 4-6: saved_queries, charts, dashboards, share_links
 *
 * Every tenant-owned table carries a `workspace_id`.
 */
export {};
