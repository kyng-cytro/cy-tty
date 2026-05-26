export interface SshConnectOptions {
  host: string;
  port?: number;
  username: string;
  password: string;
}

export interface SshDataEvent {
  sessionId: string;
  data: string;
}

export interface SshErrorEvent {
  sessionId: string;
  message: string;
}

export interface SshCloseEvent {
  sessionId: string;
}

export interface SshModuleEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  onData:  (event: SshDataEvent)  => void;
  onError: (event: SshErrorEvent) => void;
  onClose: (event: SshCloseEvent) => void;
}
