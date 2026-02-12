import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export async function createAuditEntry(params: {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const [entry] = await db
    .insert(auditLogs)
    .values({
      actorId: params.actorId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      changes: params.changes ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    })
    .returning();

  return entry;
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
