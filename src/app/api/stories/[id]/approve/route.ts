import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { createApproval } from "@/lib/services/story-service";
import { createApprovalSchema } from "@/lib/validators/approval";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const POST = withAuth(async (req, { params, session }) => {
  const { id } = await params;
  const body = await req.json();
  const parsed = createApprovalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await createApproval(id, session.user.id, parsed.data);

  if ("error" in result) {
    const errorKey = result.error as string;
    const statusMap: Record<string, number> = {
      version_not_found: 404,
      already_approved: 409,
    };

    return NextResponse.json(
      { error: errorKey },
      { status: statusMap[errorKey] ?? 400 }
    );
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: `story.${parsed.data.decision}`,
    resourceType: "approval_record",
    resourceId: result.record.id,
    changes: {
      storyId: id,
      versionHash: parsed.data.versionHash,
      decision: parsed.data.decision,
    },
    ...meta,
  });

  return NextResponse.json(result.record, { status: 201 });
}, ["editor", "admin"]);
