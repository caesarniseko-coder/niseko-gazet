import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/rbac";
import { createFieldNote, listFieldNotes } from "@/lib/services/field-note-service";
import { createFieldNoteSchema } from "@/lib/validators/field-note";
import { createAuditEntry, extractRequestMeta } from "@/lib/utils/audit-log";

export const GET = withAuth(async (req, { session }) => {
  const notes = await listFieldNotes(session.user.id);
  return NextResponse.json(notes);
}, ["journalist", "editor", "admin"]);

export const POST = withAuth(async (req, { session }) => {
  const body = await req.json();
  const parsed = createFieldNoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const note = await createFieldNote(session.user.id, parsed.data);

  const meta = extractRequestMeta(req);
  await createAuditEntry({
    actorId: session.user.id,
    action: "field_note.create",
    resourceType: "field_note",
    resourceId: note.id,
    ...meta,
  });

  return NextResponse.json(note, { status: 201 });
}, ["journalist", "editor", "admin"]);
