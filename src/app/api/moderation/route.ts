import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { listModerationItems } from "@/lib/services/moderation-service";

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const items = await listModerationItems(status);
  return NextResponse.json(items);
}, ["moderator", "editor", "admin"]);
