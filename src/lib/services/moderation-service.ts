import { supabase } from "@/lib/supabase/server";
import { toCamelCase, mapRows } from "@/lib/supabase/helpers";

export async function listModerationItems(status?: string) {
  let query = supabase
    .from("moderation_queue")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list moderation items: ${error.message}`);
  return mapRows(data ?? []);
}

export async function getModerationItem(id: string) {
  const { data, error } = await supabase
    .from("moderation_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get moderation item: ${error.message}`);
  return data ? toCamelCase(data) : null;
}

export async function reviewModerationItem(
  id: string,
  reviewerId: string,
  decision: "approved" | "rejected" | "escalated",
  notes?: string
) {
  const { data, error } = await supabase
    .from("moderation_queue")
    .update({
      status: decision,
      reviewed_by: reviewerId,
      review_notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to review moderation item: ${error.message}`);
  return data ? toCamelCase(data) : null;
}
