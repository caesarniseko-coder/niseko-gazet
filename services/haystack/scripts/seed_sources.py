"""Seed initial RSS source feeds for the Haystack pipeline."""

import asyncio
import httpx
import json
import sys
import os

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

SEED_SOURCES = [
    {
        "name": "NHK World - Japan News",
        "source_type": "rss",
        "url": "https://www3.nhk.or.jp/rss/news/cat0.xml",
        "reliability_tier": "official",
        "default_topics": ["local_government", "safety", "events"],
        "default_geo_tags": ["hokkaido"],
        "poll_interval_minutes": 15,
        "config": {"max_entries": 20},
    },
    {
        "name": "Japan Times - Hokkaido",
        "source_type": "rss",
        "url": "https://www.japantimes.co.jp/feed/",
        "reliability_tier": "standard",
        "default_topics": ["tourism", "business", "culture"],
        "default_geo_tags": ["hokkaido"],
        "poll_interval_minutes": 30,
        "config": {"max_entries": 15},
    },
    {
        "name": "Niseko Tourism - Events",
        "source_type": "rss",
        "url": "https://www.nisekotourism.com/feed",
        "reliability_tier": "standard",
        "default_topics": ["tourism", "events", "snow_conditions"],
        "default_geo_tags": ["niseko", "hirafu", "annupuri", "hanazono"],
        "poll_interval_minutes": 60,
        "config": {"max_entries": 10},
    },
]


async def seed():
    async with httpx.AsyncClient(timeout=30.0) as client:
        for source in SEED_SOURCES:
            # Check if already exists
            check_resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/source_feeds",
                headers=HEADERS,
                params={"url": f"eq.{source['url']}", "limit": "1"},
            )

            if check_resp.status_code == 200 and check_resp.json():
                print(f"  Already exists: {source['name']}")
                continue

            # Insert
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/source_feeds",
                headers=HEADERS,
                json=source,
            )

            if resp.status_code in (200, 201):
                data = resp.json()
                sid = data[0]["id"] if isinstance(data, list) else data.get("id", "?")
                print(f"  Created: {source['name']} (id: {sid})")
            else:
                print(f"  FAILED: {source['name']} - {resp.status_code}: {resp.text}")


if __name__ == "__main__":
    print("Seeding source feeds...")
    asyncio.run(seed())
    print("Done.")
