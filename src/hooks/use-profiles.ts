/**
 * useProfiles — React hook for managing SSH profiles.
 *
 * Loads all profiles from SecureStore on mount.
 * Exposes CRUD helpers that keep local state in sync.
 */

import { useCallback, useEffect, useState } from 'react';
import { ProfileStorage } from '@/core/profiles/storage';
import type { SshProfile } from '@/core/profiles/types';

export function useProfiles() {
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ProfileStorage.loadAll();
      // Sort by lastConnected descending
      list.sort((a, b) => (b.lastConnected ?? b.createdAt) - (a.lastConnected ?? a.createdAt));
      setProfiles(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async (profile: SshProfile) => {
    await ProfileStorage.save(profile);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await ProfileStorage.remove(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const touch = useCallback(async (id: string) => {
    await ProfileStorage.touch(id);
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, lastConnected: Date.now() } : p)),
    );
  }, []);

  return { profiles, loading, reload, save, remove, touch };
}
