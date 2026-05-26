/**
 * Network Scanner — discovers SSH servers on the local /24 subnet.
 *
 * Algorithm:
 *   1. Get the device's local IP via expo-network.
 *   2. Derive the /24 base (e.g. 192.168.1.0/24 → probe .1–.254).
 *   3. TCP-connect to port 22 with a 500 ms timeout in batches of 32.
 *   4. For each responsive host, grab the SSH identification banner
 *      (first line of data) and derive an OS guess from it.
 *   5. Results are returned incrementally via onFound callback.
 */

import TcpSocket from 'react-native-tcp-socket';
import * as Network from 'expo-network';

// ── Types ────────────────────────────────────────────────────────────────────

export type GuessedOs = 'linux' | 'macos' | 'windows' | 'unknown';

export interface DiscoveredHost {
  ip: string;
  hostname?: string;
  sshBanner?: string;   // e.g. "SSH-2.0-OpenSSH_9.1"
  guessedOs: GuessedOs;
  respondedAt: number;
}

// ── OS detection from SSH banner ─────────────────────────────────────────────

function guessOsFromBanner(banner: string): GuessedOs {
  const b = banner.toLowerCase();
  if (b.includes('windows')) return 'windows';
  if (b.includes('dropbear')) return 'linux';       // commonly embedded Linux
  if (b.includes('libssh') && !b.includes('openssh')) return 'unknown';
  if (b.includes('openssh')) {
    // macOS ships with a version-stamped OpenSSH; heuristic: macOS uses
    // "OpenSSH_X.Xp1" naming while Linux distros don't add the 'p' suffix
    // consistently — not reliable enough alone, so we default to linux.
    return 'linux';
  }
  return 'unknown';
}

// ── TCP probe helper ─────────────────────────────────────────────────────────

const PROBE_TIMEOUT_MS = 500;
const BANNER_TIMEOUT_MS = 800;

/**
 * Attempt a TCP connection to ip:22.
 * Returns the SSH banner string if the port is open, or null otherwise.
 */
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
        // Connection established — wait up to BANNER_TIMEOUT_MS for the banner
        setTimeout(() => settle(banner || null), BANNER_TIMEOUT_MS);
      },
    );

    socket.on('data', (data: unknown) => {
      if (typeof data === 'string') {
        banner += data;
      } else if (data instanceof Uint8Array) {
        banner += new TextDecoder().decode(data);
      }
      // SSH banner is the first line
      if (banner.includes('\n')) {
        settle(banner.split('\n')[0]!.trim());
      }
    });

    socket.on('error', () => settle(null));
    socket.on('timeout', () => settle(null));

    // Hard timeout regardless
    setTimeout(() => settle(null), PROBE_TIMEOUT_MS + BANNER_TIMEOUT_MS + 100);
  });
}

// ── Subnet enumeration ────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 32;

/**
 * Scan the local /24 subnet for hosts with port 22 open.
 *
 * @param onProgress  Called after each batch with (scanned, total).
 * @param onFound     Called immediately when a host is discovered.
 * @returns           Complete list of discovered hosts.
 */
export async function scanSubnet(
  onProgress?: (scanned: number, total: number) => void,
  onFound?: (host: DiscoveredHost) => void,
): Promise<DiscoveredHost[]> {
  // Determine local IP
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

  // Process in batches to limit concurrency
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
