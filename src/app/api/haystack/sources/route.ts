import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import {
  listSourceFeeds,
  createSourceFeed,
  updateSourceFeed,
  deleteSourceFeed,
} from "@/lib/services/haystack-service";

export const GET = withAuth(async () => {
  const sources = await listSourceFeeds();
  return NextResponse.json(sources);
}, ["editor", "admin"]);

export const POST = withAuth(async (req) => {
  const body = await req.json();

  const required = ["name", "sourceType", "url"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const source = await createSourceFeed({
    name: body.name,
    source_type: body.sourceType,
    url: body.url,
    config: body.config ?? {},
    poll_interval_minutes: body.pollIntervalMinutes ?? 15,
    reliability_tier: body.reliabilityTier ?? "standard",
    default_topics: body.defaultTopics ?? [],
    default_geo_tags: body.defaultGeoTags ?? [],
    is_active: body.isActive ?? true,
  });

  return NextResponse.json(source, { status: 201 });
}, ["admin"]);

export const PATCH = withAuth(async (req) => {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing source id" }, { status: 400 });
  }

  const updated = await updateSourceFeed(id, updates);
  return NextResponse.json(updated);
}, ["admin"]);

export const DELETE = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing source id" }, { status: 400 });
  }

  await deleteSourceFeed(id);
  return NextResponse.json({ deleted: true });
}, ["admin"]);
