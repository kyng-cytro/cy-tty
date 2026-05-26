import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";

import { KeyStore } from "@/core/keys/key-store";

import type { SshProfile } from "@/core/profiles/types";
import type { TerminalState } from "@/core/terminal/types";
import { useSshSession, type SshSessionStatus } from "@/hooks/use-ssh-session";
import { useTerminal } from "@/hooks/use-terminal";
import {
  CONTENT_PADDING_H,
  CONTENT_PADDING_TOP,
  DEFAULT_CELL_HEIGHT,
  DEFAULT_CELL_WIDTH,
  useTerminalSize,
} from "@/hooks/use-terminal-size";

export interface LiveSession {
  id: string;
  profile: SshProfile;
  status: SshSessionStatus;
  error: string | null;
  write: (data: string) => void;
  disconnect: () => void;
  terminalState: TerminalState;
  cols: number;
  rows: number;
  resize: (cellWidth: number, cellHeight: number) => void;
}

interface SessionManagerContextValue {
  sessions: Map<string, LiveSession>;
  create: (profile: SshProfile) => string;
  destroy: (id: string) => void;
  get: (id: string) => LiveSession | null;
}

const SessionManagerContext = createContext<SessionManagerContextValue | null>(
  null,
);

export function useSessionManager(): SessionManagerContextValue {
  const ctx = useContext(SessionManagerContext);
  if (!ctx)
    throw new Error(
      "useSessionManager must be inside <SessionManagerProvider>",
    );
  return ctx;
}

interface SessionNodeProps {
  id: string;
  profile: SshProfile;
  onUpdate: (id: string, update: Partial<LiveSession>) => void;
}

interface SessionNodeInnerProps extends SessionNodeProps {
  privateKeyPem?: string;
}

function SessionNodeInner({
  id,
  profile,
  privateKeyPem,
  onUpdate,
}: SessionNodeInnerProps) {
  const [cellSize, setCellSize] = useState({
    width: DEFAULT_CELL_WIDTH,
    height: DEFAULT_CELL_HEIGHT,
  });

  const { cols, rows } = useTerminalSize({
    cellWidth: cellSize.width,
    cellHeight: cellSize.height,
    paddingTop: CONTENT_PADDING_TOP,
    paddingH: CONTENT_PADDING_H,
  });

  const { state, processBytes } = useTerminal({ cols, rows });

  const { status, error, write, disconnect } = useSshSession({
    sessionId: id,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    password: profile.password ?? "",
    privateKeyPem,
    keyPassphrase: profile.keyPassphrase ?? "",
    cols,
    rows,
    onData: processBytes,
  });

  // write/disconnect come from useSshSession(useCallback([])) so they are
  // already stable, but we forward through refs so we never need to list
  // them as useEffect deps — avoiding spurious effect firings.
  const resizeFn = useCallback((cw: number, ch: number) => {
    setCellSize((prev) =>
      prev.width === cw && prev.height === ch
        ? prev
        : { width: cw, height: ch },
    );
  }, []);

  const writeRef = useRef(write);
  const disconnectRef = useRef(disconnect);
  const resizeRef = useRef(resizeFn);

  writeRef.current = write;
  disconnectRef.current = disconnect;
  resizeRef.current = resizeFn;

  const stableWrite = useCallback((data: string) => writeRef.current(data), []);
  const stableDisconnect = useCallback(() => disconnectRef.current(), []);
  const stableResize = useCallback(
    (cw: number, ch: number) => resizeRef.current(cw, ch),
    [],
  );

  useEffect(() => {
    onUpdate(id, {
      status,
      error,
      write: stableWrite,
      disconnect: stableDisconnect,
      terminalState: state,
      cols,
      rows,
      resize: stableResize,
    });
  }, [
    id,
    status,
    error,
    state,
    cols,
    rows,
    stableWrite,
    stableDisconnect,
    stableResize,
    onUpdate,
  ]);

  return null;
}

// Loads the private key PEM (if needed) before mounting SessionNodeInner.
// useSshSession connects immediately on mount with [] deps, so the PEM must
// be available before the inner component renders.
function SessionNode({ id, profile, onUpdate }: SessionNodeProps) {
  // undefined = still loading, null = not needed / failed
  const [privateKeyPem, setPrivateKeyPem] = useState<string | null | undefined>(
    profile.authMethod === "key" ? undefined : null,
  );

  useEffect(() => {
    if (profile.authMethod === "key" && profile.privateKeyId) {
      KeyStore.read(profile.privateKeyId)
        .then((pem) => setPrivateKeyPem(pem))
        .catch(() => setPrivateKeyPem(null));
    } else {
      setPrivateKeyPem(null);
    }
  }, [profile.authMethod, profile.privateKeyId]);

  if (privateKeyPem === undefined) return null;

  return (
    <SessionNodeInner
      id={id}
      profile={profile}
      privateKeyPem={privateKeyPem ?? undefined}
      onUpdate={onUpdate}
    />
  );
}

interface SessionEntry {
  profile: SshProfile;
  liveData: LiveSession;
}

let _nextId = 1;
function generateId(): string {
  return `session_${Date.now()}_${_nextId++}`;
}

export function SessionManagerProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, SessionEntry>>(new Map());

  // Guard: only call setEntries (which triggers a re-render) if at least one
  // value actually changed. Returning `prev` from the setter bails out with
  // no re-render — this prevents the update→render→update infinite loop.
  const handleUpdate = useCallback(
    (id: string, update: Partial<LiveSession>) => {
      setEntries((prev) => {
        const entry = prev.get(id);
        if (!entry) return prev;

        const live = entry.liveData;
        const keys = Object.keys(update) as (keyof LiveSession)[];
        const changed = keys.some(
          (k) =>
            (update as unknown as Record<string, unknown>)[k] !==
            (live as unknown as Record<string, unknown>)[k],
        );
        if (!changed) return prev;

        const next = new Map(prev);
        next.set(id, { ...entry, liveData: { ...live, ...update } });
        return next;
      });
    },
    [],
  );

  const create = useCallback((profile: SshProfile): string => {
    const id = generateId();
    const placeholder: LiveSession = {
      id,
      profile,
      status: "connecting",
      error: null,
      write: () => {},
      disconnect: () => {},
      terminalState: {
        grid: [],
        cursor: { row: 0, col: 0, visible: true, shape: "block" },
        cols: 80,
        rows: 24,
        title: "",
        alternateScreen: false,
      },
      cols: 80,
      rows: 24,
      resize: () => {},
    };
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(id, { profile, liveData: placeholder });
      return next;
    });
    return id;
  }, []);

  const destroy = useCallback((id: string) => {
    setEntries((prev) => {
      const entry = prev.get(id);
      if (entry) {
        entry.liveData.disconnect();
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const get = useCallback(
    (id: string): LiveSession | null => entries.get(id)?.liveData ?? null,
    [entries],
  );

  const sessions = new Map(
    Array.from(entries.entries()).map(([id, e]) => [id, e.liveData]),
  );

  return (
    <SessionManagerContext.Provider value={{ sessions, create, destroy, get }}>
      <View style={styles.hidden} pointerEvents="none">
        {Array.from(entries.entries()).map(([id, entry]) => (
          <SessionNode
            key={id}
            id={id}
            profile={entry.profile}
            onUpdate={handleUpdate}
          />
        ))}
      </View>
      {children}
    </SessionManagerContext.Provider>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 0,
    height: 0,
    overflow: "hidden",
  },
});
