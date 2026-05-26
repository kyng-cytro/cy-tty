import { EventEmitter, NativeModule, requireNativeModule } from 'expo';

import type {
  SshCloseEvent,
  SshConnectOptions,
  SshDataEvent,
  SshErrorEvent,
  SshModuleEvents,
} from './ExpoSshModule.types';

declare class ExpoSshModule extends NativeModule<SshModuleEvents> {
  connect(sessionId: string, host: string, port: number, username: string, password: string): Promise<void>;
  connectWithKey(sessionId: string, host: string, port: number, username: string, privateKeyPem: string, passphrase: string): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
}

const nativeModule = requireNativeModule<ExpoSshModule>('ExpoSsh');
const emitter = new EventEmitter<SshModuleEvents>(nativeModule);

export const SshClient = {
  connect(sessionId: string, { host, port = 22, username, password }: SshConnectOptions): Promise<void> {
    return nativeModule.connect(sessionId, host, port, username, password);
  },

  connectWithKey(sessionId: string, host: string, port = 22, username: string, privateKeyPem: string, passphrase = ''): Promise<void> {
    return nativeModule.connectWithKey(sessionId, host, port, username, privateKeyPem, passphrase);
  },

  disconnect(sessionId: string): Promise<void> {
    return nativeModule.disconnect(sessionId);
  },

  write(sessionId: string, data: string): Promise<void> {
    return nativeModule.write(sessionId, data);
  },

  resize(sessionId: string, cols: number, rows: number): Promise<void> {
    return nativeModule.resize(sessionId, cols, rows);
  },

  onData(listener: (event: SshDataEvent) => void) {
    return emitter.addListener('onData', listener);
  },

  onError(listener: (event: SshErrorEvent) => void) {
    return emitter.addListener('onError', listener);
  },

  onClose(listener: (event: SshCloseEvent) => void) {
    return emitter.addListener('onClose', listener);
  },
} as const;

export type { SshCloseEvent, SshConnectOptions, SshDataEvent, SshErrorEvent, SshModuleEvents };
