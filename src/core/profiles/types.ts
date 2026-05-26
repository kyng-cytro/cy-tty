export type AuthMethod = 'password' | 'key';

export interface SshProfile {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password?: string;
  privateKeyId?: string;
  lastConnected?: number;
  createdAt: number;
}
