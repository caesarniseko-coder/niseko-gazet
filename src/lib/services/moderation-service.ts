import { db } from "@/lib/db";
import { moderationQueue } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function listModerationItems(status?: string) {
  if (status) {
    return db
      .select()
      .from(moderationQueue)
      .where(eq(moderationQueue.status, status as "pending" | "approved" | "rejected" | "escalated"))
      .orderBy(desc(moderationQueue.createdAt));
  }
  return db
    .select()
    .from(moderationQueue)
    .orderBy(desc(moderationQueue.createdAt));
}

export async function getModerationItem(id: string) {
  const [item] = await db
    .select()
    .from(moderationQueue)
    .where(eq(moderationQueue.id, id))
    .limit(1);
  return item ?? null;
}

export async function reviewModerationItem(
  id: string,
  reviewerId: string,
  decision: "approved" | "rejected" | "escalated",
  notes?: string
) {
  const [updated] = await db
    .update(moderationQueue)
    .set({
      status: decision,
      reviewedBy: reviewerId,
      reviewNotes: notes ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(moderationQueue.id, id))
    .returning();

  return updated ?? null;
}
