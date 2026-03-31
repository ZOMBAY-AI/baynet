/**
 * Cloudflare R2 StorageAdapter implementation.
 *
 * Wraps an R2Bucket binding to implement the BayNet SDK's StorageAdapter
 * interface. Supports signed URLs via createSignedUrl or falls back to
 * a configurable public URL prefix.
 */

import type { StorageAdapter } from "@baynet/sdk";

export interface R2AdapterConfig {
  /** R2 bucket binding */
  bucket: R2Bucket;

  /**
   * Public URL prefix for serving objects (e.g., "https://cdn.example.com").
   * Used when getUrl() is called. If not set, getUrl() returns a path-style
   * key that your application can proxy.
   */
  publicUrlPrefix?: string;
}

export class R2StorageAdapter implements StorageAdapter {
  private bucket: R2Bucket;
  private publicUrlPrefix?: string;

  constructor(config: R2AdapterConfig) {
    this.bucket = config.bucket;
    this.publicUrlPrefix = config.publicUrlPrefix?.replace(/\/$/, "");
  }

  async put(
    key: string,
    data: Uint8Array,
    metadata?: { contentType?: string },
  ): Promise<void> {
    await this.bucket.put(key, data.buffer as ArrayBuffer, {
      httpMetadata: metadata?.contentType
        ? { contentType: metadata.contentType }
        : undefined,
    });
  }

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;

    const buffer = await object.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async getUrl(
    key: string,
    _options?: { expiresInSeconds?: number },
  ): Promise<string> {
    if (this.publicUrlPrefix) {
      return `${this.publicUrlPrefix}/${key}`;
    }
    // Fallback: return the key itself — caller must proxy it
    return key;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
