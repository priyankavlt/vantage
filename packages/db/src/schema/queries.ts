import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organization, user } from './auth';
import { dataSource } from './data-sources';

/** A saved SQL query. Keeps its SQL if its data source is deleted. */
export const savedQuery = pgTable(
  'saved_query',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    dataSourceId: text('data_source_id').references(() => dataSource.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    sql: text('sql').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('saved_query_workspace_idx').on(t.workspaceId, t.updatedAt)],
);
