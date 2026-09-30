import { Pool, type PoolClient } from "pg";
import { readFileSync } from "node:fs";

const globalDb = globalThis as unknown as { backingPool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  if (!globalDb.backingPool) {
    const url = new URL(process.env.DATABASE_URL);
    const schema = url.searchParams.get("schema") || "backingleaderboard";
    if (!/^[a-z_][a-z0-9_]*$/.test(schema))
      throw new Error("Invalid database schema");
    const ssl = url.searchParams.get("sslmode") !== "disable";
    url.searchParams.delete("schema");
    url.searchParams.delete("sslmode");
    globalDb.backingPool = new Pool({
      connectionString: url.toString(),
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      statement_timeout: 15000,
      query_timeout: 20000,
      application_name: `backing-${process.env.APP_ENV || "local"}`,
      options: `-c search_path=${schema},public`,
      ssl: ssl
        ? process.env.DATABASE_SSL_CA_FILE
          ? {
              ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8"),
              rejectUnauthorized: true,
            }
          : { rejectUnauthorized: false }
        : false,
    });
    globalDb.backingPool.on("error", (error) =>
      console.error("Database idle connection:", error.message),
    );
  }
  return globalDb.backingPool;
}
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
