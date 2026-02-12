import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import {
  getModerationItem,
  reviewModerationItem,
} from "@/lib/services/moderation-service";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";
import { z } from "zod";

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected", "escalated"]),
  notes: z.string().optional(),
});

export const GET = withAuth(async (req, { params }) => {
  const { id } = await params;
  const item = await getModerationItem(id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(item);
}, ["moderator", "editor", "admin"]);

export const PATCH = withAuth(async (req, { params, session }) => {
  const { id } = await params;
  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await reviewModerationItem(
    id,
    session.user.id,
    parsed.data.decision,
    parsed.data.notes
  );

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: `moderation.${parsed.data.decision}`,
    resourceType: "moderation_item",
    resourceId: id,
    changes: parsed.data,
    ...meta,
  });

  return NextResponse.json(updated);
}, ["moderator", "editor", "admin"]);
