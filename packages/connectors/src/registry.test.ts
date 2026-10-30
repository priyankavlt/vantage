import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ConnectorRegistry } from './registry';
import type { ConnectorDefinition } from './types';

const fake: ConnectorDefinition<{ url: string }> = {
  type: 'postgres',
  displayName: 'Fake',
  configSchema: z.object({ url: z.string() }),
  connect: () => {
    throw new Error('not used');
  },
};

describe('ConnectorRegistry', () => {
  it('registers and looks up connectors', () => {
    const registry = new ConnectorRegistry().register(fake);
    expect(registry.get('postgres').displayName).toBe('Fake');
    expect(registry.list()).toHaveLength(1);
  });

  it('rejects duplicate registrations', () => {
    const registry = new ConnectorRegistry().register(fake);
    expect(() => registry.register(fake)).toThrow(/already registered/);
  });
});
