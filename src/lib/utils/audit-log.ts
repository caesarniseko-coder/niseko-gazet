import { supabase } from "@/lib/supabase/server";
import { toCamelCase } from "@/lib/supabase/helpers";

export async function createAuditEntry(params: {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { data, error } = await supabase
    .from("audit_logs")
    .insert({
      actor_id: params.actorId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      changes: params.changes ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create audit entry: ${error.message}`);
  return toCamelCase(data);
}

/**
 * Extract IP address and User-Agent from a Request object.
 */
export function extractRequestMeta(req: Request) {
  return {
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown",
    userAgent: req.headers.get("user-agent") ?? "unknown",
  };
}
