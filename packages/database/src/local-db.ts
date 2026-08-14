import { Pool, QueryResult, QueryResultRow } from "pg";
import { encryptSecret, decryptSecret } from "./crypto";

let poolInstance: Pool | null = null;

export function getDatabaseConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  const db = process.env.POSTGRES_DB || "aiva";
  const user = process.env.POSTGRES_USER || "postgres";
  const pass = process.env.POSTGRES_PASSWORD || "postgres";

  return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
}

export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: getDatabaseConnectionString(),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    poolInstance.on("error", (err) => {
      // Prevent unhandled pool background errors from crashing process when DB is offline
      console.warn("[Database Pool] Connection error:", err.message);
    });
  }
  return poolInstance;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  is_encrypted: boolean;
  category: string;
  description?: string;
  updated_at: string;
}

/**
 * Reads an app setting by key from `app_settings` table.
 * Decrypts automatically if `is_encrypted` is true.
 * Falls back to process.env[key.toUpperCase()] if missing in database.
 */
export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const res = await query<AppSetting>(
      "SELECT * FROM public.app_settings WHERE key = $1 LIMIT 1",
      [key]
    );

    if (res.rows.length > 0) {
      const setting = res.rows[0];
      if (setting.is_encrypted) {
        return decryptSecret(setting.value);
      }
      return setting.value;
    }
  } catch (err) {
    // If DB is unreachable or table not migrated yet, fallback to process.env
  }

  return process.env[key.toUpperCase()] || process.env[key] || null;
}

/**
 * Saves or updates an app setting in the `app_settings` table.
 * Encrypts value using AES-256-GCM if `isEncrypted` is true.
 */
export async function setAppSetting(
  key: string,
  value: string,
  isEncrypted: boolean = false,
  category: string = "general",
  description?: string
): Promise<AppSetting> {
  const storedValue = isEncrypted ? encryptSecret(value) : value;

  const res = await query<AppSetting>(
    `INSERT INTO public.app_settings (key, value, is_encrypted, category, description, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         is_encrypted = EXCLUDED.is_encrypted,
         category = EXCLUDED.category,
         description = COALESCE(EXCLUDED.description, public.app_settings.description),
         updated_at = NOW()
     RETURNING *`,
    [key, storedValue, isEncrypted, category, description || null]
  );

  return res.rows[0];
}

/**
 * Closes the database pool connection (useful for graceful shutdown or tests).
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
