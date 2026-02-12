import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import {
  getSubscription,
  createSubscription,
  cancelSubscription,
} from "@/lib/services/subscriber-service";
import { createSubscriptionSchema } from "@/lib/validators/subscriber";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const GET = withAuth(async (req, { session }) => {
  const sub = await getSubscription(session.user.id);
  return NextResponse.json(sub ?? { plan: "free", isActive: false });
}, ["subscriber", "journalist", "editor", "admin"]);

export const POST = withAuth(async (req, { session }) => {
  const body = await req.json();
  const parsed = createSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sub = await createSubscription(session.user.id, parsed.data);

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "subscription.create",
    resourceType: "subscription",
    resourceId: sub.id,
    changes: { plan: parsed.data.plan },
    ...meta,
  });

  return NextResponse.json(sub, { status: 201 });
}, ["subscriber", "journalist", "editor", "admin"]);

export const DELETE = withAuth(async (req, { session }) => {
  const result = await cancelSubscription(session.user.id);

  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "subscription.cancel",
    resourceType: "subscription",
    resourceId: result.id,
    ...meta,
  });

  return NextResponse.json({ success: true });
}, ["subscriber", "journalist", "editor", "admin"]);
