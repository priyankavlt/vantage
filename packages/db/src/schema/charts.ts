import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organization, user } from './auth';
import { savedQuery } from './queries';

/** A visualization of a saved query. `spec` is a `ChartSpec` from @vantage/shared. */
export const chart = pgTable(
  'chart',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    queryId: text('query_id')
      .notNull()
      .references(() => savedQuery.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    spec: jsonb('spec').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('chart_workspace_idx').on(t.workspaceId, t.updatedAt)],
);
