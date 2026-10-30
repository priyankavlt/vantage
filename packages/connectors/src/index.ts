import { postgresConnector } from './postgres';
import { ConnectorRegistry } from './registry';

export * from './limits';
export { postgresConnector } from './postgres';
export * from './registry';
export { QueryError } from './types';
export type * from './types';

/** A registry with every built-in connector. */
export function createDefaultRegistry(): ConnectorRegistry {
  return new ConnectorRegistry().register(postgresConnector);
}
