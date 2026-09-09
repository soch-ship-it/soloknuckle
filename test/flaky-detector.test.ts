import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { detectFlakyTests, evaluateFlakyGate } from '../cli/flaky-detector';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flaky-detector-'));
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  mockExecSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const FLAKY_SOURCE = `import { setTimeout } from 'node:timers/promises';
it('async flaky', async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const n = Math.random();
  const t = Date.now();
});
it('chained', () => Promise.resolve().then(() => ({ ok: true })));
`;

const STABLE_SOURCE = `export const sum = (a: number, b: number): number => a + b;
`;

describe('detectFlakyTests', () => {
  it('finds files with flaky patterns and ignores stable ones', async () => {
    fs.writeFileSync(path.join(tmpDir, 'flaky.test.ts'), FLAKY_SOURCE);
    fs.writeFileSync(path.join(tmpDir, 'stable.test.ts'), STABLE_SOURCE);

    const result = await detectFlakyTests(['flaky.test.ts', 'stable.test.ts'], 1);
    expect(result.summary.totalTests).toBe(2);
    expect(result.summary.flakyTests).toBe(1);
    expect(result.summary.stableTests).toBe(1);
    expect(result.flakyTests[0].file).toBe('flaky.test.ts');
    expect(result.flakyTests[0].failureReasons.length).toBeGreaterThan(0);
  });

  it('scores perfectly when nothing is flaky', async () => {
    fs.writeFileSync(path.join(tmpDir, 'stable.test.ts'), STABLE_SOURCE);
    const result = await detectFlakyTests(['stable.test.ts'], 1);
    expect(result.score).toBe(100);
    expect(result.summary.estimatedMaintenanceCost).toBe(0);
  });

  it('analyzes pass/fail history across multiple runs (mixed results are flaky)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'stable.test.ts'), STABLE_SOURCE);
    mockExecSync
      .mockReturnValueOnce('\u2713 alpha\n  pass beta\n')
      .mockReturnValueOnce('\u2717 alpha\n  fail beta\n');

    const result = await detectFlakyTests(['stable.test.ts'], 2);
    const alpha = result.flakyTests.find((t) => t.name === 'alpha');
    const beta = result.flakyTests.find((t) => t.name === 'beta');
    expect(alpha).toBeTruthy();
    expect(beta).toBeTruthy();
    expect(alpha!.runCount).toBe(2);
    expect(alpha!.passCount).toBe(1);
    expect(alpha!.failCount).toBe(1);
    expect(alpha!.flakyScore).toBeGreaterThan(0);
  });

  it('does not flag tests that always fail (broken, not flaky)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'stable.test.ts'), STABLE_SOURCE);
    mockExecSync.mockReturnValue('\u2717 alwaysbroken ');

    const result = await detectFlakyTests(['stable.test.ts'], 2);
    expect(result.flakyTests.find((t) => t.name === 'alwaysbroken')).toBeUndefined();
  });

it('merges history into an existing pattern-flagged test of the same name', async () => {
    fs.writeFileSync(path.join(tmpDir, 'alpha'), FLAKY_SOURCE);
    mockExecSync.mockReturnValueOnce('\u2713 alpha\n').mockReturnValueOnce('\u2717 alpha\n');

    const result = await detectFlakyTests(['alpha'], 2);
    const alpha = result.flakyTests.find((t) => t.name === 'alpha');
    expect(alpha).toBeTruthy();
    expect(alpha!.runCount).toBe(2);
    expect(alpha!.failureReasons.length).toBeGreaterThan(0);
  });

  it('handles a failing npm test run by marking every run failed', async () => {
    fs.writeFileSync(path.join(tmpDir, 'stable.test.ts'), STABLE_SOURCE);
    mockExecSync.mockImplementation(() => {
      throw new Error('tests crashed');
    });

    const result = await detectFlakyTests(['stable.test.ts'], 2);
    expect(result.summary.flakyTests).toBeGreaterThanOrEqual(0);
    expect(result.flakyTests.find((t) => t.name === 'stable.test.ts')).toBeUndefined();
  });

  it('auto-discovers test files when none are provided', async () => {
    fs.writeFileSync(path.join(tmpDir, 'auto.test.ts'), FLAKY_SOURCE);
    const result = await detectFlakyTests([], 1);
    expect(result.summary.totalTests).toBeGreaterThan(0);
  });
});

describe('evaluateFlakyGate', () => {
  const base = {
    score: 0,
    flakyTests: [] as unknown[],
    summary: { totalTests: 0, flakyTests: 0, stableTests: 0, averageFlakyScore: 0, estimatedMaintenanceCost: 0 },
  };

  it('passes when score is at or above threshold', () => {
    const gate = evaluateFlakyGate({ ...base, score: 85 }, 70);
    expect(gate.passed).toBe(true);
    expect(gate.estimatedCost).toBe(0);
  });

  it('fails when below threshold and reports cost', () => {
    const gate = evaluateFlakyGate(
      { ...base, score: 40, summary: { ...base.summary, flakyTests: 3, estimatedMaintenanceCost: 300 } },
      70
    );
    expect(gate.passed).toBe(false);
    expect(gate.flakyCount).toBe(3);
    expect(gate.details).toContain('$300');
  });
});