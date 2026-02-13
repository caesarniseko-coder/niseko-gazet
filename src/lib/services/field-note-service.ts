import { supabase } from "@/lib/supabase/server";
import { toCamelCase, mapRows } from "@/lib/supabase/helpers";
import type { CreateFieldNoteInput, UpdateFieldNoteInput } from "@/lib/validators/field-note";

export async function createFieldNote(
  authorId: string,
  input: CreateFieldNoteInput
) {
  const { data, error } = await supabase
    .from("field_notes")
    .insert({
      author_id: authorId,
      who: input.who ?? null,
      what: input.what,
      when_occurred: input.whenOccurred ?? null,
      where_location: input.whereLocation ?? null,
      why: input.why ?? null,
      how: input.how ?? null,
      quotes: input.quotes,
      contacts: input.contacts,
      evidence_refs: input.evidenceRefs,
      confidence_score: input.confidenceScore,
      safety_legal_flags: input.safetyLegalFlags,
      geo_lat: input.geoLat ?? null,
      geo_lng: input.geoLng ?? null,
      raw_text: input.rawText ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create field note: ${error.message}`);
  return toCamelCase(data);
}

export async function getFieldNote(id: string) {
  const { data, error } = await supabase
    .from("field_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get field note: ${error.message}`);
  return data ? toCamelCase(data) : null;
}

export async function listFieldNotes(opts?: {
  authorId?: string;
  status?: string;
}) {
  let query = supabase
    .from("field_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (opts?.authorId) {
    query = query.eq("author_id", opts.authorId);
  }
  if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list field notes: ${error.message}`);
  return mapRows(data ?? []);
}

export async function updateFieldNote(
  id: string,
  authorId: string,
  input: UpdateFieldNoteInput
) {
  // Check ownership
  const { data: existing } = await supabase
    .from("field_notes")
    .select("id")
    .eq("id", id)
    .eq("author_id", authorId)
    .maybeSingle();

  if (!existing) return null;

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.who !== undefined) updateData.who = input.who;
  if (input.what !== undefined) updateData.what = input.what;
  if (input.whenOccurred !== undefined) updateData.when_occurred = input.whenOccurred;
  if (input.whereLocation !== undefined) updateData.where_location = input.whereLocation;
  if (input.why !== undefined) updateData.why = input.why;
  if (input.how !== undefined) updateData.how = input.how;
  if (input.quotes !== undefined) updateData.quotes = input.quotes;
  if (input.contacts !== undefined) updateData.contacts = input.contacts;
  if (input.evidenceRefs !== undefined) updateData.evidence_refs = input.evidenceRefs;
  if (input.confidenceScore !== undefined) updateData.confidence_score = input.confidenceScore;
  if (input.safetyLegalFlags !== undefined) updateData.safety_legal_flags = input.safetyLegalFlags;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.geoLat !== undefined) updateData.geo_lat = input.geoLat;
  if (input.geoLng !== undefined) updateData.geo_lng = input.geoLng;
  if (input.rawText !== undefined) updateData.raw_text = input.rawText;

  const { data, error } = await supabase
    .from("field_notes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update field note: ${error.message}`);
  return toCamelCase(data);
}

/** Valid status transitions for field notes */
const VALID_TRANSITIONS: Record<string, string[]> = {
  raw: ["processing", "archived"],
  processing: ["packaged", "raw", "archived"],
  packaged: ["assigned", "archived"],
  assigned: ["archived"],
  archived: ["raw"],
};

export async function transitionFieldNoteStatus(
  id: string,
  newStatus: string
): Promise<Record<string, unknown> | null> {
  const { data: note } = await supabase
    .from("field_notes")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!note) return null;

  const allowed = VALID_TRANSITIONS[note.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${note.status} → ${newStatus}. Allowed: ${allowed.join(", ")}`
    );
  }

  const { data, error } = await supabase
    .from("field_notes")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to transition field note: ${error.message}`);
  return toCamelCase(data);
}

export async function deleteFieldNote(id: string, authorId: string) {
  // Check ownership
  const { data: existing } = await supabase
    .from("field_notes")
    .select("id")
    .eq("id", id)
    .eq("author_id", authorId)
    .maybeSingle();

  if (!existing) return false;

  const { error } = await supabase
    .from("field_notes")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete field note: ${error.message}`);
  return true;
}
