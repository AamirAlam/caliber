import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Kysely, PostgresDialect, SqliteDialect, sql } from 'kysely';
import { config } from './config.js';

/**
 * Persistence schema. Each table stores a domain record as a JSON string keyed
 * by id — identical across SQLite and Postgres, so one code path serves both.
 * `runs` also keeps `started_at` as a column so history can be ordered without
 * parsing the JSON.
 */
export interface Database {
  runs: { id: string; started_at: string; data: string };
  snapshots: { id: string; data: string };
  recommendations: { id: string; data: string };
  transactions: { id: string; data: string };
}

export type DB = Kysely<Database>;

/** Build a Kysely instance for the configured dialect, or null for in-memory. */
export async function createKysely(): Promise<DB | null> {
  if (config.db.kind === 'memory') return null;

  if (config.db.kind === 'postgres') {
    const pg = await import('pg');
    const Pool = (pg as unknown as { default?: { Pool: typeof pg.Pool }; Pool: typeof pg.Pool }).default?.Pool ?? pg.Pool;
    // Enable SSL only for external endpoints (public proxy / explicit sslmode).
    // Railway's internal network needs no SSL, and forcing it there breaks the
    // connection — so keep it off unless the URL clearly requires it.
    const external = /proxy\.rlwy\.net|sslmode=require|ssl=true/.test(config.db.url);
    const pool = new Pool({
      connectionString: config.db.url,
      ...(external ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  }

  // SQLite (default, local dev). Ensure the parent directory exists.
  const path = config.db.path;
  if (path !== ':memory:' && path.includes('/')) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  const BetterSqlite3 = (await import('better-sqlite3')).default;
  return new Kysely<Database>({ dialect: new SqliteDialect({ database: new BetterSqlite3(path) }) });
}

/** Create tables if they don't exist. Portable DDL across both dialects. */
export async function migrate(db: DB): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS runs (id text primary key, started_at text not null, data text not null)`.execute(db);
  await sql`CREATE TABLE IF NOT EXISTS snapshots (id text primary key, data text not null)`.execute(db);
  await sql`CREATE TABLE IF NOT EXISTS recommendations (id text primary key, data text not null)`.execute(db);
  await sql`CREATE TABLE IF NOT EXISTS transactions (id text primary key, data text not null)`.execute(db);
}
