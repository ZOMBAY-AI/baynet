/**
 * @baynet/adapter-r2 — Cloudflare R2 storage adapter for BayNet SDK.
 *
 * Usage:
 *   import { R2StorageAdapter } from "@baynet/adapter-r2";
 *
 *   const storage = new R2StorageAdapter({
 *     bucket: env.R2_ASSETS,
 *     publicUrlPrefix: "https://cdn.example.com",
 *   });
 *
 *   const baynet = new BayNet({
 *     database: yourDatabaseAdapter,
 *     storage,
 *     auth: simpleAuth({ isReviewer: (id) => ADMIN_IDS.includes(id) }),
 *   });
 */

export { R2StorageAdapter, type R2AdapterConfig } from "./adapter.js";
