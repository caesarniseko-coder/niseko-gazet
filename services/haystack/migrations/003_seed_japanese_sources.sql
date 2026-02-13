-- Migration 003: Seed Japanese source feeds for bilingual coverage
-- Run this in the Supabase Dashboard SQL Editor

-- Kutchan Town official RSS (municipality)
INSERT INTO source_feeds (name, source_type, url, config, poll_interval_minutes, reliability_tier, default_topics, default_geo_tags)
VALUES (
  'Kutchan Town Official',
  'rss',
  'https://www.town.kutchan.hokkaido.jp/rss/',
  '{"language": "ja", "encoding": "utf-8"}',
  15,
  'official',
  '["local_government", "community"]',
  '["kutchan"]'
) ON CONFLICT DO NOTHING;

-- Niseko Town official RSS
INSERT INTO source_feeds (name, source_type, url, config, poll_interval_minutes, reliability_tier, default_topics, default_geo_tags)
VALUES (
  'Niseko Town Official',
  'rss',
  'https://www.town.niseko.lg.jp/rss/',
  '{"language": "ja", "encoding": "utf-8"}',
  15,
  'official',
  '["local_government", "community"]',
  '["niseko_town"]'
) ON CONFLICT DO NOTHING;

-- JMA (Japan Meteorological Agency) weather warnings — Hokkaido
INSERT INTO source_feeds (name, source_type, url, config, poll_interval_minutes, reliability_tier, default_topics, default_geo_tags)
VALUES (
  'JMA Hokkaido Weather',
  'api',
  'https://www.jma.go.jp/bosai/forecast/data/forecast/016000.json',
  '{"language": "ja", "parser": "jma_forecast", "region_code": "016000"}',
  60,
  'official',
  '["weather", "snow_conditions", "safety"]',
  '["niseko", "kutchan", "shiribeshi"]'
) ON CONFLICT DO NOTHING;

-- NHK Hokkaido news RSS
INSERT INTO source_feeds (name, source_type, url, config, poll_interval_minutes, reliability_tier, default_topics, default_geo_tags)
VALUES (
  'NHK Hokkaido',
  'rss',
  'https://www3.nhk.or.jp/sapporo-news/rss/7002.xml',
  '{"language": "ja", "encoding": "utf-8"}',
  15,
  'official',
  '["local_news"]',
  '["hokkaido"]'
) ON CONFLICT DO NOTHING;

-- Niseko United (resort info — scrape)
INSERT INTO source_feeds (name, source_type, url, config, poll_interval_minutes, reliability_tier, default_topics, default_geo_tags)
VALUES (
  'Niseko United',
  'scrape',
  'https://www.nisekounited.com/news',
  '{"language": "en", "selectors": {"articles": "article", "title": "h2", "body": ".content"}}',
  360,
  'standard',
  '["tourism", "snow_conditions", "events"]',
  '["niseko", "hirafu", "hanazono", "village", "annupuri"]'
) ON CONFLICT DO NOTHING;

-- Hokkaido Shimbun (regional newspaper — scrape)
INSERT INTO source_feeds (name, source_type, url, config, poll_interval_minutes, reliability_tier, default_topics, default_geo_tags)
VALUES (
  'Hokkaido Shimbun - Shiribeshi',
  'scrape',
  'https://www.hokkaido-np.co.jp/area/shiribeshi/',
  '{"language": "ja", "selectors": {"articles": ".article-list li", "title": "a", "body": ".body"}}',
  60,
  'standard',
  '["local_news"]',
  '["shiribeshi", "kutchan", "niseko"]'
) ON CONFLICT DO NOTHING;

-- Powderlife Magazine (English-language Niseko magazine)
INSERT INTO source_feeds (name, source_type, url, config, poll_interval_minutes, reliability_tier, default_topics, default_geo_tags)
VALUES (
  'Powderlife Magazine',
  'rss',
  'https://www.powderlife.com/feed/',
  '{"language": "en"}',
  60,
  'standard',
  '["tourism", "lifestyle", "food_dining", "events"]',
  '["niseko", "hirafu", "kutchan"]'
) ON CONFLICT DO NOTHING;
