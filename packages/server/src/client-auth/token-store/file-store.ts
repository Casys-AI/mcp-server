/**
 * File-based token store.
 *
 * Stores OAuth credentials as JSON files with restrictive permissions (0o600).
 * One file per MCP server, keyed by SHA-256 hash of the server URL.
 *
 * @module lib/server/client-auth/token-store/file-store
 */

import type { StoredCredentials, TokenStore } from "../types.ts";

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class FileTokenStore implements TokenStore {
  constructor(private baseDir: string) {}

  private async filePath(serverUrl: string): Promise<string> {
    const hash = await sha256hex(serverUrl);
    return `${this.baseDir}/${hash}.json`;
  }

  private async ensureDir(): Promise<void> {
    await Deno.mkdir(this.baseDir, { recursive: true, mode: 0o700 });
  }

  async get(serverUrl: string): Promise<StoredCredentials | null> {
    const path = await this.filePath(serverUrl);
    try {
      const content = await Deno.readTextFile(path);
      return JSON.parse(content) as StoredCredentials;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return null;
      throw e;
    }
  }

  async set(serverUrl: string, credentials: StoredCredentials): Promise<void> {
    await this.ensureDir();
    const path = await this.filePath(serverUrl);
    const content = JSON.stringify(credentials, null, 2);
    await Deno.writeTextFile(path, content, { mode: 0o600 });
  }

  async delete(serverUrl: string): Promise<void> {
    const path = await this.filePath(serverUrl);
    try {
      await Deno.remove(path);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return;
      throw e;
    }
  }

  async list(): Promise<string[]> {
    try {
      const urls: string[] = [];
      for await (const entry of Deno.readDir(this.baseDir)) {
        if (entry.isFile && entry.name.endsWith(".json")) {
          try {
            const content = await Deno.readTextFile(
              `${this.baseDir}/${entry.name}`,
            );
            const creds = JSON.parse(content) as StoredCredentials;
            urls.push(creds.serverUrl);
          } catch {
            // Corrupted file, skip
          }
        }
      }
      return urls;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return [];
      throw e;
    }
  }
}
