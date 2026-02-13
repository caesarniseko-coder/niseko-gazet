import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";

const HAYSTACK_URL = process.env.HAYSTACK_URL || "http://localhost:8001";
const VALID_CYCLES = ["main", "weather", "deep_scrape", "tips"];

export const POST = withAuth(async (req) => {
  const { cycle } = await req.json();

  if (!cycle || !VALID_CYCLES.includes(cycle)) {
    return NextResponse.json(
      { error: `Invalid cycle. Must be one of: ${VALID_CYCLES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${HAYSTACK_URL}/trigger/${cycle}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      return NextResponse.json(
        { error: err.detail || "Pipeline trigger failed" },
        { status: res.status }
      );
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to reach Haystack service";
    return NextResponse.json(
      { error: `Haystack unreachable: ${message}` },
      { status: 502 }
    );
  }
}, ["editor", "admin"]);
