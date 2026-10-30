import { postgresConfigSchema, type PostgresConfig } from '@vantage/shared';
import type { ConnectorDefinition } from '../types';
import { connectPostgres } from './connection';

export const postgresConnector: ConnectorDefinition<PostgresConfig> = {
  type: 'postgres',
  displayName: 'PostgreSQL',
  configSchema: postgresConfigSchema,
  connect: connectPostgres,
};

export { connectPostgres, normalizeSql, privilegeWarnings } from './connection';
