import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organization, user } from './auth';

/** A grid of charts. `items` is `DashboardItem[]` from @vantage/shared. */
export const dashboard = pgTable(
  'dashboard',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    items: jsonb('items').notNull().default([]),
    refreshIntervalSeconds: integer('refresh_interval_seconds'),
    /** Unguessable token for the public read-only link; null when not shared. */
    shareToken: text('share_token').unique(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('dashboard_workspace_idx').on(t.workspaceId, t.updatedAt)],
);
