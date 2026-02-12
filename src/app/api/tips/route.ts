import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { moderationQueue } from "@/lib/db/schema";
import { z } from "zod";

const tipSchema = z.object({
  content: z.string().min(10, "Tip must be at least 10 characters"),
  email: z.string().email().optional(),
  relatedStoryId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = tipSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const [item] = await db
    .insert(moderationQueue)
    .values({
      type: "anonymous_tip",
      content: parsed.data.content,
      submitterIp: ip,
      submitterEmail: parsed.data.email ?? null,
      relatedStoryId: parsed.data.relatedStoryId ?? null,
    })
    .returning();

  return NextResponse.json(
    { id: item.id, message: "Tip submitted for review" },
    { status: 201 }
  );
}
