-- Migration 002: Add reliability_score to source_feeds
-- Run this in the Supabase Dashboard SQL Editor

ALTER TABLE source_feeds
ADD COLUMN IF NOT EXISTS reliability_score REAL DEFAULT 50.0;

COMMENT ON COLUMN source_feeds.reliability_score IS 'Calculated acceptance rate: (published/relevant)*100. Updated after each field note creation.';
