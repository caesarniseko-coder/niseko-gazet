/**
 * Database client - kept for schema type inference and local development.
 * Production uses Supabase REST API via @/lib/supabase/server.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// Lazy connection - only connects when queried
const client = connectionString
  ? postgres(connectionString, { prepare: false })
  : (null as unknown as ReturnType<typeof postgres>);

export const db = client ? drizzle(client, { schema }) : (null as unknown as ReturnType<typeof drizzle>);

export type Database = typeof db;
