import { describe, expect, it } from 'vitest';
import { buildSubscriberAttribs, loadSegmentDefinitions, loadVerticalPack } from '../src/vertical.js';

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

  it('loads and validates generic segments config', async () => {
    const segments = await loadSegmentDefinitions('generic');
    expect(segments.map((s) => s.key)).toEqual(['customers', 'leads', 'vip']);
    expect(segments[0]?.rules[0]).toMatchObject({ field: 'tags', op: 'includes', value: 'customer' });
  });
});
