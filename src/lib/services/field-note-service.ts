import { db } from "@/lib/db";
import { fieldNotes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { CreateFieldNoteInput, UpdateFieldNoteInput } from "@/lib/validators/field-note";

export async function createFieldNote(
  authorId: string,
  input: CreateFieldNoteInput
) {
  const [note] = await db
    .insert(fieldNotes)
    .values({
      authorId,
      who: input.who ?? null,
      what: input.what,
      whenOccurred: input.whenOccurred ? new Date(input.whenOccurred) : null,
      whereLocation: input.whereLocation ?? null,
      why: input.why ?? null,
      how: input.how ?? null,
      quotes: input.quotes,
      contacts: input.contacts,
      evidenceRefs: input.evidenceRefs,
      confidenceScore: input.confidenceScore,
      safetyLegalFlags: input.safetyLegalFlags,
      geoLat: input.geoLat ?? null,
      geoLng: input.geoLng ?? null,
      rawText: input.rawText ?? null,
    })
    .returning();

  return note;
}

export async function getFieldNote(id: string) {
  const [note] = await db
    .select()
    .from(fieldNotes)
    .where(eq(fieldNotes.id, id))
    .limit(1);

  return note ?? null;
}

export async function listFieldNotes(authorId?: string) {
  const query = db.select().from(fieldNotes);

  if (authorId) {
    return query
      .where(eq(fieldNotes.authorId, authorId))
      .orderBy(desc(fieldNotes.createdAt));
  }

  return query.orderBy(desc(fieldNotes.createdAt));
}

export async function updateFieldNote(
  id: string,
  authorId: string,
  input: UpdateFieldNoteInput
) {
  const [existing] = await db
    .select()
    .from(fieldNotes)
    .where(and(eq(fieldNotes.id, id), eq(fieldNotes.authorId, authorId)))
    .limit(1);

  if (!existing) return null;

  const [updated] = await db
    .update(fieldNotes)
    .set({
      ...(input.who !== undefined && { who: input.who }),
      ...(input.what !== undefined && { what: input.what }),
      ...(input.whenOccurred !== undefined && {
        whenOccurred: input.whenOccurred ? new Date(input.whenOccurred) : null,
      }),
      ...(input.whereLocation !== undefined && {
        whereLocation: input.whereLocation,
      }),
      ...(input.why !== undefined && { why: input.why }),
      ...(input.how !== undefined && { how: input.how }),
      ...(input.quotes !== undefined && { quotes: input.quotes }),
      ...(input.contacts !== undefined && { contacts: input.contacts }),
      ...(input.evidenceRefs !== undefined && {
        evidenceRefs: input.evidenceRefs,
      }),
      ...(input.confidenceScore !== undefined && {
        confidenceScore: input.confidenceScore,
      }),
      ...(input.safetyLegalFlags !== undefined && {
        safetyLegalFlags: input.safetyLegalFlags,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.geoLat !== undefined && { geoLat: input.geoLat }),
      ...(input.geoLng !== undefined && { geoLng: input.geoLng }),
      ...(input.rawText !== undefined && { rawText: input.rawText }),
      updatedAt: new Date(),
    })
    .where(eq(fieldNotes.id, id))
    .returning();

  return updated;
}

export async function deleteFieldNote(id: string, authorId: string) {
  const [existing] = await db
    .select()
    .from(fieldNotes)
    .where(and(eq(fieldNotes.id, id), eq(fieldNotes.authorId, authorId)))
    .limit(1);

  if (!existing) return false;

  await db.delete(fieldNotes).where(eq(fieldNotes.id, id));
  return true;
}
