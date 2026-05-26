import { useSessionManager, type LiveSession } from '@/core/sessions/session-manager';

export function useSession(id: string | null | undefined): LiveSession | null {
  const { get } = useSessionManager();
  if (!id) return null;
  return get(id);
}
