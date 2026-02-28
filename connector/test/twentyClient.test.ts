import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwentyClient } from '../src/clients/twentyClient.js';

describe('TwentyClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a note and attaches it to the person in rest_note mode', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { createNote: { id: 'note_1' } } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { createNoteTarget: { id: 'target_1' } } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const client = new TwentyClient({
      baseUrl: 'http://twenty:3000',
      graphqlPath: '/graphql',
      restPath: '/rest',
      authToken: undefined,
      apiKey: 'api_key',
      writebackMode: 'rest_note',
      engagementNoteEndpoint: '/rest/notes',
      workflowWebhookUrl: undefined,
    });

    await client.writeEngagement({
      type: 'open',
      personId: 'person_1',
      email: 'lead@example.com',
      campaignId: 17,
      campaignName: 'Retail documents request',
      crmActivityType: 'email_opened',
      timestamp: '2026-02-28T09:46:32.404Z',
      source: 'tracking-pixel',
      metadata: { applicationId: 'APP-001' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [noteUrl, noteInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(noteUrl).toBe('http://twenty:3000/rest/notes');
    expect(noteInit.method).toBe('POST');
    expect(noteInit.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer api_key',
      'Content-Type': 'application/json',
    });

    const noteBody = JSON.parse(String(noteInit.body));
    expect(noteBody.title).toBe('Email engagement');
    expect(noteBody.bodyV2.markdown).toContain('Email open tracked');
    expect(noteBody.bodyV2.markdown).toContain('applicationId: APP-001');
    expect(noteBody.bodyV2.blocknote).toContain('Email open tracked');
    expect(noteBody.body).toBeUndefined();
    expect(noteBody.content).toBeUndefined();

    const [targetUrl, targetInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(targetUrl).toBe('http://twenty:3000/rest/noteTargets');
    expect(targetInit.method).toBe('POST');
    expect(JSON.parse(String(targetInit.body))).toEqual({
      noteId: 'note_1',
      targetPersonId: 'person_1',
    });
  });
});
