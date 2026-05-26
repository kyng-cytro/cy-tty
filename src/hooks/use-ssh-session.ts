import { SshClient } from "expo-ssh";
import { useCallback, useEffect, useRef, useState } from "react";

export type SshSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

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

const FRIENDLY_ERRORS: [RegExp, string][] = [
  [/auth\s*fail/i, "Authentication failed — wrong username or password"],
  [
    /reject\s*host\s*key/i,
    "Host key rejected — accept the server fingerprint first",
  ],
  [
    /host\s*key.*mismatch/i,
    "Host key mismatch — the server fingerprint has changed",
  ],
  [
    /connection\s*refused/i,
    "Connection refused — check the host address and port",
  ],
  [
    /no\s*route\s*to\s*host/i,
    "No route to host — check your network connection",
  ],
  [/network.*unreachable/i, "Network unreachable"],
  [/unknown\s*host/i, "Host not found — check the hostname or IP address"],
  [/timeout/i, "Connection timed out"],
  [/too\s*many\s*auth/i, "Too many failed authentication attempts"],
  [/permission\s*denied/i, "Permission denied"],
];

function extractMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split("\n")[0].trim();
  // Strip leading Java class path (e.g. "com.jcraft.jsch.JSchException: ...")
  // Use indexOf so the rest of the message is kept intact.
  const colonIdx = firstLine.indexOf(": ");
  const stripped =
    colonIdx !== -1 && /^[\w.]+$/.test(firstLine.slice(0, colonIdx))
      ? firstLine.slice(colonIdx + 2)
      : firstLine;
  const msg = stripped || "Connection failed";
  for (const [pattern, friendly] of FRIENDLY_ERRORS) {
    if (pattern.test(msg)) return friendly;
  }
  return msg;
}

export function useSshSession({
  host,
  port = 22,
  username,
  password,
  privateKeyPem,
  keyPassphrase = "",
  cols,
  rows,
  onData,
}: UseSshSessionOptions): UseSshSessionResult {
  const [status, setStatus] = useState<SshSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

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
      setStatus("error");
    });

    const closeSub = SshClient.onClose(() => {
      if (!alive) return;
      setStatus("disconnected");
    });

    setStatus("connecting");
    setError(null);

    const connectPromise = privateKeyPem
      ? SshClient.connectWithKey(
          host,
          port,
          username,
          privateKeyPem,
          keyPassphrase,
        )
      : SshClient.connect({ host, port, username, password });

    connectPromise
      .then(() => {
        if (!alive) return;
        setStatus("connected");
        SshClient.resize(colsRef.current, rowsRef.current).catch(() => {});
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(extractMessage(err));
        setStatus("error");
      });

    return () => {
      alive = false;
      dataSub.remove();
      errorSub.remove();
      closeSub.remove();
      SshClient.disconnect().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    colsRef.current = cols;
    rowsRef.current = rows;
    if (status === "connected") {
      SshClient.resize(cols, rows).catch(() => {});
    }
  }, [cols, rows, status]);

  const write = useCallback((data: string) => {
    SshClient.write(data).catch(() => {});
  }, []);

  const disconnect = useCallback(() => {
    SshClient.disconnect().catch(() => {});
    setStatus("disconnected");
  }, []);

  return { status, error, write, disconnect };
}
