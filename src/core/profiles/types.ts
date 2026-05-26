export type AuthMethod = 'none' | 'key' | 'password';

export interface SshProfile {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password?: string;
  privateKeyId?: string;
  keyPassphrase?: string;
  locked?: boolean;
  lastConnected?: number;
  createdAt: number;
}
