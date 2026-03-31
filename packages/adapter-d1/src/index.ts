/**
 * @zombay/baynet-d1 — Cloudflare D1 database adapter for BayNet SDK.
 *
 * Usage:
 *   import { D1DatabaseAdapter } from "@zombay/baynet-d1";
 *   import { drizzle } from "drizzle-orm/d1";
 *   import * as schema from "@zombay/baynet-d1/schema";
 *
 *   const db = drizzle(env.DB, { schema });
 *   const database = new D1DatabaseAdapter({ db });
 *
 *   const baynet = new BayNet({
 *     database,
 *     storage: yourStorageAdapter,
 *     auth: simpleAuth({ isReviewer: (id) => ADMIN_IDS.includes(id) }),
 *   });
 */

export { D1DatabaseAdapter, type D1AdapterConfig } from "./adapter.js";
export {
  detections,
  annotations,
  trainingExports,
  auditLog,
  CREATE_TABLES_SQL,
} from "./schema.js";
