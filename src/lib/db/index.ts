import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type PgClient = ReturnType<typeof postgres>;
type Drizzle = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __pgClient?: PgClient;
  __drizzle?: Drizzle;
};

function getClient(): PgClient {
  if (globalForDb.__pgClient) return globalForDb.__pgClient;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(connectionString, { prepare: false, max: 10 });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__pgClient = client;
  }
  return client;
}

/**
 * Lazy drizzle proxy. Avoids hitting `process.env.DATABASE_URL` at module-load
 * time so `next build` can import this file without the secret being present.
 */
export const db = new Proxy({} as Drizzle, {
  get(_target, prop) {
    if (!globalForDb.__drizzle) {
      globalForDb.__drizzle = drizzle(getClient(), { schema });
    }
    return Reflect.get(globalForDb.__drizzle, prop);
  },
});

export { schema };
