import { CHART_TYPES } from '@vantage/shared';
import { describe, expect, it } from 'vitest';
import { rendererFor } from './renderer';

describe('rendererFor', () => {
  it('has a renderer for every chart type', () => {
    for (const type of CHART_TYPES) {
      expect(rendererFor(type)).toBeDefined();
    }
  });

  it('draws tables and big numbers as HTML', () => {
    expect(rendererFor('table')).toBe('table');
    expect(rendererFor('big-number')).toBe('big-number');
  });
});
