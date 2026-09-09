import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { findFiles } from '../cli/path-utils';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-utils-'));
  fs.mkdirSync(path.join(tmpDir, 'src', 'nested'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'test', 'sub'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'cli'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'src', 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'export const a = 1;');
  fs.writeFileSync(path.join(tmpDir, 'src', 'nested', 'b.ts'), 'export const b = 2;');
  fs.writeFileSync(path.join(tmpDir, 'src', '.hidden.ts'), 'export const h = 3;');
  fs.writeFileSync(path.join(tmpDir, 'src', 'node_modules', 'dep', 'm.ts'), 'export const m = 4;');
  fs.writeFileSync(path.join(tmpDir, 'test', 'a.test.ts'), 'it("a", () => expect(1).toBe(1));');
  fs.writeFileSync(path.join(tmpDir, 'test', 'sub', 'c.spec.ts'), 'it("c", () => expect(2).toBe(2));');
  fs.writeFileSync(path.join(tmpDir, 'cli', 'x.js'), 'module.exports = 1;');
  fs.writeFileSync(path.join(tmpDir, 'cli', 'y.ts'), 'export const y = 5;');
  fs.writeFileSync(path.join(tmpDir, 'root.ts'), 'export const root = 6;');
  fs.writeFileSync(path.join(tmpDir, 'README.md'), 'readme');
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
});

afterAll(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('findFiles', () => {
  it('walks a directory pattern recursively', () => {
    const files = findFiles(['src/**/*.ts']);
    expect(files).toContain('src/a.ts');
    expect(files).toContain('src/nested/b.ts');
  });

  it('keeps a single star within one segment', () => {
    const files = findFiles(['*.ts']);
    expect(files).toContain('root.ts');
    expect(files).not.toContain('src/a.ts');
  });

  it('dedupes results across overlapping patterns', () => {
    const files = findFiles(['**/*.ts', 'src/**/*.ts', 'src/**/*.ts']);
    expect(files.filter((f) => f === 'src/a.ts').length).toBe(1);
  });

  it('ignores node_modules and dot-segment paths', () => {
    const files = findFiles(['**/*.ts']);
    expect(files).not.toContain('src/node_modules/dep/m.ts');
    expect(files).not.toContain('src/.hidden.ts');
  });

  it('matches test patterns', () => {
    const files = findFiles(['test/**/*.ts']);
    expect(files).toContain('test/a.test.ts');
    expect(files).toContain('test/sub/c.spec.ts');
  });

  it('matches a plain non-glob path', () => {
    const files = findFiles(['README.md']);
    expect(files).toContain('README.md');
  });

  it('returns empty when the base directory does not exist', () => {
    const files = findFiles(['does-not-exist/**/*.ts']);
    expect(files).toEqual([]);
  });

  it('handles a mid-pattern double star', () => {
    const files = findFiles(['src/**/a.ts', 'src/**/b.ts']);
    expect(files).toContain('src/a.ts');
    expect(files).toContain('src/nested/b.ts');
  });

  it('matches single-segment cli globs', () => {
    const files = findFiles(['cli/*.js']);
    expect(files).toContain('cli/x.js');
  });

  it('returns empty for an empty pattern list', () => {
    expect(findFiles([])).toEqual([]);
  });
});