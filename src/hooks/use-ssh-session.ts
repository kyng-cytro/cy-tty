import { SshClient } from 'expo-ssh';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  password: string;
  privateKeyPem?: string;
  keyPassphrase?: string;
  cols: number;
  rows: number;
  onData: (data: string) => void;
}

export interface UseSshSessionResult {
  status: SshSessionStatus;
  error: string | null;
  write: (data: string) => void;
  disconnect: () => void;
}

/**
 * Strip Java class prefixes and stack-trace lines from native SSH errors
 * so only the human-readable message is shown in the UI.
 * e.g. "com.jcraft.jsch.JSchException: Auth fail\n\tat ..." → "Auth fail"
 */
function extractMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Take only the first line (everything after the first \n is a stack frame)
  const firstLine = raw.split('\n')[0].trim();
  // Strip a leading Java-style class path:  "com.foo.SomeException: the message"
  const colonIdx = firstLine.lastIndexOf(': ');
  if (colonIdx !== -1 && firstLine.slice(0, colonIdx).includes('.')) {
    return firstLine.slice(colonIdx + 2) || 'Connection failed';
  }
  return firstLine || 'Connection failed';
}

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

  useEffect(() => {
    let alive = true;

    const dataSub = SshClient.onData(({ data }) => {
      onDataRef.current(data);
    });

    const errorSub = SshClient.onError(({ message }) => {
      if (!alive) return;
      setError(extractMessage(new Error(message)));
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
        SshClient.resize(colsRef.current, rowsRef.current).catch(() => {});
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(extractMessage(err));
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

  useEffect(() => {
    colsRef.current = cols;
    rowsRef.current = rows;
    if (status === 'connected') {
      SshClient.resize(cols, rows).catch(() => {});
    }
  }, [cols, rows, status]);

  const write = useCallback((data: string) => {
    SshClient.write(data).catch(() => {});
  }, []);

  const disconnect = useCallback(() => {
    SshClient.disconnect().catch(() => {});
    setStatus('disconnected');
  }, []);

  return { status, error, write, disconnect };
}
