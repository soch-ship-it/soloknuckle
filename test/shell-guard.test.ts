import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_HOME = path.join(os.tmpdir(), 'soloknuckle-test-shell-guard');

describe('shell-guard', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_HOME, { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);
  });

  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('generateShellGuard', () => {
    it('generates wrappers for all guarded commands', async () => {
      const { generateShellGuard } = await import('../cli/shell-guard');
      const guard = generateShellGuard('zsh');
      expect(guard).toContain('_soloknuckle_guard');
      for (const cmd of ['rm', 'git', 'chmod', 'dd', 'mkfs', 'curl', 'wget']) {
        expect(guard).toContain(`${cmd}() { _soloknuckle_guard ${cmd} "$@"; }`);
      }
      expect(guard).toContain('soloknuckle intercept');
    });

    it('marks the guard block with begin/end markers', async () => {
      const { generateShellGuard } = await import('../cli/shell-guard');
      const guard = generateShellGuard('bash');
      expect(guard.startsWith('# >>> soloknuckle guard')).toBe(true);
      expect(guard.trim().endsWith('# <<< soloknuckle guard')).toBe(true);
    });
  });

  describe('installShellGuard', () => {
    it('appends the guard to the rc file', async () => {
      const { installShellGuard } = await import('../cli/shell-guard');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      installShellGuard({ shell: 'zsh' });
      const rc = path.join(TEST_HOME, '.zshrc');
      expect(fs.existsSync(rc)).toBe(true);
      const content = fs.readFileSync(rc, 'utf-8');
      expect(content).toContain('# >>> soloknuckle guard');
      expect(content).toContain('git() { _soloknuckle_guard git "$@"; }');
      consoleSpy.mockRestore();
    });

    it('is idempotent and does not double-install', async () => {
      const { installShellGuard } = await import('../cli/shell-guard');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      installShellGuard({ shell: 'zsh' });
      const rc = path.join(TEST_HOME, '.zshrc');
      const before = fs.readFileSync(rc, 'utf-8');
      installShellGuard({ shell: 'zsh' });
      const after = fs.readFileSync(rc, 'utf-8');
      expect(after).toBe(before);
      expect(after.match(/# >>> soloknuckle guard/g)).toHaveLength(1);
      consoleSpy.mockRestore();
    });

    it('removes the guard block when --remove is set', async () => {
      const { installShellGuard } = await import('../cli/shell-guard');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      installShellGuard({ shell: 'zsh' });
      installShellGuard({ shell: 'zsh', remove: true });
      const rc = path.join(TEST_HOME, '.zshrc');
      const content = fs.readFileSync(rc, 'utf-8');
      expect(content).not.toContain('# >>> soloknuckle guard');
      consoleSpy.mockRestore();
    });
  });

  describe('detectShell', () => {
    it('detects zsh from SHELL env', async () => {
      const { detectShell } = await import('../cli/shell-guard');
      process.env.SHELL = '/bin/zsh';
      expect(detectShell()).toBe('zsh');
    });

    it('defaults to bash when SHELL is unknown', async () => {
      const { detectShell } = await import('../cli/shell-guard');
      process.env.SHELL = '/bin/fish';
      expect(detectShell()).toBe('bash');
    });
  });
});