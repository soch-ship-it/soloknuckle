import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const ENV_KEYS = ['CI', 'NO_COLOR', 'SOLOKNUCKLE_NO_BANNER'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  delete (process.stdout as { isTTY?: boolean }).isTTY;
  delete (process.stdout as { columns?: number }).columns;
});

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

/** Shape process.stdout for a given terminal scenario. */
function setStdout(tty: boolean | undefined, columns?: number): void {
  Object.defineProperty(process.stdout, 'isTTY', { value: tty, configurable: true });
  Object.defineProperty(process.stdout, 'columns', { value: columns, configurable: true });
}

import { bannerAllowed, getBanner, printBanner } from '../cli/banner';

describe('bannerAllowed', () => {
  it('allows the banner on an interactive terminal', () => {
    setStdout(true, 120);
    expect(bannerAllowed()).toBe(true);
  });

  it('suppresses the banner when output is piped (not a TTY)', () => {
    setStdout(undefined);
    expect(bannerAllowed()).toBe(false);
  });

  it('suppresses the banner under CI even with a TTY', () => {
    process.env.CI = '1';
    setStdout(true, 120);
    expect(bannerAllowed()).toBe(false);
  });

  it('suppresses the banner when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';
    setStdout(true, 120);
    expect(bannerAllowed()).toBe(false);
  });

  it('suppresses the banner when SOLOKNUCKLE_NO_BANNER is set', () => {
    process.env.SOLOKNUCKLE_NO_BANNER = '1';
    setStdout(true, 120);
    expect(bannerAllowed()).toBe(false);
  });

  it('treats an empty CI value as not running in CI', () => {
    process.env.CI = '';
    setStdout(true, 120);
    expect(bannerAllowed()).toBe(true);
  });
});

describe('getBanner', () => {
  it('loads the ascii wordmark from the shipped assets', () => {
    const banner = getBanner();
    expect(banner.length).toBeGreaterThan(0);
    expect(banner).toMatch(/█/);
    expect(banner.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('returns an empty string when the banner asset is missing', async () => {
    vi.resetModules();
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return { default: { ...actual, existsSync: () => false } };
    });
    try {
      const fresh = await import('../cli/banner');
      expect(fresh.getBanner()).toBe('');
    } finally {
      vi.doUnmock('fs');
      vi.resetModules();
    }
  });
});

describe('printBanner', () => {
  it('prints the wordmark on a wide interactive terminal', () => {
    setStdout(true, 120);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      printBanner();
      const printed = spy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(printed).toMatch(/█/);
    } finally {
      spy.mockRestore();
    }
  });

  it('prints nothing on terminals narrower than the wordmark', () => {
    setStdout(true, 80);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      printBanner();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('prints nothing when output is piped', () => {
    setStdout(undefined);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      printBanner();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('prints nothing under CI', () => {
    process.env.CI = '1';
    setStdout(true, 120);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      printBanner();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('prints nothing when the banner asset is missing', async () => {
    vi.resetModules();
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return { default: { ...actual, existsSync: () => false } };
    });
    try {
      const fresh = await import('../cli/banner');
      setStdout(true, 120);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        fresh.printBanner();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    } finally {
      vi.doUnmock('fs');
      vi.resetModules();
    }
  });
});
