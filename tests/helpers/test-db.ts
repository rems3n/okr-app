import fs from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";

import { db as prodDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

type ProdDb = typeof prodDb;

const MIGRATIONS_DIR = path.resolve(
  process.cwd(),
  "src/lib/db/migrations",
);

function loadMigrationSql(): string[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
}

/**
 * Boots an ephemeral Postgres (via pglite/WASM) with our migrations applied.
 * Returned `db` is a drizzle instance compatible with scopedDb at runtime —
 * types are coerced to the prod Db type so scopedDb can accept it.
 */
export async function createTestDb() {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });

  const migrations = loadMigrationSql();
  for (const migration of migrations) {
    const statements = migration
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await db.execute(sql.raw(stmt));
    }
  }

  return {
    db: db as unknown as ProdDb,
    async cleanup() {
      await pglite.close();
    },
  };
}
