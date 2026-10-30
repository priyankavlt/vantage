import type { Connection, ConnectorRegistry, ConnectorType } from '@vantage/connectors';
import { dataSourceConfigSchema } from '@vantage/shared';
import type { SecretBox } from './crypto';

export interface DataSourceRow {
  id: string;
  workspaceId: string;
  type: string;
  encryptedConfig: string;
  updatedAt: Date;
}

/** Ciphertext is bound to the workspace and row it belongs to. */
export const secretContext = (row: { workspaceId: string; id: string }) =>
  `data_source:${row.workspaceId}:${row.id}`;

/**
 * Keeps one open connection pool per data source, so queries reuse
 * connections. A pool is rebuilt when the data source changes.
 */
export class ConnectionManager {
  readonly #pools = new Map<string, { version: number; connection: Connection }>();

  constructor(
    private readonly registry: ConnectorRegistry,
    private readonly secrets: SecretBox,
  ) {}

  /** Open a connection from an unsaved, already validated config (for "test connection"). */
  open(type: ConnectorType, config: unknown): Connection {
    const connector = this.registry.get(type);
    return connector.connect(connector.configSchema.parse(config));
  }

  get(row: DataSourceRow): Connection {
    const version = row.updatedAt.getTime();
    const cached = this.#pools.get(row.id);
    if (cached?.version === version) return cached.connection;
    if (cached) void cached.connection.close().catch(() => undefined);

    const decrypted: unknown = JSON.parse(
      this.secrets.decrypt(row.encryptedConfig, secretContext(row)),
    );
    const { type, config } = dataSourceConfigSchema.parse({ type: row.type, config: decrypted });
    const connection = this.open(type, config);
    this.#pools.set(row.id, { version, connection });
    return connection;
  }

  async evict(id: string): Promise<void> {
    const cached = this.#pools.get(id);
    this.#pools.delete(id);
    await cached?.connection.close().catch(() => undefined);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.#pools.keys()].map((id) => this.evict(id)));
  }
}
