import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { createStory, listStories } from "@/lib/services/story-service";
import { createStorySchema } from "@/lib/validators/story";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const GET = withAuth(async (req, { session: _session }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const authorId = url.searchParams.get("authorId") ?? undefined;

  const storyList = await listStories({ status, authorId });
  return NextResponse.json(storyList);
}, ["journalist", "editor", "admin"]);

export const POST = withAuth(async (req, { session }) => {
  const body = await req.json();
  const parsed = createStorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const story = await createStory(session.user.id, parsed.data);

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "story.create",
    resourceType: "story",
    resourceId: story.id,
    ...meta,
  });

  return NextResponse.json(story, { status: 201 });
}, ["journalist", "editor", "admin"]);
