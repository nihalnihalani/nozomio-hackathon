// SYNTHETIC DEMO REPO — Postgres pool wrapper.
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = {
  async query<T = unknown>(text: string, params?: unknown[]) {
    const start = Date.now();
    const res = await pool.query<T>(text, params as never);
    const ms = Date.now() - start;
    if (ms > 500) {
      console.warn("slow query", { ms, text });
    }
    return res;
  },
  pool,
};
