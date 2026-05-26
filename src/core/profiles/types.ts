/**
 * Core SSH profile types.
 *
 * A profile is a named connection target that can be saved on-device.
 * Sensitive fields (password, key reference) are kept in SecureStore;
 * the rest is metadata stored as JSON.
 */

export type AuthMethod = 'password' | 'key';

export interface SshProfile {
  /** Unique identifier (UUID v4). */
  id: string;
  /** Human-readable display name (e.g. "prod server", defaults to user@host). */
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  /**
   * Plaintext password — stored encrypted in SecureStore under key
   * `cy_tty_pw_<id>`.  Absent when authMethod is 'key'.
   */
  password?: string;
  /**
   * ID of an entry in KeyStore (the encrypted .enc file).
   * Absent when authMethod is 'password'.
   */
  privateKeyId?: string;
  /** Unix timestamp (ms) of the last successful connection. */
  lastConnected?: number;
  /** Unix timestamp (ms) of profile creation. */
  createdAt: number;
}
