import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import {
  getFieldNote,
  updateFieldNote,
  deleteFieldNote,
  transitionFieldNoteStatus,
} from "@/lib/services/field-note-service";
import { updateFieldNoteSchema } from "@/lib/validators/field-note";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const GET = withAuth(async (req, { params, session: _session }) => {
  const { id } = await params;
  const note = await getFieldNote(id);

  if (!note) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(note);
}, ["journalist", "editor", "admin"]);

export const PATCH = withAuth(async (req, { params, session }) => {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateFieldNoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // If only status is changing, use the state machine transition
  if (parsed.data.status && Object.keys(parsed.data).length === 1) {
    try {
      const transitioned = await transitionFieldNoteStatus(id, parsed.data.status);
      if (!transitioned) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      const meta = extractRequestMeta(req);
      await createAuditEntry({
        actorId: session.user.id,
        action: "field_note.status_change",
        resourceType: "field_note",
        resourceId: id,
        changes: { status: parsed.data.status },
        ...meta,
      });

      return NextResponse.json(transitioned);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid transition";
      return NextResponse.json({ error: message }, { status: 422 });
    }
  }

  const updated = await updateFieldNote(id, session.user.id, parsed.data);

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "field_note.update",
    resourceType: "field_note",
    resourceId: id,
    changes: parsed.data,
    ...meta,
  });

  return NextResponse.json(updated);
}, ["journalist", "editor", "admin"]);

export const DELETE = withAuth(async (req, { params, session }) => {
  const { id } = await params;
  const deleted = await deleteFieldNote(id, session.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "field_note.delete",
    resourceType: "field_note",
    resourceId: id,
    ...meta,
  });

  return NextResponse.json({ success: true });
}, ["journalist", "editor", "admin"]);
