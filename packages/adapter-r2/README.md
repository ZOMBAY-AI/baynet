# @zombay/baynet-r2

Cloudflare R2 storage adapter for [BayNet SDK](https://github.com/ZOMBAY-AI/baynet).

Wraps an R2 bucket binding to implement the `StorageAdapter` interface.

## Install

```bash
npm install @zombay/baynet-r2 @zombay/baynet
```

## Usage

```typescript
import { BayNet } from "@zombay/baynet";
import { R2StorageAdapter } from "@zombay/baynet-r2";

const storage = new R2StorageAdapter({
  bucket: env.R2_ASSETS,
  publicUrlPrefix: "https://cdn.example.com", // optional
});

const baynet = new BayNet({
  database: yourDatabaseAdapter,
  storage,
  auth: simpleAuth({ isReviewer: (id) => ADMIN_IDS.includes(id) }),
});
```

When no `publicUrlPrefix` is set, `getUrl()` returns the raw storage key — your application must proxy access.

## License

MIT
