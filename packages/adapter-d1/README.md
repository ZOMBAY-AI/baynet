# @baynet/adapter-d1

Cloudflare D1 database adapter for [BayNet SDK](https://github.com/ZOMBAY-AI/baynet).

Uses [Drizzle ORM](https://orm.drizzle.team/) to implement the `DatabaseAdapter` interface against Cloudflare D1.

## Install

```bash
npm install @baynet/adapter-d1 @baynet/sdk drizzle-orm
```

## Usage

```typescript
import { BayNet } from "@baynet/sdk";
import { D1DatabaseAdapter } from "@baynet/adapter-d1";
import * as schema from "@baynet/adapter-d1/schema";
import { drizzle } from "drizzle-orm/d1";

// In your Cloudflare Worker
export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB, { schema });
    const database = new D1DatabaseAdapter({ db });

    const baynet = new BayNet({
      database,
      storage: yourStorageAdapter,
      auth: simpleAuth({ isReviewer: (id) => env.ADMIN_IDS.includes(id) }),
    });
  },
};
```

## Schema

The adapter provides Drizzle table definitions (`baynet_detections`, `baynet_annotations`, `baynet_exports`, `baynet_audit_log`) and a raw SQL string for non-Drizzle setups:

```typescript
import { CREATE_TABLES_SQL } from "@baynet/adapter-d1";

// Run against your D1 database to create all tables
await env.DB.exec(CREATE_TABLES_SQL);
```

## License

MIT
