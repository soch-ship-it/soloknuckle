import { execSync } from 'child_process';

export const KEYCHAIN_SERVICE = 'soloknuckle';
export const KEYCHAIN_ACCOUNT = 'llm';

// Only characters that are safe inside a double-quoted shell argument and
// cover every API-key charset we have ever seen. Rejects quotes, backticks,
// whitespace, etc. so secrets can never break out of the `security -w` arg.
const SAFE_VALUE_CHARS = /^[A-Za-z0-9._+\/=:-]+$/;

export function isMacKeychainAvailable(): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    execSync('security list-keychains', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stores a secret in the macOS Keychain. Returns false when the platform does
 * not support it or the value contains unsafe characters (caller then falls
 * back to a 0600 config file).
 */
export function saveSecret(service: string, account: string, value: string): boolean {
  if (!isMacKeychainAvailable() || !SAFE_VALUE_CHARS.test(value)) return false;
  try {
    execSync(`security add-generic-password -U -a "${account}" -s "${service}" -w "${value}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function loadSecret(service: string, account: string): string | null {
  if (!isMacKeychainAvailable()) return null;
  try {
    return execSync(
      `security find-generic-password -w -a "${account}" -s "${service}"`,
      { stdio: ['ignore', 'pipe', 'ignore'] },
    ).toString().trim();
  } catch {
    return null;
  }
}

export function deleteSecret(service: string, account: string): boolean {
  if (!isMacKeychainAvailable()) return false;
  try {
    execSync(`security delete-generic-password -a "${account}" -s "${service}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}