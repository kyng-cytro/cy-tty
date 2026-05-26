/**
 * useSession — look up a live session by ID from the SessionManager context.
 *
 * Returns null if the ID is not found (session was destroyed or ID is wrong).
 */

import { useSessionManager, type LiveSession } from '@/core/sessions/session-manager';

export function useSession(id: string | null | undefined): LiveSession | null {
  const { get } = useSessionManager();
  if (!id) return null;
  return get(id);
}
