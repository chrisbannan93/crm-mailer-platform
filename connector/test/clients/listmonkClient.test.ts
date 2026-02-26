import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListmonkClient, ListmonkClientError } from '../../src/clients/listmonkClient.js';

describe('ListmonkClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists lists via API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: { results: [{ id: 1, name: 'A', type: 'private', optin: 'single' }] } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ListmonkClient({
      baseUrl: 'http://listmonk:9000',
      authMode: 'basic',
      authUser: 'u',
      authPassword: 'p',
    });
    const lists = await client.listLists();

    expect(lists).toHaveLength(1);
    expect(lists[0]?.name).toBe('A');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
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

  it('builds token auth as basic user:token when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { results: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ListmonkClient({
      baseUrl: 'http://listmonk:9000',
      authMode: 'token',
      authUser: 'api-user',
      authToken: 'token123',
    });
    await client.listLists();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const header = (init.headers as Record<string, string>).Authorization;
    expect(header).toBe(`Basic ${Buffer.from('api-user:token123').toString('base64')}`);
  });

  it('maps API errors into ListmonkClientError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'unauthorized' }),
      }),
    );

    const client = new ListmonkClient({ baseUrl: 'http://listmonk:9000', retryCount: 0 });
    const promise = client.listLists();
    await expect(promise).rejects.toBeInstanceOf(ListmonkClientError);
    await expect(promise).rejects.toMatchObject({ status: 401, path: expect.stringContaining('/api/lists') });
  });

  it('retries once on server error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => JSON.stringify({ message: 'oops' }) })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ data: { results: [] } }) });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ListmonkClient({ baseUrl: 'http://listmonk:9000', retryCount: 1, retryDelayMs: 0 });
    const lists = await client.listLists();

    expect(lists).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
