import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { runMutationTesting, evaluateMutationGate } from '../cli/mutation';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

const SOURCE = `export function add(a: number, b: number): number {
  if (a > 0 && b < 10) {
    return a + b;
  }
  return 0;
}
export function flip(flag: boolean): boolean {
  return !flag;
}
`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-'));
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'cli'), { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  mockExecSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runMutationTesting', () => {
  it('marks mutations as survived when tests keep passing', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.ts'), SOURCE);
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
    mockExecSync.mockReturnValue('1 passed');

    const result = await runMutationTesting(['src/sample.ts'], 5);
    expect(result.totalMutations).toBeGreaterThan(0);
    expect(result.totalMutations).toBeLessThanOrEqual(5);
    expect(result.killedMutations).toBe(0);
    expect(result.score).toBe(0);
    expect(result.survivorDetails.length).toBe(result.totalMutations);
  });

  it('marks mutations as killed when tests fail', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.ts'), SOURCE);
    mockExecSync.mockImplementation(() => {
      throw new Error('test failed after mutation');
    });

    const result = await runMutationTesting(['src/sample.ts'], 5);
    expect(result.killedMutations).toBe(result.totalMutations);
    expect(result.score).toBe(100);
    expect(result.survivorDetails).toEqual([]);
  });

  it('skips to a perfect score when max mutations per file is zero', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.ts'), SOURCE);
    const result = await runMutationTesting(['src/sample.ts'], 0);
    expect(result.totalMutations).toBe(0);
    expect(result.score).toBe(100);
    expect(result.results).toEqual([]);
  });

  it('reports missing package.json as a killed mutation', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.ts'), SOURCE);
    const result = await runMutationTesting(['src/sample.ts'], 1);
    expect(result.killedMutations).toBe(result.totalMutations);
    expect(result.results[0]?.testOutput).toContain('package.json');
  });

  it('reports a package without a test script as a killed mutation', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.ts'), SOURCE);
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'no-scripts' }));
    const result = await runMutationTesting(['src/sample.ts'], 1);
    expect(result.results[0]?.testOutput).toContain('No test script');
  });

  it('auto-discovers src and cli files when none are provided', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.ts'), SOURCE);
    fs.writeFileSync(path.join(tmpDir, 'cli', 'tool.ts'), 'export const tool = 1;');
    fs.writeFileSync(path.join(tmpDir, 'src', 'not-a-source.txt'), 'plain text');
    mockExecSync.mockImplementation(() => {
      throw new Error('test failed after mutation');
    });

    const result = await runMutationTesting([], 1);
    expect(result.totalMutations).toBeGreaterThan(0);
  });

  it('generates string mutations for stringly-typed source', async () => {
    const STRINGY = `export function status(code: string): string {
  if (code === 'active') {
    return 'live';
  }
  return '';
}
`;
    fs.writeFileSync(path.join(tmpDir, 'src', 'stringy.ts'), STRINGY);
    mockExecSync.mockReturnValue('1 passed');

    const result = await runMutationTesting(['src/stringy.ts'], 20);
    const stringMutations = result.results.filter(r => r.mutation.type === 'string');
    expect(stringMutations.length).toBeGreaterThan(0);
    const mutatedValues = stringMutations.map(r => r.mutation.mutated);
    // 'active' → tampered or emptied variants must be present
    expect(mutatedValues.some(m => m.includes("''") || m.includes('""'))).toBe(true);
  });
});

describe('evaluateMutationGate', () => {
  const base = {
    totalMutations: 0,
    killedMutations: 0,
    survivedMutations: 0,
    score: 0,
    results: [] as unknown[],
    survivorDetails: [],
  };

  it('passes when the kill rate is above threshold', () => {
    const gate = evaluateMutationGate({ ...base, score: 90, survivedMutations: 2 }, 70);
    expect(gate.passed).toBe(true);
    expect(gate.survivorCount).toBe(2);
  });

  it('fails when the kill rate is below threshold', () => {
    const gate = evaluateMutationGate({ ...base, score: 40, survivedMutations: 6 }, 70);
    expect(gate.passed).toBe(false);
    expect(gate.details).toContain('6');
  });
});