import { describe, expect, it } from 'vitest';
import { buildSubscriberAttribs, loadVerticalPack } from '../src/vertical.js';

describe('vertical packs', () => {
  it('loads generic pack by default', async () => {
    const pack = await loadVerticalPack('generic');
    expect(pack.name).toBe('generic');
    expect(pack.defaultList.name).toBeTruthy();
  });

  it('loads mortgage_au pack and keeps placeholders isolated', async () => {
    const pack = await loadVerticalPack('mortgage_au');
    expect(pack.name).toBe('mortgage_au');
    expect(pack.subscriberAttribs.static.vertical).toBe('mortgage_au');
  });

  it('builds subscriber attribs with person id when enabled', async () => {
    const pack = await loadVerticalPack('generic');
    const attribs = buildSubscriberAttribs(pack, {
      crmId: 'person_1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(attribs.twentyPersonId).toBe('person_1');
    expect(attribs.vertical).toBe('generic');
  });
});
