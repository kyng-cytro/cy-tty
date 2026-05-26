/**
 * SessionManager
 *
 * Keeps SSH sessions alive even when the terminal screen is unmounted (i.e.
 * when the user navigates back to the tab bar without disconnecting).
 *
 * Architecture:
 *   SessionManagerProvider renders a hidden <SessionNode key={id} /> for each
 *   live session.  Each SessionNode owns the useSshSession + useTerminal hooks
 *   and reports its state upward via a callback ref, so the context always has
 *   fresh state without prop-drilling.
 *
 * Update loop design:
 *   SessionNode's useEffect has explicit deps so it ONLY calls onUpdate when
 *   status / error / terminalState / cols / rows actually change.  Function
 *   refs (write, disconnect, resize) are forwarded through stable wrappers so
 *   they are never listed as deps and never trigger the effect.
 *
 *   handleUpdate additionally guards with a shallow-equality check so that
 *   setEntries is only called (and SessionManagerProvider only re-renders)
 *   when something genuinely changed — preventing the update→re-render→update
 *   infinite loop.
 *
 * Usage:
 *   const { create, destroy, get, sessions } = useSessionManager();
 *   const id = create(profile);           // starts SSH immediately
 *   router.push('/terminal/[id]', { id });
 *
 *   // In terminal screen:
 *   const session = useSession(id);       // → LiveSession | null
 *   <TerminalCanvas state={session.terminalState} onCellSize={session.resize} />
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, StyleSheet } from 'react-native';

import { useSshSession, type SshSessionStatus } from '@/hooks/use-ssh-session';
import { useTerminal } from '@/hooks/use-terminal';
import { useTerminalSize, DEFAULT_CELL_WIDTH, DEFAULT_CELL_HEIGHT } from '@/hooks/use-terminal-size';
import type { TerminalState } from '@/core/terminal/types';
import type { SshProfile } from '@/core/profiles/types';

// ── Public types ────────────────────────────────────────────────────────────

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
  /**
   * Called by the terminal screen's TerminalCanvas when the Skia font is
   * measured.  Feeds the correct cell dimensions back into the session so
   * the PTY resize is sent to the server.
   */
  resize: (cellWidth: number, cellHeight: number) => void;
}

interface SessionManagerContextValue {
  sessions: Map<string, LiveSession>;
  /** Start a new SSH session. Returns the session ID. */
  create: (profile: SshProfile) => string;
  /** Tear down a session and remove it from the map. */
  destroy: (id: string) => void;
  /** Retrieve a live session by ID. */
  get: (id: string) => LiveSession | null;
}

// ── Context ─────────────────────────────────────────────────────────────────

const SessionManagerContext = createContext<SessionManagerContextValue | null>(null);

export function useSessionManager(): SessionManagerContextValue {
  const ctx = useContext(SessionManagerContext);
  if (!ctx) throw new Error('useSessionManager must be inside <SessionManagerProvider>');
  return ctx;
}

// ── SessionNode — the invisible hook-runner ──────────────────────────────────

interface SessionNodeProps {
  id: string;
  profile: SshProfile;
  onUpdate: (id: string, update: Partial<LiveSession>) => void;
}

function SessionNode({ id, profile, onUpdate }: SessionNodeProps) {
  // Cell size driven by the terminal screen once the Skia font loads.
  // Until then we use defaults so the PTY starts with a reasonable size.
  const [cellSize, setCellSize] = useState({
    width: DEFAULT_CELL_WIDTH,
    height: DEFAULT_CELL_HEIGHT,
  });

  const { cols, rows } = useTerminalSize({
    cellWidth: cellSize.width,
    cellHeight: cellSize.height,
  });

  const { state, processBytes } = useTerminal({ cols, rows });

  const { status, error, write, disconnect } = useSshSession({
    host: profile.host,
    port: profile.port,
    username: profile.username,
    password: profile.password ?? '',
    cols,
    rows,
    onData: processBytes,
  });

  // ── Stable function wrappers via refs ──────────────────────────────────
  // write/disconnect come from useSshSession(useCallback([])) so they are
  // already stable, but we forward through refs so we never need to list
  // them as useEffect deps — avoiding spurious effect firings.

  const resizeFn = useCallback((cw: number, ch: number) => {
    setCellSize((prev) =>
      prev.width === cw && prev.height === ch ? prev : { width: cw, height: ch },
    );
  }, []);

  const writeRef     = useRef(write);
  const disconnectRef = useRef(disconnect);
  const resizeRef    = useRef(resizeFn);

  // Keep refs current on every render (no effect needed)
  writeRef.current     = write;
  disconnectRef.current = disconnect;
  resizeRef.current    = resizeFn;

  // Stable forwarders with empty deps — identity never changes
  const stableWrite = useCallback((data: string) => writeRef.current(data), []);
  const stableDisconnect = useCallback(() => disconnectRef.current(), []);
  const stableResize = useCallback((cw: number, ch: number) => resizeRef.current(cw, ch), []);

  // ── Push state changes up to the provider ──────────────────────────────
  // deps: only things that carry display-meaningful data.
  // stableWrite/stableDisconnect/stableResize are useCallback([]) — stable.
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
  }, [id, status, error, state, cols, rows, stableWrite, stableDisconnect, stableResize, onUpdate]);

  return null; // renders no UI
}

// ── Provider ─────────────────────────────────────────────────────────────────

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

  // When a SessionNode reports updated state, merge it into the entry.
  // Guard: only call setEntries (which triggers a re-render) if at least one
  // value actually changed.  Returning `prev` from the setter bails out with
  // no re-render — this prevents the update→render→update infinite loop.
  const handleUpdate = useCallback((id: string, update: Partial<LiveSession>) => {
    setEntries((prev) => {
      const entry = prev.get(id);
      if (!entry) return prev;

      const live = entry.liveData;
      const keys = Object.keys(update) as (keyof LiveSession)[];
      const changed = keys.some(
        (k) => (update as unknown as Record<string, unknown>)[k] !== (live as unknown as Record<string, unknown>)[k],
      );
      if (!changed) return prev; // Nothing changed — skip re-render

      const next = new Map(prev);
      next.set(id, { ...entry, liveData: { ...live, ...update } });
      return next;
    });
  }, []);

  const create = useCallback((profile: SshProfile): string => {
    const id = generateId();
    const placeholder: LiveSession = {
      id,
      profile,
      status: 'connecting',
      error: null,
      write: () => {},
      disconnect: () => {},
      terminalState: {
        grid: [],
        cursor: { row: 0, col: 0, visible: true, shape: 'block' },
        cols: 80,
        rows: 24,
        title: '',
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
        // Trigger disconnect before unmounting
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

  // Build context value
  const sessions = new Map(
    Array.from(entries.entries()).map(([id, e]) => [id, e.liveData]),
  );

  return (
    <SessionManagerContext.Provider value={{ sessions, create, destroy, get }}>
      {/* Invisible nodes — one per live session */}
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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});
