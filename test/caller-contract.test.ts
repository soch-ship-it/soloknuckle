import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateCallerContracts, evaluateContractGate } from '../cli/caller-contract';

const SOURCE = `export function add(a: number, b: number): number {
  return a + b;
}
export function greet(name: string, opts?: object): string {
  return String(name);
}
export function isActive(flag: boolean): boolean {
  return flag;
}
`;

const TEST = `it('adds numbers', () => {
  add(1, 'two');
  add(1);
  add(1, 2, 3);
  greet('alice');
  greet(42);
  isActive(true);
  isActive('yes');
});
`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caller-contract-'));
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'api.ts'), SOURCE);
  fs.writeFileSync(path.join(tmpDir, 'test', 'api.test.ts'), TEST);
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('validateCallerContracts', () => {
  it('detects missing, extra and type-mismatched parameters', async () => {
    const result = await validateCallerContracts(['test/api.test.ts'], ['src/api.ts']);
    expect(result.summary.totalFunctions).toBeGreaterThanOrEqual(3);
    expect(result.summary.functionsWithViolations).toBe(1);
    expect(result.summary.signatureMismatches).toBe(0);
    expect(result.summary.missingParameters).toBe(1);
    expect(result.summary.extraParameters).toBe(1);
    expect(result.summary.typeMismatches).toBeGreaterThanOrEqual(3);

    expect(result.violations.some((v) => v.type === 'missing-parameter' && v.function === 'add')).toBe(true);
    expect(result.violations.some((v) => v.type === 'extra-parameter' && v.function === 'add')).toBe(true);
    expect(result.violations.some((v) => v.type === 'type-mismatch' && v.function === 'greet')).toBe(true);
    expect(result.violations.some((v) => v.type === 'type-mismatch' && v.function === 'isActive')).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  it('passes cleanly when calls match the contract', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test', 'ok.test.ts'), `it('x', () => {\n  add(1, 2);\n  greet('a');\n  isActive(false);\n});\n`);
    const result = await validateCallerContracts(['test/ok.test.ts'], ['src/api.ts']);
    expect(result.violations).toEqual([]);
    expect(result.score).toBe(100);
  });

  it('detects return-type mismatches via assertion literals', async () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'rt.ts'), `export function double(n: number): number {\n  return n * 2;\n}\nexport function ping(): string {\n  return 'pong';\n}\n`);
    fs.writeFileSync(path.join(tmpDir, 'test', 'rt.test.ts'), "it('x', () => {\n  expect(double(2)).toBe('4');\n  expect(ping()).toBeNull();\n  expect(double(2)).toBe(4);\n  expect(ping()).toBe('pong');\n});\n");

    const result = await validateCallerContracts(['test/rt.test.ts'], ['src/rt.ts']);
    expect(result.summary.returnTypeMismatches).toBe(2);
    expect(result.violations.some((v) => v.type === 'return-type-mismatch' && v.function === 'double')).toBe(true);
    expect(result.violations.some((v) => v.type === 'return-type-mismatch' && v.function === 'ping')).toBe(true);
  });

  it('auto-discovers source and test files when none are provided', async () => {
    const result = await validateCallerContracts();
    expect(result.summary.totalFunctions).toBeGreaterThan(0);
    expect(result.summary.functionsWithViolations).toBeGreaterThanOrEqual(1);
  });

  it('skips projects without source files', async () => {
    fs.rmSync(path.join(tmpDir, 'src'), { recursive: true, force: true });
    const result = await validateCallerContracts(['test/api.test.ts'], ['src/api.ts']);
    expect(result.summary.totalFunctions).toBe(0);
    expect(result.score).toBe(100);
  });
});

describe('evaluateContractGate', () => {
  const base = {
    score: 0,
    violations: [] as unknown[],
    summary: { totalFunctions: 0, functionsWithViolations: 0, signatureMismatches: 0, missingParameters: 0, extraParameters: 0, typeMismatches: 0, returnTypeMismatches: 0 },
  };

  it('passes when score is above threshold', () => {
    const gate = evaluateContractGate({ ...base, score: 95 }, 70);
    expect(gate.passed).toBe(true);
  });

  it('fails when below threshold and counts violations', () => {
    const gate = evaluateContractGate({ ...base, score: 50, violations: [{}, {}] }, 70);
    expect(gate.passed).toBe(false);
    expect(gate.violationCount).toBe(2);
    expect(gate.details).toContain('failed');
  });
});