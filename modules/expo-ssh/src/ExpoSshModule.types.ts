// ── Connection options ─────────────────────────────────────────────────────

export interface SshConnectOptions {
  host: string;
  port?: number; // default 22
  username: string;
  password: string;
}

// ── Event payloads ─────────────────────────────────────────────────────────

/**
 * Raw terminal bytes from the remote host, encoded as an ISO-8859-1 string
 * so that every byte value 0-255 maps to exactly one character.
 * Pass this directly to the VT parser (expo-ghostty-vt).
 */
export interface SshDataEvent {
  data: string;
}

export interface SshErrorEvent {
  message: string;
}

// onClose carries no payload

// ── Event map (used by NativeModule generic) ──────────────────────────────

export interface SshModuleEvents {
  // Index signature required by Expo's EventsMap constraint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  onData: (event: SshDataEvent) => void;
  onError: (event: SshErrorEvent) => void;
  onClose: () => void;
}
