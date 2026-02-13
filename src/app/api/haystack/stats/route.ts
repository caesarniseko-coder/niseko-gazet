import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { getPipelineStats } from "@/lib/services/haystack-service";

export const GET = withAuth(async () => {
  const stats = await getPipelineStats();
  return NextResponse.json(stats);
}, ["editor", "admin"]);
