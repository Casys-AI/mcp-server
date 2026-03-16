/**
 * In-memory token store for testing and ephemeral use.
 *
 * @module lib/server/client-auth/token-store/memory-store
 */

import type { StoredCredentials, TokenStore } from "../types.ts";

export class MemoryTokenStore implements TokenStore {
  private store = new Map<string, StoredCredentials>();

  async get(serverUrl: string): Promise<StoredCredentials | null> {
    return this.store.get(serverUrl) ?? null;
  }

  async set(serverUrl: string, credentials: StoredCredentials): Promise<void> {
    this.store.set(serverUrl, credentials);
  }

  async delete(serverUrl: string): Promise<void> {
    this.store.delete(serverUrl);
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }
}
