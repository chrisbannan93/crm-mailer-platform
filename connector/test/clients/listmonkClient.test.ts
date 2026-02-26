import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListmonkClient } from '../../src/clients/listmonkClient.js';

describe('ListmonkClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists lists via API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { results: [{ id: 1, name: 'A', type: 'private', optin: 'single' }] } }),
      }),
    );

    const client = new ListmonkClient({ baseUrl: 'http://listmonk:9000', apiUser: 'u', apiPassword: 'p' });
    const lists = await client.listLists();

    expect(lists).toHaveLength(1);
    expect(lists[0]?.name).toBe('A');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('creates list when ensureList does not find one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: { results: [] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: { id: 2, name: 'New List', type: 'private', optin: 'single' } }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const client = new ListmonkClient({ baseUrl: 'http://listmonk:9000' });
    const list = await client.ensureList({ name: 'New List', type: 'private', optin: 'single' });

    expect(list.id).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
