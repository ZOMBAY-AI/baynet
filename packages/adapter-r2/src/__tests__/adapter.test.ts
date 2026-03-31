/**
 * Tests for R2StorageAdapter.
 *
 * Uses a mock R2Bucket to verify the adapter correctly delegates calls
 * and handles edge cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { R2StorageAdapter } from "../adapter.js";

// ─── Mock R2 Bucket ────────────────────────────────────────────────────────

function createMockBucket() {
  const store = new Map<string, { data: ArrayBuffer; contentType?: string }>();

  return {
    put: vi.fn(async (key: string, data: ArrayBuffer, opts?: any) => {
      store.set(key, {
        data,
        contentType: opts?.httpMetadata?.contentType,
      });
    }),

    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        arrayBuffer: async () => entry.data,
        httpMetadata: { contentType: entry.contentType },
      };
    }),

    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),

    _store: store,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("R2StorageAdapter", () => {
  let adapter: R2StorageAdapter;
  let mockBucket: ReturnType<typeof createMockBucket>;

  beforeEach(() => {
    mockBucket = createMockBucket();
    adapter = new R2StorageAdapter({
      bucket: mockBucket as any,
      publicUrlPrefix: "https://cdn.example.com",
    });
  });

  describe("put", () => {
    it("stores data in the bucket with content type", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      await adapter.put("test/image.png", data, { contentType: "image/png" });

      expect(mockBucket.put).toHaveBeenCalledTimes(1);
      expect(mockBucket.put).toHaveBeenCalledWith(
        "test/image.png",
        data.buffer,
        { httpMetadata: { contentType: "image/png" } },
      );
    });

    it("stores data without content type", async () => {
      const data = new Uint8Array([5, 6, 7]);
      await adapter.put("test/file.bin", data);

      expect(mockBucket.put).toHaveBeenCalledWith(
        "test/file.bin",
        data.buffer,
        { httpMetadata: undefined },
      );
    });
  });

  describe("get", () => {
    it("retrieves stored data", async () => {
      const data = new Uint8Array([10, 20, 30]);
      await adapter.put("test/data.bin", data);

      const result = await adapter.get("test/data.bin");
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result!.length).toBe(3);
    });

    it("returns null for missing keys", async () => {
      const result = await adapter.get("nonexistent/key");
      expect(result).toBeNull();
    });
  });

  describe("getUrl", () => {
    it("returns public URL with prefix", async () => {
      const url = await adapter.getUrl("baynet/detections/123/original.png");
      expect(url).toBe("https://cdn.example.com/baynet/detections/123/original.png");
    });

    it("strips trailing slash from prefix", () => {
      const adapter2 = new R2StorageAdapter({
        bucket: mockBucket as any,
        publicUrlPrefix: "https://cdn.example.com/",
      });

      return adapter2.getUrl("test.png").then((url) => {
        expect(url).toBe("https://cdn.example.com/test.png");
      });
    });

    it("returns key when no prefix is configured", async () => {
      const adapter2 = new R2StorageAdapter({ bucket: mockBucket as any });
      const url = await adapter2.getUrl("baynet/detections/123/original.png");
      expect(url).toBe("baynet/detections/123/original.png");
    });
  });

  describe("delete", () => {
    it("deletes from the bucket", async () => {
      await adapter.delete("test/old.png");

      expect(mockBucket.delete).toHaveBeenCalledWith("test/old.png");
    });
  });
});
