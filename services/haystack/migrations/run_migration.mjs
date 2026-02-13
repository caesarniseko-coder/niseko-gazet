#!/usr/bin/env node
/**
 * run_migration.mjs
 *
 * Executes the Haystack SQL migration (001_create_haystack_tables.sql)
 * against the remote Supabase PostgreSQL database.
 *
 * Connection strategies (tried in order):
 *   1. Direct PostgreSQL via DATABASE_URL      (postgres.js driver)
 *   2. Supabase Management API                 (requires SUPABASE_ACCESS_TOKEN)
 *   3. Manual fallback                         (prints instructions)
 *
 * Environment variables:
 *   DATABASE_URL             - PostgreSQL connection string (from .env.local)
 *   SUPABASE_ACCESS_TOKEN    - Personal access token from dashboard/account/tokens
 *   SUPABASE_PROJECT_REF     - Project reference (default: ryyeoctwwmhoghxfykyq)
 *   SUPABASE_URL             - Project URL (auto-derived from ref)
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (for REST API verification)
 *
 * Usage:
 *   node services/haystack/migrations/run_migration.mjs
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node services/haystack/migrations/run_migration.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL || "";

const SUPABASE_PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || "ryyeoctwwmhoghxfykyq";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  `https://${SUPABASE_PROJECT_REF}.supabase.co`;

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";

const SQL_FILE = join(__dirname, "001_create_haystack_tables.sql");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split SQL into individual statements, respecting $$ dollar-quoting. */
function splitStatements(raw) {
  const statements = [];
  let current = "";
  let inDollarQuote = false;

  for (const line of raw.split("\n")) {
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const _ of dollarMatches) inDollarQuote = !inDollarQuote;
    }
    current += line + "\n";
    if (!inDollarQuote && line.trimEnd().endsWith(";")) {
      const trimmed = current.trim();
      if (trimmed.length > 0 && trimmed !== ";") statements.push(trimmed);
      current = "";
    }
  }
  const trailing = current.trim();
  if (trailing.length > 0 && trailing !== ";") statements.push(trailing);
  return statements;
}

/** First non-comment line of a statement (for display). */
function label(stmt) {
  return (
    stmt
      .split("\n")
      .find((l) => l.trim() && !l.trim().startsWith("--"))
      ?.trim()
      .slice(0, 80) || "(empty)"
  );
}

// ---------------------------------------------------------------------------
// Shared statement executor
// ---------------------------------------------------------------------------
async function executeStatements(statements, execFn, verifyFn) {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    process.stdout.write(
      `  [${i + 1}/${statements.length}] ${label(stmt)}...`
    );
    try {
      await execFn(stmt);
      console.log(" OK");
      success++;
    } catch (err) {
      console.log(` FAILED`);
      console.error(`        Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n  --- Summary ---`);
  console.log(`  Statements : ${statements.length}`);
  console.log(`  Succeeded  : ${success}`);
  console.log(`  Failed     : ${failed}`);

  if (verifyFn) {
    console.log(`\n  --- Table verification ---`);
    const tables = await verifyFn();
    for (const t of tables) console.log(`  [ok] ${t}`);
    if (tables.length === 3) {
      console.log(`\n  All 3 Haystack tables verified.`);
    } else {
      console.log(
        `\n  Warning: expected 3 tables, found ${tables.length}.`
      );
    }
  }

  return failed === 0;
}

// ---------------------------------------------------------------------------
// Strategy 1: Direct PostgreSQL via postgres.js
// ---------------------------------------------------------------------------
async function tryDirectPostgres(statements) {
  console.log("\n[Strategy 1] Direct PostgreSQL via DATABASE_URL");

  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch {
    console.log("  postgres.js driver not found, skipping.");
    return false;
  }

  const sql = postgres(DATABASE_URL, {
    ssl: { rejectUnauthorized: false },
    connect_timeout: 10,
    idle_timeout: 5,
  });

  try {
    const [{ now }] = await sql`SELECT now()`;
    console.log(`  Connected successfully. Server time: ${now}`);
  } catch (err) {
    console.log(`  Connection failed: ${err.message}`);
    await sql.end().catch(() => {});
    return false;
  }

  const ok = await executeStatements(
    statements,
    async (stmt) => sql.unsafe(stmt),
    async () => {
      const rows = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('source_feeds', 'crawl_history', 'pipeline_runs')
        ORDER BY table_name`;
      return rows.map((r) => r.table_name);
    }
  );

  await sql.end();
  return ok;
}

// ---------------------------------------------------------------------------
// Strategy 2: Supabase Management API
// ---------------------------------------------------------------------------
async function tryManagementAPI(statements) {
  console.log("\n[Strategy 2] Supabase Management API");

  if (!SUPABASE_ACCESS_TOKEN) {
    console.log("  SUPABASE_ACCESS_TOKEN not set, skipping.");
    console.log(
      "  (Generate at https://supabase.com/dashboard/account/tokens)"
    );
    return false;
  }

  const apiBase = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}`;
  const queryUrl = `${apiBase}/database/query`;
  const authHeaders = {
    Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };

  // Connectivity check
  try {
    const r = await fetch(queryUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ query: "SELECT now() as now" }),
    });
    if (!r.ok) {
      const text = await r.text();
      console.log(`  API returned ${r.status}: ${text.slice(0, 200)}`);
      return false;
    }
    const data = await r.json();
    console.log(`  Connected via Management API.`, data?.[0] || "");
  } catch (err) {
    console.log(`  Connection failed: ${err.message}`);
    return false;
  }

  return await executeStatements(
    statements,
    async (stmt) => {
      const r = await fetch(queryUrl, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ query: stmt }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`${r.status}: ${text.slice(0, 200)}`);
      }
    },
    async () => {
      const r = await fetch(queryUrl, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          query: `SELECT table_name FROM information_schema.tables
                  WHERE table_schema='public'
                    AND table_name IN ('source_feeds','crawl_history','pipeline_runs')
                  ORDER BY table_name`,
        }),
      });
      const data = await r.json();
      return (data || []).map((row) => row.table_name);
    }
  );
}

// ---------------------------------------------------------------------------
// REST API verification (always available via service role key)
// ---------------------------------------------------------------------------
async function verifyViaREST() {
  console.log("\n[Verification] Checking tables via Supabase REST API...");
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  const tableNames = ["source_feeds", "crawl_history", "pipeline_runs"];
  const existing = [];

  for (const table of tableNames) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=0`, {
        headers,
      });
      if (r.ok) {
        existing.push(table);
        console.log(`  [ok] ${table}`);
      } else {
        console.log(`  [--] ${table} (not found)`);
      }
    } catch (e) {
      console.log(`  [!!] ${table} (${e.message})`);
    }
  }
  return existing;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Haystack Migration Runner ===");
  console.log(`Project: ${SUPABASE_PROJECT_REF}`);
  console.log(`URL:     ${SUPABASE_URL}`);

  // Read SQL
  let rawSql;
  try {
    rawSql = readFileSync(SQL_FILE, "utf-8");
    console.log(`SQL:     ${SQL_FILE}`);
  } catch (err) {
    console.error(`\nFailed to read SQL file: ${err.message}`);
    process.exit(1);
  }

  const statements = splitStatements(rawSql);
  console.log(`Parsed:  ${statements.length} statement(s)`);

  // Quick pre-check: are tables already there?
  const existingTables = await verifyViaREST();
  if (existingTables.length === 3) {
    console.log(
      "\nAll 3 Haystack tables already exist. Migration previously applied. Nothing to do."
    );
    process.exit(0);
  }

  // Try strategies
  let success = false;

  success = await tryDirectPostgres(statements);
  if (!success) success = await tryManagementAPI(statements);

  if (success) {
    // Final verification
    await verifyViaREST();
    console.log("\nMigration completed successfully.");
    process.exit(0);
  }

  // All strategies failed
  console.log("\n" + "=".repeat(70));
  console.log(" MIGRATION COULD NOT BE EXECUTED AUTOMATICALLY");
  console.log("=".repeat(70));
  console.log(`
The database host is IPv6-only and unreachable from this network, and
no SUPABASE_ACCESS_TOKEN was provided for the Management API.

To apply this migration, use one of these methods:

  OPTION A  Supabase Dashboard SQL Editor (quickest)
    1. Open: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new
    2. Paste the contents of:
       ${SQL_FILE}
    3. Click "Run"

  OPTION B  Set SUPABASE_ACCESS_TOKEN and re-run this script
    1. Create a token at: https://supabase.com/dashboard/account/tokens
    2. Re-run:
       SUPABASE_ACCESS_TOKEN=sbp_xxxx node ${process.argv[1]}

  OPTION C  Supabase CLI
    1. npx supabase login --token <your-access-token>
    2. npx supabase link --project-ref ${SUPABASE_PROJECT_REF}
    3. npx supabase db push --include-all --workdir ${join(__dirname, "../../..")}
`);

  process.exit(1);
}

main().catch((err) => {
  console.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
