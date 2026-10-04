import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIndexFields } from './useIndexFields';

const MAPPING_BODY = {
  products: { mappings: { properties: { title: { type: 'text', analyzer: 'standard' } } } },
};
const SETTINGS_BODY = { products: { settings: { index: {} } } };

describe('useIndexFields', () => {
  it('fetches the fields for the given index', async () => {
    const request = vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.endsWith('/_mapping')) return Promise.resolve(MAPPING_BODY);
      if (path.endsWith('/_settings')) return Promise.resolve(SETTINGS_BODY);
      throw new Error(`unexpected ${path}`);
    });

    const { result } = renderHook(() => useIndexFields(request, 'products'));

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].path).toBe('title');
  });

  it('returns an empty list when there is no index name yet', () => {
    const request = vi.fn();
    const { result } = renderHook(() => useIndexFields(request, null));

    expect(result.current).toEqual([]);
  });

  it('does not call the cluster again for the same index', async () => {
    const request = vi.fn().mockImplementation((_method: string, path: string) => {
      if (path.endsWith('/_mapping')) return Promise.resolve(MAPPING_BODY);
      if (path.endsWith('/_settings')) return Promise.resolve(SETTINGS_BODY);
      throw new Error(`unexpected ${path}`);
    });

    const { result, rerender } = renderHook(({ index }: { index: string | null }) => useIndexFields(request, index), {
      initialProps: { index: 'products' },
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
    const callsAfterFirst = request.mock.calls.length;

    rerender({ index: 'other' });
    rerender({ index: 'products' });

    expect(request.mock.calls.length).toBe(callsAfterFirst + 2);
  });
});
