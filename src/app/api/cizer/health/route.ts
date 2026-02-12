import { NextResponse } from "next/server";

const CIZER_URL = process.env.CIZER_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${CIZER_URL}/health`);
    if (!res.ok) throw new Error("Cizer unhealthy");
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { service: "cizer", status: "unreachable" },
      { status: 503 }
    );
  }
}
