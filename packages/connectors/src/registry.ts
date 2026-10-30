import type { ConnectorDefinition, ConnectorType } from './types';

/**
 * Connectors register here. Step 3 of the MVP adds `postgres`.
 * Kept as a plain map so tests can register fakes.
 */
export class ConnectorRegistry {
  readonly #connectors = new Map<ConnectorType, ConnectorDefinition>();

  register<TConfig>(definition: ConnectorDefinition<TConfig>): this {
    if (this.#connectors.has(definition.type)) {
      throw new Error(`Connector "${definition.type}" is already registered`);
    }
    this.#connectors.set(definition.type, definition);
    return this;
  }

  get(type: ConnectorType): ConnectorDefinition {
    const connector = this.#connectors.get(type);
    if (!connector) throw new Error(`Unknown connector type "${type}"`);
    return connector;
  }

  list(): ConnectorDefinition[] {
    return [...this.#connectors.values()];
  }
}
