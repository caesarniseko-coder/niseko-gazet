import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { getStory, updateStory } from "@/lib/services/story-service";
import { updateStorySchema } from "@/lib/validators/story";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const GET = withAuth(async (req, { params, session: _session }) => {
  const { id } = await params;
  const story = await getStory(id);

  if (!story) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(story);
}, ["journalist", "editor", "admin"]);

export const PATCH = withAuth(async (req, { params, session }) => {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateStorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateStory(id, parsed.data);

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "story.update",
    resourceType: "story",
    resourceId: id,
    changes: parsed.data,
    ...meta,
  });

  return NextResponse.json(updated);
}, ["journalist", "editor", "admin"]);
