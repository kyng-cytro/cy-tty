/**
 * useNetworkScan — React hook for scanning the local network for SSH hosts.
 *
 * - Starts a scan on first mount.
 * - Caches the last results in AsyncStorage so they appear instantly on re-open.
 * - Exposes a `rescan()` function to trigger a fresh scan.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scanSubnet, type DiscoveredHost } from '@/core/network/scanner';

const CACHE_KEY = 'CY_TTY_SCAN_CACHE';

export interface NetworkScanState {
  hosts: DiscoveredHost[];
  scanning: boolean;
  /** 0–1, fraction of subnet probed */
  progress: number;
  rescan: () => void;
}

export function useNetworkScan(): NetworkScanState {
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const runningRef = useRef(false);

  // Load cached results immediately
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (raw) setHosts(JSON.parse(raw) as DiscoveredHost[]);
      })
      .catch(() => {});
  }, []);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setScanning(true);
    setProgress(0);
    const found: DiscoveredHost[] = [];

    try {
      await scanSubnet(
        (scanned, total) => setProgress(scanned / total),
        (host) => {
          found.push(host);
          // Update state incrementally so new hosts appear as found
          setHosts([...found]);
        },
      );
    } finally {
      setScanning(false);
      setProgress(1);
      runningRef.current = false;
      // Persist results
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(found)).catch(() => {});
    }
  }, []);

  // Auto-scan on mount
  useEffect(() => { void run(); }, [run]);

  return { hosts, scanning, progress, rescan: run };
}
