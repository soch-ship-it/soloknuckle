import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('e2e: soloknuckle firewall (intercept)', () => {
  const dummyDir = path.join(__dirname, 'dummy-repo');

  beforeAll(() => {
    if (!fs.existsSync(dummyDir)) {
      fs.mkdirSync(dummyDir);
    }
    fs.writeFileSync(path.join(dummyDir, 'package.json'), JSON.stringify({
      name: "dummy",
      scripts: {
        lint: "exit 1",
        test: "exit 0"
      }
    }));
  });

  afterAll(() => {
    if (fs.existsSync(dummyDir)) {
      fs.rmSync(dummyDir, { recursive: true, force: true });
    }
  });

  it('should block destructive commands via intercept', () => {
    try {
      execSync('npx --no-install tsx ../../cli/index.ts intercept "rm -rf /"', { cwd: dummyDir, stdio: 'pipe' });
      // Should not reach here
      expect(true).toBe(false);
    } catch (e: unknown) {
      const err = e as { status?: number };
      expect(err.status).toBe(1);
    }
  }, 20000);

  it('should allow safe commands via intercept', () => {
    const out = execSync('npx --no-install tsx ../../cli/index.ts intercept "npm run build"', { cwd: dummyDir, stdio: 'pipe' });
    expect(out.toString()).toContain('Allowed');
  }, 20000);
});
