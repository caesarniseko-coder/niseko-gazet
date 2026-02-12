import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";

const CIZER_URL = process.env.CIZER_URL ?? "http://localhost:8000";

export const POST = withAuth(async (req) => {
  const body = await req.json();

  try {
    const res = await fetch(`${CIZER_URL}/risks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "Cizer error" }));
      return NextResponse.json(
        { error: "cizer_error", detail: error.detail },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "cizer_unavailable" },
      { status: 503 }
    );
  }
}, ["journalist", "editor", "admin"]);
