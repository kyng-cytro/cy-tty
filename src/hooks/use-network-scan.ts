import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scanSubnet, type DiscoveredHost } from '@/core/network/scanner';

const CACHE_KEY = 'CY_TTY_SCAN_CACHE';

export interface NetworkScanState {
  hosts: DiscoveredHost[];
  scanning: boolean;
  progress: number;
  rescan: () => void;
}

export function useNetworkScan(): NetworkScanState {
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const runningRef = useRef(false);

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
          setHosts([...found]);
        },
      );
    } finally {
      setScanning(false);
      setProgress(1);
      runningRef.current = false;
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(found)).catch(() => {});
    }
  }, []);

  useEffect(() => { void run(); }, [run]);

  return { hosts, scanning, progress, rescan: run };
}
