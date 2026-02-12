import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
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

  const { data: item, error } = await supabase
    .from("moderation_queue")
    .insert({
      type: "anonymous_tip",
      content: parsed.data.content,
      submitter_ip: ip,
      submitter_email: parsed.data.email ?? null,
      related_story_id: parsed.data.relatedStoryId ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to submit tip" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { id: item.id, message: "Tip submitted for review" },
    { status: 201 }
  );
}
