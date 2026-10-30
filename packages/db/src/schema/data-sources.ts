import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organization, user } from './auth';

/**
 * A connection to a customer database. Secrets live only in `encrypted_config`
 * (AES-256-GCM, see apps/server/src/crypto.ts). `host` and `database` are kept
 * in plain text for display.
 */
export const dataSource = pgTable(
  'data_source',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    host: text('host').notNull(),
    database: text('database').notNull(),
    encryptedConfig: text('encrypted_config').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('data_source_workspace_name_idx').on(t.workspaceId, t.name),
    index('data_source_workspace_idx').on(t.workspaceId),
  ],
);
