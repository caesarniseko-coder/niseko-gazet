import { type NextRequest, NextResponse } from "next/server";
import { auth } from "./config";
import type { UserRole } from "@/types/enums";

/**
 * Role hierarchy: higher index = more privilege.
 * A role can access anything its level or below.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  anonymous: 0,
  subscriber: 1,
  journalist: 2,
  moderator: 3,
  editor: 4,
  admin: 5,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function hasAnyRole(
  userRole: UserRole,
  allowedRoles: UserRole[]
): boolean {
  return allowedRoles.some(
    (role) => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[role]
  );
}

type AuthenticatedSession = {
  user: { id: string; role: UserRole; name: string; email: string };
};

type ApiHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>>; session: AuthenticatedSession }
) => Promise<NextResponse | Response>;

/**
 * Wraps an API route handler with authentication and role-based access control.
 * Returns 401 if not authenticated, 403 if role is insufficient.
 */
export function withAuth(handler: ApiHandler, allowedRoles: UserRole[]) {
  return async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> }
  ) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const userRole = session.user.role as UserRole;

    if (!hasAnyRole(userRole, allowedRoles)) {
      return NextResponse.json(
        {
          error: "forbidden",
          message: "Insufficient permissions",
          required: allowedRoles,
          current: userRole,
        },
        { status: 403 }
      );
    }

    return handler(req, {
      params: context.params,
      session: session as AuthenticatedSession,
    });
  };
}
