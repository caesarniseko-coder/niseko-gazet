import { auth } from "./config";
import type { UserRole } from "@/types/enums";

export type SessionUser = {
  id: string;
  role: UserRole;
  name: string;
  email: string;
};

/**
 * Get the current session user from server components/actions.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    role: session.user.role as UserRole,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required");
  return user;
}
