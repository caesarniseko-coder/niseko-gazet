import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { publishStory } from "@/lib/services/story-service";
import { publishSchema } from "@/lib/validators/approval";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const POST = withAuth(async (req, { params, session }) => {
  const { id } = await params;
  const body = await req.json();
  const parsed = publishSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await publishStory(id, parsed.data);

  if (!result.success) {
    const statusMap: Record<string, number> = {
      story_not_found: 404,
      version_not_found: 404,
      no_approval: 403,
      hash_mismatch: 409,
      unacknowledged_risk_flags: 403,
    };

    return NextResponse.json(
      { error: result.error.type, details: result.error },
      { status: statusMap[result.error.type] ?? 400 }
    );
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "story.publish",
    resourceType: "story",
    resourceId: id,
    changes: { versionHash: parsed.data.versionHash },
    ...meta,
  });

  return NextResponse.json(result.story);
}, ["editor", "admin"]);
