import { NextResponse } from "next/server";
import postgres from "postgres";

/**
 * One-time migration endpoint for creating Haystack tables.
 * POST /api/migrate with x-migrate-key header matching NEXTAUTH_SECRET.
 *
 * This requires DATABASE_URL to be set and reachable from the runtime.
 * If direct PostgreSQL is unreachable, run the SQL from:
 * services/haystack/migrations/001_create_haystack_tables.sql
 * in the Supabase Dashboard SQL Editor.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("x-migrate-key");
  const secret = process.env.NEXTAUTH_SECRET || "";
  if (!auth || auth.trim() !== secret.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL not configured" },
      { status: 500 }
    );
  }

  const sql = postgres(dbUrl, { max: 1, connect_timeout: 15 });
  const results: string[] = [];

  try {
    // Test connection
    await sql`SELECT 1`;
    results.push("Connected to database");

    // Enums
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE source_type AS ENUM ('rss', 'scrape', 'api', 'social', 'tip'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await sql.unsafe(`DO $$ BEGIN CREATE TYPE reliability_tier AS ENUM ('official', 'standard', 'yellow_press'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    results.push("Enums created");

    // Tables
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS source_feeds (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, source_type source_type NOT NULL, url TEXT NOT NULL, config JSONB DEFAULT '{}', poll_interval_minutes INTEGER DEFAULT 15, is_active BOOLEAN DEFAULT true, reliability_tier reliability_tier NOT NULL DEFAULT 'standard', default_topics JSONB DEFAULT '[]', default_geo_tags JSONB DEFAULT '[]', last_fetched_at TIMESTAMPTZ, last_error TEXT, consecutive_errors INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS pipeline_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), run_type VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'running', started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ, stats JSONB DEFAULT '{}', errors JSONB DEFAULT '[]', sources_polled JSONB DEFAULT '[]');`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS crawl_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source_feed_id UUID NOT NULL REFERENCES source_feeds(id), source_url TEXT NOT NULL, content_fingerprint VARCHAR(32) NOT NULL, pipeline_run_id UUID, raw_data JSONB DEFAULT '{}', status VARCHAR(20) NOT NULL DEFAULT 'processed', relevance_score JSONB, was_relevant BOOLEAN DEFAULT false, was_duplicate BOOLEAN DEFAULT false, classification_data JSONB, field_note_id UUID REFERENCES field_notes(id), moderation_item_id UUID, error_message TEXT, fetched_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
    results.push("Tables created");

    // Indexes
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS source_feeds_type_idx ON source_feeds(source_type);`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS source_feeds_active_idx ON source_feeds(is_active);`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS pipeline_runs_status_idx ON pipeline_runs(status);`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS pipeline_runs_started_idx ON pipeline_runs(started_at);`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS crawl_history_fingerprint_idx ON crawl_history(content_fingerprint);`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS crawl_history_source_url_idx ON crawl_history(source_url);`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS crawl_history_run_idx ON crawl_history(pipeline_run_id);`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS crawl_history_source_feed_idx ON crawl_history(source_feed_id);`);
    results.push("Indexes created");

    // RLS
    await sql.unsafe(`ALTER TABLE source_feeds ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`ALTER TABLE crawl_history ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;`);
    for (const table of ["source_feeds", "crawl_history", "pipeline_runs"]) {
      await sql.unsafe(`DO $$ BEGIN CREATE POLICY "Service role full access" ON ${table} FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    }
    results.push("RLS configured");

    // Bot user
    await sql.unsafe(`INSERT INTO users (id, email, name, role, password_hash, email_verified) VALUES ('b0000000-0000-0000-0000-000000000001', 'haystack-bot@niseko-gazet.local', 'Haystack Bot', 'journalist', '$2b$10$placeholder_not_used_for_api_auth', true) ON CONFLICT (email) DO NOTHING;`);
    results.push("Bot user created");

    await sql.end();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    await sql.end().catch(() => {});
    return NextResponse.json(
      { error: String(error), results },
      { status: 500 }
    );
  }
}
