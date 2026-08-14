import fs from "fs";
import path from "path";
import { getPool, closePool } from "./local-db";

async function runMigrations() {
  console.log("==========================================");
  console.log("    AIVA Database Migration Runner        ");
  console.log("==========================================\n");

  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log("1. Ensuring auth schema, helper functions, and default user stub exist...");
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE
      );
      INSERT INTO auth.users (id, email)
      VALUES ('00000000-0000-0000-0000-000000000000', 'local@aiva.internal')
      ON CONFLICT (id) DO NOTHING;

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
        SELECT '00000000-0000-0000-0000-000000000000'::uuid;
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
        SELECT 'authenticated';
      $$ LANGUAGE sql STABLE;
    `);
    console.log("✓ Auth stub & functions ready.");

    // Check if _migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const executedRes = await client.query<{ name: string }>(
      "SELECT name FROM public._migrations"
    );
    const executedMigrations = new Set(executedRes.rows.map((r) => r.name));

    // If core schema wasn't recorded in _migrations, ensure clean public schema state
    if (!executedMigrations.has("20260718000000_core_schema.sql")) {
      console.log("Notice: Resetting public schema for fresh migration run...");
      await client.query(`
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
        CREATE TABLE public._migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      executedMigrations.clear();
    }

    const migrationsDir = path.join(__dirname, "../migrations");
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(`\n2. Found ${migrationFiles.length} migration files.`);

    for (const file of migrationFiles) {
      if (executedMigrations.has(file)) {
        console.log(`[SKIP] Already applied: ${file}`);
        continue;
      }

      console.log(`[APPLYING] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO public._migrations (name) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      console.log(`✓ Successfully applied: ${file}`);
    }

    const seedPath = path.join(__dirname, "../seed.sql");
    if (fs.existsSync(seedPath)) {
      console.log("\n3. Executing seed script (seed.sql)...");
      const seedSql = fs.readFileSync(seedPath, "utf-8");
      await client.query(seedSql);

      // Seed default workspace row if missing
      await client.query(`
        INSERT INTO public.workspaces (id, owner_id, name)
        VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Default Workspace')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log("✓ System default seed data applied.");
    }

    console.log("\n✅ Database schema migrations & seed data applied successfully!");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\n❌ Migration failed:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

runMigrations();
