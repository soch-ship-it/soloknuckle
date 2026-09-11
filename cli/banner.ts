import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

let cachedBanner: string | null = null;

/**
 * The ASCII wordmark, read from the assets folder that ships with the
 * package. Works in both layouts:
 *  - installed/published: dist/cli/* -> ../../assets
 *  - running from source (tsx / vitest): cli/* -> ../assets
 * Empty string when the asset is unavailable.
 */
export function getBanner(): string {
  if (cachedBanner !== null) return cachedBanner;
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'logo.ascii.txt'),
    path.join(__dirname, '..', 'assets', 'logo.ascii.txt'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        cachedBanner = fs.readFileSync(p, 'utf8').trimEnd();
        break;
      }
    } catch {
      // try the next candidate
    }
  }
  if (cachedBanner === null) cachedBanner = '';
  return cachedBanner;
}

/**
 * Banners are for humans at an interactive terminal. Never print when:
 *  - output is piped (not a TTY) — keeps agent/CI logs clean
 *  - CI is set — bots don't appreciate ASCII art
 *  - NO_COLOR is set — respects the standard no-frills convention
 *  - SOLOKNUCKLE_NO_BANNER is set — explicit opt-out
 */
export function bannerAllowed(): boolean {
  if (process.env.SOLOKNUCKLE_NO_BANNER) return false;
  if (process.env.CI) return false;
  if (process.env.NO_COLOR) return false;
  return process.stdout.isTTY === true;
}

/** Prints the ASCII wordmark banner. No-op unless bannerAllowed() passes. */
export function printBanner(): void {
  if (!bannerAllowed()) return;
  const banner = getBanner();
  if (!banner) return;
  // Skip on terminals too narrow to hold the 90-column wordmark unwrapped.
  const cols = process.stdout.columns;
  if (typeof cols === 'number' && cols < 92) return;
  console.log(banner.split('\n').map(l => chalk.hex('#8fa0b3')(l)).join('\n'));
  console.log();
}
