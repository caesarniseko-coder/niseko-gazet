import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { listPipelineRuns } from "@/lib/services/haystack-service";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const runs = await listPipelineRuns(limit);
  return NextResponse.json(runs);
}, ["editor", "admin"]);
