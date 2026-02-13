import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import {
  getTopicTrends,
  getSourceAnalytics,
} from "@/lib/services/haystack-service";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "trends";
  const hours = parseInt(searchParams.get("hours") ?? "24", 10);

  if (type === "trends") {
    const trends = await getTopicTrends(hours);
    return NextResponse.json(trends);
  }

  if (type === "sources") {
    const sources = await getSourceAnalytics();
    return NextResponse.json(sources);
  }

  return NextResponse.json(
    { error: "Invalid type. Use 'trends' or 'sources'." },
    { status: 400 }
  );
}, ["editor", "admin"]);
