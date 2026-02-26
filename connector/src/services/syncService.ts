import type { ContactRecord, ContactsSyncRunResult, SyncResult } from '../types/index.js';
import type { ConnectorService } from '../service.js';

export class SyncService {
  constructor(private readonly connectorService: ConnectorService) {}

  async syncContacts(contacts: ContactRecord[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const contact of contacts) {
      results.push(await this.connectorService.syncContact(contact, 'manual-batch'));
    }
    return results;
  }

  async syncContactsFromTwenty(maxContacts?: number): Promise<ContactsSyncRunResult> {
    return this.connectorService.syncContactsFromTwenty({ maxContacts });
  }

  async syncLists(): Promise<{ ok: true; lists: Array<{ id: number; name: string }> }> {
    const lists = await this.connectorService.syncLists();
    return { ok: true, lists };
  }
}
