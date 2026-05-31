import { SshClient } from "expo-ssh";
import { useCallback, useEffect, useRef, useState } from "react";

export type SshSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

export interface UseSshSessionOptions {
  sessionId: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  privateKeyPem?: string;
  keyPassphrase?: string;
  cols: number;
  rows: number;
  onData: (data: string) => void;
  onAuthChallenge?: (url: string) => void;
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
  [
    /call to function.*has been rejected/i,
    "Connection failed — could not reach server",
  ],
];

function extractMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Unwrap Expo native module rejection: "Call to function '...' has been rejected.\n\nCaused by: <real error>"
  const causedByMatch = raw.match(/[Cc]aused\s+by[:\s]+(.+)/s);
  const base = causedByMatch
    ? causedByMatch[1].split("\n")[0].trim()
    : raw.split("\n")[0].trim();
  // Strip leading Java class path (e.g. "com.jcraft.jsch.JSchException: ...")
  const colonIdx = base.indexOf(": ");
  const stripped =
    colonIdx !== -1 && /^[\w.]+$/.test(base.slice(0, colonIdx))
      ? base.slice(colonIdx + 2)
      : base;
  const msg = stripped || "Connection failed";
  for (const [pattern, friendly] of FRIENDLY_ERRORS) {
    if (pattern.test(msg)) return friendly;
  }
  return msg;
}

export function useSshSession({
  sessionId,
  host,
  port = 22,
  username,
  password,
  privateKeyPem,
  keyPassphrase = "",
  cols,
  rows,
  onData,
  onAuthChallenge,
}: UseSshSessionOptions): UseSshSessionResult {
  const [status, setStatus] = useState<SshSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  const onAuthChallengeRef = useRef(onAuthChallenge);
  useEffect(() => {
    onAuthChallengeRef.current = onAuthChallenge;
  }, [onAuthChallenge]);

  const colsRef = useRef(cols);
  const rowsRef = useRef(rows);

  useEffect(() => {
    let alive = true;

    const dataSub = SshClient.onData(({ sessionId: id, data }) => {
      if (id === sessionId) onDataRef.current(data);
    });

    const errorSub = SshClient.onError(({ sessionId: id, message }) => {
      if (!alive || id !== sessionId) return;
      setError(extractMessage(new Error(message)));
      setStatus("error");
    });

    const closeSub = SshClient.onClose(({ sessionId: id }) => {
      if (!alive || id !== sessionId) return;
      setStatus("disconnected");
    });

    const challengeSub = SshClient.onAuthChallenge(({ sessionId: id, url }) => {
      if (id !== sessionId) return;
      onAuthChallengeRef.current?.(url);
    });

    setStatus("connecting");
    setError(null);

    const connectPromise = privateKeyPem
      ? SshClient.connectWithKey(
          sessionId,
          host,
          port,
          username,
          privateKeyPem,
          keyPassphrase,
        )
      : SshClient.connect(sessionId, { host, port, username, password });

    connectPromise
      .then(() => {
        if (!alive) return;
        setStatus("connected");
        SshClient.resize(sessionId, colsRef.current, rowsRef.current).catch(
          () => {},
        );
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
      challengeSub.remove();
      SshClient.disconnect(sessionId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    colsRef.current = cols;
    rowsRef.current = rows;
    if (status === "connected") {
      SshClient.resize(sessionId, cols, rows).catch(() => {});
    }
  }, [cols, rows, status, sessionId]);

  const write = useCallback(
    (data: string) => {
      SshClient.write(sessionId, data).catch(() => {});
    },
    [sessionId],
  );

  const disconnect = useCallback(() => {
    SshClient.disconnect(sessionId).catch(() => {});
  }, [sessionId]);

  return { status, error, write, disconnect };
}
