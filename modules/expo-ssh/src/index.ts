import { EventEmitter, NativeModule, requireNativeModule } from 'expo';

import type {
  SshConnectOptions,
  SshDataEvent,
  SshErrorEvent,
  SshModuleEvents,
} from './ExpoSshModule.types';

// ── Native module declaration ──────────────────────────────────────────────

declare class ExpoSshModule extends NativeModule<SshModuleEvents> {
  /**
   * Establish an SSH connection and open an interactive PTY shell.
   * Resolves once the shell is ready; rejects on connect/auth failure.
   */
  connect(host: string, port: number, username: string, password: string): Promise<void>;

  /** Close the SSH session and channel. Safe to call even if not connected. */
  disconnect(): Promise<void>;

  /**
   * Send raw input to the shell.
   * `data` must be an ISO-8859-1 string (all chars in [0, 255]).
   */
  write(data: string): Promise<void>;

  /** Notify the remote PTY about a terminal resize. */
  resize(cols: number, rows: number): Promise<void>;
}

const nativeModule = requireNativeModule<ExpoSshModule>('ExpoSsh');

// ── Typed event emitter ────────────────────────────────────────────────────

const emitter = new EventEmitter<SshModuleEvents>(nativeModule);

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Connect to an SSH server and open an interactive shell.
 *
 * ```ts
 * await SshClient.connect({ host: '192.168.1.1', username: 'admin', password: '...' });
 * SshClient.onData((e) => vtParser.processBytes(e.data));
 * await SshClient.write('ls -la\n');
 * ```
 */
export const SshClient = {
  connect({ host, port = 22, username, password }: SshConnectOptions): Promise<void> {
    return nativeModule.connect(host, port, username, password);
  },

  disconnect(): Promise<void> {
    return nativeModule.disconnect();
  },

  write(data: string): Promise<void> {
    return nativeModule.write(data);
  },

  resize(cols: number, rows: number): Promise<void> {
    return nativeModule.resize(cols, rows);
  },

  onData(listener: (event: SshDataEvent) => void) {
    return emitter.addListener('onData', listener);
  },

  onError(listener: (event: SshErrorEvent) => void) {
    return emitter.addListener('onError', listener);
  },

  onClose(listener: () => void) {
    return emitter.addListener('onClose', listener);
  },
} as const;

// Re-export types for consumers
export type { SshConnectOptions, SshDataEvent, SshErrorEvent, SshModuleEvents };
