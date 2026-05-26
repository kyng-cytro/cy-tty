import TcpSocket from 'react-native-tcp-socket';
import * as Network from 'expo-network';

export type GuessedOs = 'linux' | 'macos' | 'windows' | 'unknown';

export interface DiscoveredHost {
  ip: string;
  hostname?: string;
  sshBanner?: string;
  guessedOs: GuessedOs;
  respondedAt: number;
}

function guessOsFromBanner(banner: string): GuessedOs {
  const b = banner.toLowerCase();
  if (b.includes('windows')) return 'windows';
  if (b.includes('dropbear')) return 'linux';
  if (b.includes('libssh') && !b.includes('openssh')) return 'unknown';
  if (b.includes('openssh')) return 'linux';
  return 'unknown';
}

const PROBE_TIMEOUT_MS = 500;
const BANNER_TIMEOUT_MS = 800;

function probeHost(ip: string): Promise<string | null> {
  return new Promise((resolve) => {
    let banner = '';
    let settled = false;

    const settle = (result: string | null) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };

    const socket = TcpSocket.createConnection(
      { host: ip, port: 22, connectTimeout: PROBE_TIMEOUT_MS },
      () => {
        setTimeout(() => settle(banner || null), BANNER_TIMEOUT_MS);
      },
    );

    socket.on('data', (data: unknown) => {
      if (typeof data === 'string') {
        banner += data;
      } else if (data instanceof Uint8Array) {
        banner += new TextDecoder().decode(data);
      }
      if (banner.includes('\n')) {
        settle(banner.split('\n')[0]!.trim());
      }
    });

    socket.on('error', () => settle(null));
    socket.on('timeout', () => settle(null));

    setTimeout(() => settle(null), PROBE_TIMEOUT_MS + BANNER_TIMEOUT_MS + 100);
  });
}

function deriveSubnetBase(localIp: string): string | null {
  const parts = localIp.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function subnetIps(base: string): string[] {
  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) {
    ips.push(`${base}.${i}`);
  }
  return ips;
}

const BATCH_SIZE = 32;

export async function scanSubnet(
  onProgress?: (scanned: number, total: number) => void,
  onFound?: (host: DiscoveredHost) => void,
): Promise<DiscoveredHost[]> {
  let localIp: string;
  try {
    localIp = await Network.getIpAddressAsync();
  } catch {
    return [];
  }

  const base = deriveSubnetBase(localIp);
  if (!base) return [];

  const ips = subnetIps(base).filter((ip) => ip !== localIp);
  const results: DiscoveredHost[] = [];
  let scanned = 0;

  for (let i = 0; i < ips.length; i += BATCH_SIZE) {
    const batch = ips.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (ip) => {
        const banner = await probeHost(ip);
        return { ip, banner };
      }),
    );

    for (const { ip, banner } of batchResults) {
      if (banner !== null) {
        const host: DiscoveredHost = {
          ip,
          sshBanner: banner.startsWith('SSH-') ? banner : undefined,
          guessedOs: guessOsFromBanner(banner),
          respondedAt: Date.now(),
        };
        results.push(host);
        onFound?.(host);
      }
    }

    scanned += batch.length;
    onProgress?.(scanned, ips.length);
  }

  return results;
}
