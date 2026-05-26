import { SshClient } from 'expo-ssh';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export type SshSessionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface UseSshSessionOptions {
  host: string;
  port?: number;
  username: string;
  /** Used for password auth. Pass empty string when using key auth. */
  password: string;
  /** PEM-encoded private key for key-based auth. Takes priority over password when set. */
  privateKeyPem?: string;
  /** Passphrase for encrypted private keys. Empty string for unencrypted keys. */
  keyPassphrase?: string;
  /** Current terminal columns — sent as PTY size on connect and on change. */
  cols: number;
  /** Current terminal rows — sent as PTY size on connect and on change. */
  rows: number;
  /**
   * Called with each raw data chunk received from the SSH server.
   * Pass directly to GhosttyVt.processBytes / useTerminal.processBytes.
   */
  onData: (data: string) => void;
}

export interface UseSshSessionResult {
  status: SshSessionStatus;
  /** Non-null when status === 'error'. */
  error: string | null;
  /** Send raw input to the remote shell (keyboard data, paste, etc.). */
  write: (data: string) => void;
  /** Gracefully close the connection. */
  disconnect: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Manages an SSH session lifecycle tied to a React component.
 *
 * - Connects automatically on mount.
 * - Forwards received bytes to `onData` via a stable ref (no re-subscribe on renders).
 * - Sends a PTY resize whenever `cols` or `rows` change while connected.
 * - Disconnects and cleans up subscriptions on unmount.
 *
 * ```tsx
 * const { status, error, write, disconnect } = useSshSession({
 *   host, port, username, password,
 *   cols, rows,
 *   onData: processBytes,   // from useTerminal
 * });
 * ```
 */
export function useSshSession({
  host,
  port = 22,
  username,
  password,
  privateKeyPem,
  keyPassphrase = '',
  cols,
  rows,
  onData,
}: UseSshSessionOptions): UseSshSessionResult {
  const [status, setStatus] = useState<SshSessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to onData so we never need to re-subscribe
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  // Track live cols/rows for resize without re-triggering the connect effect
  const colsRef = useRef(cols);
  const rowsRef = useRef(rows);

  // ── Connect on mount, clean up on unmount ──────────────────────────────
  useEffect(() => {
    let alive = true;

    const dataSub = SshClient.onData(({ data }) => {
      onDataRef.current(data);
    });

    const errorSub = SshClient.onError(({ message }) => {
      if (!alive) return;
      setError(message);
      setStatus('error');
    });

    const closeSub = SshClient.onClose(() => {
      if (!alive) return;
      setStatus('disconnected');
    });

    setStatus('connecting');
    setError(null);

    const connectPromise = privateKeyPem
      ? SshClient.connectWithKey(host, port, username, privateKeyPem, keyPassphrase)
      : SshClient.connect({ host, port, username, password });

    connectPromise
      .then(() => {
        if (!alive) return;
        setStatus('connected');
        // Send initial PTY dimensions to the remote shell
        SshClient.resize(colsRef.current, rowsRef.current).catch(() => {});
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setError(msg);
        setStatus('error');
      });

    return () => {
      alive = false;
      dataSub.remove();
      errorSub.remove();
      closeSub.remove();
      SshClient.disconnect().catch(() => {});
    };
    // Intentionally omitted: host/port/username/password — these are route
    // params that never change while the screen is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PTY resize when terminal geometry changes ──────────────────────────
  useEffect(() => {
    colsRef.current = cols;
    rowsRef.current = rows;
    if (status === 'connected') {
      SshClient.resize(cols, rows).catch(() => {});
    }
  }, [cols, rows, status]);

  // ── Public actions ─────────────────────────────────────────────────────
  const write = useCallback((data: string) => {
    SshClient.write(data).catch(() => {});
  }, []);

  const disconnect = useCallback(() => {
    SshClient.disconnect().catch(() => {});
    setStatus('disconnected');
  }, []);

  return { status, error, write, disconnect };
}
