import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { scanDiffForSecretsAndPII } from '../scanner';
import { getErrorMessage, getExecErrorOutput, fileExists } from './helpers';
import type { DimensionScore } from './types';
// ─── Original 5 Pillars ────────────────────────────────────────────────────

// Cache for quality results too — lint can be slow and is invoked multiple
// times per single `check` run.
let _lintResultCache: DimensionScore | null = null;
let _lintCacheCwd: string = '';

export function getQualityScore(): DimensionScore {
  const cwd = process.cwd();
  if (_lintResultCache && _lintCacheCwd === cwd) return _lintResultCache;
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.lint) {
        try {
          execSync('npm run lint', { encoding: 'utf-8', cwd: process.cwd(), stdio: 'pipe' });
          _lintCacheCwd = cwd;
          _lintResultCache = { score: 100, rawOutput: 'Lint passed' };
          return _lintResultCache;
        } catch (e: unknown) {
          const output = getExecErrorOutput(e);
          const warningCount = (output.match(/warning/ig) || []).length;
          const errorCount = (output.match(/error/ig) || []).length;
          let score = 100 - (errorCount * 10) - (warningCount * 5);
          if (score < 0) score = 0;
          _lintCacheCwd = cwd;
          _lintResultCache = { score, rawOutput: output.substring(0, 1000) };
          return _lintResultCache;
        }
      }
    }
    _lintCacheCwd = cwd;
    _lintResultCache = { score: 50, rawOutput: 'No lint script found in package.json' };
    return _lintResultCache;
  } catch (err: unknown) {
    _lintCacheCwd = cwd;
    _lintResultCache = { score: 0, rawOutput: `Fatal error analyzing quality: ${getErrorMessage(err)}` };
    return _lintResultCache;
  }
}

// Cache for test results to avoid re-running tests multiple times per invocation
let _testResultCache: DimensionScore | null = null;
let _testCacheCwd: string = '';

// Parse the actual count of failing tests instead of counting the raw word
// "fail" (which also matches speed strings like "12ms" and the word "failed"
// wherever it appears in output, wildly inflating the penalty).
function countFailedTests(output: string): number {
  // Jest: "Tests: 5 failed, 42 passed, 47 total"
  // Vitest: "Tests  5 failed | 9 passed"
  const summary = output.match(/Tests:?\s+[\s\S]*?(\d+)\s+failed/i);
  if (summary) return Number(summary[1]);
  const failedWord = (output.match(/\bfailed\b/ig) || []).length;
  return failedWord;
}

export function getTestingScore(): DimensionScore {
  const cwd = process.cwd();
  if (_testResultCache && _testCacheCwd === cwd) return _testResultCache;
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.test) {
        try {
          const output = execSync('npm run test 2>&1', { encoding: 'utf-8', cwd: process.cwd(), stdio: 'pipe', timeout: 30000 });
          _testCacheCwd = cwd;
          _testResultCache = { score: 100, rawOutput: output.substring(0, 1000) };
          return _testResultCache;
        } catch (e: unknown) {
          const output = getExecErrorOutput(e);
          const failCount = countFailedTests(output);
          let score = 80 - (failCount * 20);
          if (score < 0) score = 0;
          _testCacheCwd = cwd;
          _testResultCache = { score, rawOutput: output.substring(0, 1000) };
          return _testResultCache;
        }
      }
    }
    _testCacheCwd = cwd;
    _testResultCache = { score: 0, rawOutput: 'No test script found in package.json' };
    return _testResultCache;
  } catch (err: unknown) {
    _testCacheCwd = cwd;
    _testResultCache = { score: 0, rawOutput: `Fatal error analyzing tests: ${getErrorMessage(err)}` };
    return _testResultCache;
  }
}

export function getSecurityScore(): DimensionScore {
  try {
    let diff = '';
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore', cwd: process.cwd() });
      diff = execSync('git diff --cached', { encoding: 'utf-8', cwd: process.cwd(), stdio: 'pipe' });
      if (!diff) diff = execSync('git diff', { encoding: 'utf-8', cwd: process.cwd(), stdio: 'pipe' });
    } catch (_e) {
      // No git repo or no diff available
    }

    const violations = scanDiffForSecretsAndPII(diff);
    if (violations.length === 0) {
      return { score: 100, rawOutput: 'No secrets or PII detected in diff.' };
    } else {
      let score = 100 - (violations.length * 25);
      if (score < 0) score = 0;
      return { score, rawOutput: violations.join('\n') };
    }
  } catch (err: unknown) {
    return { score: 0, rawOutput: `Fatal error analyzing security: ${getErrorMessage(err)}` };
  }
}

export function getEfficiencyScore(): DimensionScore {
  try {
    let complexityIssues = 0;
    let report = '';

    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n').length;
          const nesting = (content.match(/\{/g) || []).length;

          if (lines > 500) {
            complexityIssues += 2;
            report += `${file} is extremely long (${lines} lines).\n`;
          }
          if (nesting > 150) {
            complexityIssues++;
            report += `${file} has deep nesting.\n`;
          }
        }
      }
    };

    scanDir(path.join(process.cwd(), 'src'));
    scanDir(path.join(process.cwd(), 'cli'));

    if (complexityIssues === 0) return { score: 100, rawOutput: 'Code structure appears highly efficient.' };

    let score = 100 - (complexityIssues * 10);
    if (score < 0) score = 0;
    return { score, rawOutput: report.substring(0, 1000) };
  } catch (err: unknown) {
    return { score: 0, rawOutput: `Fatal error analyzing efficiency: ${getErrorMessage(err)}` };
  }
}
