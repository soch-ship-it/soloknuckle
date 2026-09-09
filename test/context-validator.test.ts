import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateTestContext, evaluateContextGate } from '../cli/context-validator';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-validator-'));
  fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTestFile(name: string, content: string) {
  fs.writeFileSync(path.join(tmpDir, 'tests', name), content);
}

describe('validateTestContext', () => {
  it('reports a clean file as passing (mocks + assertions present)', async () => {
    writeTestFile(
      'clean.test.ts',
      `vi.mock('../db');
it('works', () => {
  expect(1).toBe(1);
});
afterEach(() => { cleanup(); });
`
    );
    const result = await validateTestContext(['tests/clean.test.ts']);
    expect(result.score).toBe(100);
    expect(result.summary.totalTests).toBe(1);
    expect(result.summary.testsWithContextIssues).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it('flags real dependencies, missing mocks, missing assertions and no cleanup', async () => {
    writeTestFile(
      'bad.test.ts',
      `const pool = new Pool({ connectionString: 'postgres://localhost:5432/db' });
`
    );
    const result = await validateTestContext(['tests/bad.test.ts']);
    expect(result.summary.realDependencies).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.type === 'missing-mock')).toBe(true);
    expect(result.issues.some((i) => i.type === 'no-assertion')).toBe(true);
    expect(result.issues.some((i) => i.type === 'no-cleanup')).toBe(true);
    expect(result.issues.some((i) => i.type === 'hardcoded-value')).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  it('skips comment-only lines when looking for signals', async () => {
    writeTestFile(
      'commented.test.ts',
      `// expect(1).toBe(1);
// new Pool();
`
    );
    const result = await validateTestContext(['tests/commented.test.ts']);
    expect(result.issues.some((i) => i.type === 'no-assertion')).toBe(true);
    expect(result.issues.some((i) => i.type === 'real-dependency')).toBe(false);
  });

  it('skips files that do not exist', async () => {
    const result = await validateTestContext(['tests/ghost.test.ts']);
    expect(result.summary.totalTests).toBe(0);
    expect(result.score).toBe(100);
  });

  it('auto-discovers test files when none are provided', async () => {
    writeTestFile('auto.test.ts', 'const x = 1;');
    const result = await validateTestContext();
    expect(result.summary.totalTests).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.type === 'no-assertion')).toBe(true);
  });
});

describe('evaluateContextGate', () => {
  const base = {
    score: 0,
    issues: [] as { type: string }[],
    summary: {
      totalTests: 0,
      testsWithContextIssues: 0,
      missingMocks: 0,
      realDependencies: 0,
      noAssertions: 0,
      noCleanup: 0,
    },
  };

  it('passes when score is above threshold', () => {
    const gate = evaluateContextGate({ ...base, score: 90 }, 70);
    expect(gate.passed).toBe(true);
    expect(gate.details).toContain('passed');
  });

  it('fails when score is below threshold', () => {
    const gate = evaluateContextGate({ ...base, score: 40, issues: [{ type: 'no-assertion' }, { type: 'real-dependency' }] }, 70);
    expect(gate.passed).toBe(false);
    expect(gate.issueCount).toBe(2);
    expect(gate.details).toContain('failed');
  });
});