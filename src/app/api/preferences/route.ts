import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import {
  getPreferences,
  updatePreferences,
} from "@/lib/services/subscriber-service";
import { updatePreferencesSchema } from "@/lib/validators/subscriber";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const GET = withAuth(async (req, { session }) => {
  const prefs = await getPreferences(session.user.id);
  return NextResponse.json(
    prefs ?? {
      followedTopics: [],
      mutedTopics: [],
      followedGeoAreas: [],
      digestFrequency: "daily",
      maxNotificationsPerDay: 10,
      emailNotifications: true,
      pushNotifications: true,
    }
  );
}, ["subscriber", "journalist", "editor", "admin"]);

export const PATCH = withAuth(async (req, { session }) => {
  const body = await req.json();
  const parsed = updatePreferencesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const prefs = await updatePreferences(session.user.id, parsed.data);

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "preferences.update",
    resourceType: "user_preferences",
    resourceId: session.user.id,
    changes: parsed.data,
    ...meta,
  });

  return NextResponse.json(prefs);
}, ["subscriber", "journalist", "editor", "admin"]);
