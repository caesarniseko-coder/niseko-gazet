import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import {
  createStoryVersion,
  listStoryVersions,
} from "@/lib/services/story-service";
import { createStoryVersionSchema } from "@/lib/validators/story";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const GET = withAuth(async (req, { params, session: _session }) => {
  const { id } = await params;
  const versions = await listStoryVersions(id);
  return NextResponse.json(versions);
}, ["journalist", "editor", "admin"]);

export const POST = withAuth(async (req, { params, session }) => {
  const { id } = await params;
  const body = await req.json();
  const parsed = createStoryVersionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await createStoryVersion(id, parsed.data);

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: 404 }
    );
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "story_version.create",
    resourceType: "story_version",
    resourceId: result.version.id,
    changes: { versionHash: result.version.versionHash, versionNumber: result.version.versionNumber },
    ...meta,
  });

  return NextResponse.json(result.version, { status: 201 });
}, ["journalist", "editor", "admin"]);
