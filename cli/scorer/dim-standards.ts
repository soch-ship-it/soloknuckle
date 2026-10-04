import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getErrorMessage, fileExists } from './helpers';
import type { DimensionScore } from './types';
export function getAccessibilityScore(): DimensionScore {
  try {
    let a11yIssues = 0;
    const violations: string[] = [];

    const candidateDirs = ['ui/src', 'src', 'app', 'pages', 'components', 'views', 'public'];
    const extensions = ['.html', '.jsx', '.tsx', '.vue', '.svelte'];
    const scannedFiles = new Set<string>();

    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build' || file === '.next') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (extensions.some(ext => file.endsWith(ext))) {
          if (scannedFiles.has(fullPath)) continue;
          scannedFiles.add(fullPath);

          const content = fs.readFileSync(fullPath, 'utf-8');
          const relPath = path.relative(process.cwd(), fullPath) || file;

          // 1. [WCAG 1.1.1 Non-Text Content] <img> missing alt attribute or placeholder alt
          const imgMatches = content.matchAll(/<img\b([^>]*)\/?>/gi);
          for (const match of imgMatches) {
            const attrs = match[1] || '';
            const altMatch = attrs.match(/\balt=(?:["']([^"']*)["']|\{([^}]*)\})/i);
            if (!altMatch) {
              a11yIssues++;
              violations.push(`[WCAG 1.1.1] Missing alt tag on img in ${relPath}`);
            } else {
              const altVal = (altMatch[1] || altMatch[2] || '').trim().toLowerCase();
              if (['image', 'img', 'photo', 'picture', 'logo.png', 'icon.svg'].includes(altVal)) {
                a11yIssues++;
                violations.push(`[WCAG 1.1.1] Uninformative alt text "${altVal}" on img in ${relPath}`);
              }
            }
          }

          // 2. [WCAG 1.1.1] <input type="image"> missing alt
          const inputImgMatches = content.matchAll(/<input\b([^>]*type=["']image["'][^>]*)\/?>/gi);
          for (const match of inputImgMatches) {
            const attrs = match[1] || '';
            if (!/\balt=/i.test(attrs)) {
              a11yIssues++;
              violations.push(`[WCAG 1.1.1] Missing alt on <input type="image"> in ${relPath}`);
            }
          }

          // 3. [WCAG 1.1.1] <area> missing alt
          const areaMatches = content.matchAll(/<area\b([^>]*)\/?>/gi);
          for (const match of areaMatches) {
            const attrs = match[1] || '';
            if (!/\balt=/i.test(attrs)) {
              a11yIssues++;
              violations.push(`[WCAG 1.1.1] Missing alt on <area> in ${relPath}`);
            }
          }

          // 4. [WCAG 4.1.2 Name, Role, Value] <button> lacks accessible name
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('<button')) {
              const windowEnd = Math.min(i + 4, lines.length);
              const btnWindow = lines.slice(i, windowEnd).join(' ');
              const hasAriaLabel = btnWindow.includes('aria-label');
              const hasAriaLabelledBy = btnWindow.includes('aria-labelledby');
              const hasTitle = btnWindow.includes('title=');
              if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
                a11yIssues++;
                violations.push(`[WCAG 4.1.2] Button lacks accessible name in ${relPath}:${i + 1}`);
              }
            }
          }

          // 5. [WCAG 1.3.1 Info & Relationships] Form inputs without labels/accessible name
          const inputMatches = content.matchAll(/<input\b([^>]*)\/?>/gi);
          for (const match of inputMatches) {
            const attrs = match[1] || '';
            const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
            const inputType = (typeMatch ? typeMatch[1] : 'text').toLowerCase();
            if (['hidden', 'submit', 'button', 'reset', 'image'].includes(inputType)) continue;

            const hasAriaLabel = /\baria-label=/i.test(attrs);
            const hasAriaLabelledBy = /\baria-labelledby=/i.test(attrs);
            const hasTitle = /\btitle=/i.test(attrs);
            const hasId = /\bid=["']([^"']+)["']/i.test(attrs);

            if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasId) {
              a11yIssues++;
              violations.push(`[WCAG 1.3.1] Form input (type="${inputType}") lacks accessible label or id in ${relPath}`);
            }
          }

          // 6. [WCAG 2.4.4 Link Purpose] Ambiguous or empty link text
          const linkMatches = content.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
          for (const match of linkMatches) {
            const attrs = match[1] || '';
            const linkBody = match[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
            const hasAria = /\baria-label=/i.test(attrs) || /\baria-labelledby=/i.test(attrs) || /\btitle=/i.test(attrs);
            if (!hasAria) {
              if (linkBody === '') {
                a11yIssues++;
                violations.push(`[WCAG 2.4.4] Empty <a> link without text or aria-label in ${relPath}`);
              } else if (['click here', 'here', 'read more', 'learn more', 'more'].includes(linkBody)) {
                a11yIssues++;
                violations.push(`[WCAG 2.4.4] Ambiguous link text "${linkBody}" lacks descriptive context in ${relPath}`);
              }
            }
          }

          // 7. [WCAG 2.1.1 Keyboard] Non-interactive elements with click handlers
          const clickMatches = content.matchAll(/<(div|span|p|section|li)\b([^>]*onClick[^>]*)>/gi);
          for (const match of clickMatches) {
            const tag = match[1];
            const attrs = match[2];
            const hasRole = /\brole=["'](?:button|link|menuitem|tab)["']/i.test(attrs);
            const hasTabIndex = /\btabIndex=/i.test(attrs);
            if (!hasRole || !hasTabIndex) {
              a11yIssues++;
              violations.push(`[WCAG 2.1.1] Non-interactive <${tag}> has onClick without role="button" or tabIndex in ${relPath}`);
            }
          }

          // 8. [WCAG 2.4.3 Focus Order] Positive tabIndex anti-pattern
          if (/\btabIndex=["']?[1-9]\d*["']?/i.test(content) || /\btabIndex=\{[1-9]\d*\}/i.test(content)) {
            a11yIssues++;
            violations.push(`[WCAG 2.4.3] Positive tabIndex detected in ${relPath} (disrupts natural tab navigation)`);
          }

          // 9. [WCAG 1.4.4 Resize Text] Viewport disabling zoom
          if (/\buser-scalable\s*=\s*no\b/i.test(content) || /\bmaximum-scale\s*=\s*1(?:\.0)?\b/i.test(content)) {
            a11yIssues++;
            violations.push(`[WCAG 1.4.4] Viewport meta tag disables user zoom/scaling in ${relPath}`);
          }

          // 10. [WCAG 3.1.1 Language of Page] <html> tag missing lang
          const htmlMatches = content.matchAll(/<html\b([^>]*)>/gi);
          for (const match of htmlMatches) {
            const attrs = match[1] || '';
            if (!/\blang=/i.test(attrs)) {
              a11yIssues++;
              violations.push(`[WCAG 3.1.1] <html> tag is missing 'lang' attribute in ${relPath}`);
            }
          }
        }
      }
    };

    for (const d of candidateDirs) {
      scanDir(path.join(process.cwd(), d));
    }

    // Also check root HTML files (index.html, etc.)
    const rootHtmlFiles = ['index.html', 'public/index.html'].map(f => path.join(process.cwd(), f));
    for (const rf of rootHtmlFiles) {
      if (fs.existsSync(rf) && !scannedFiles.has(rf)) {
        scannedFiles.add(rf);
        const content = fs.readFileSync(rf, 'utf-8');
        const relPath = path.relative(process.cwd(), rf) || rf;
        if (/<html\b[^>]*>/i.test(content) && !/<html\b[^>]*\blang=/i.test(content)) {
          a11yIssues++;
          violations.push(`[WCAG 3.1.1] <html> tag is missing 'lang' attribute in ${relPath}`);
        }
        if (/\buser-scalable\s*=\s*no\b/i.test(content) || /\bmaximum-scale\s*=\s*1(?:\.0)?\b/i.test(content)) {
          a11yIssues++;
          violations.push(`[WCAG 1.4.4] Viewport meta tag disables user zoom/scaling in ${relPath}`);
        }
      }
    }

    if (a11yIssues === 0) return { score: 100, rawOutput: 'No obvious accessibility violations found.' };

    let score = 100 - (a11yIssues * 15);
    if (score < 0) score = 0;
    return { score, rawOutput: violations.slice(0, 50).join('\n') };
  } catch (err: unknown) {
    return { score: 0, rawOutput: `Fatal error analyzing accessibility: ${getErrorMessage(err)}` };
  }
}

// ─── New 5 Dimensions ──────────────────────────────────────────────────────

export function getDependencyScore(): DimensionScore {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    const hasLockFile = lockFiles.some(f => fileExists(f));

    if (!fs.existsSync(pkgPath)) {
      return { score: 50, rawOutput: 'No package.json found.' };
    }

    let score = 100;
    let report = '';

    // Check for lock file
    if (!hasLockFile) {
      score -= 30;
      report += 'No lock file found. Reproducible installs are not guaranteed.\n';
    }

    // Check for known vulnerability patterns in package.json
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depCount = Object.keys(allDeps || {}).length;

      if (depCount > 100) {
        score -= 15;
        report += `High dependency count (${depCount}). Consider auditing for unused deps.\n`;
      } else if (depCount > 50) {
        score -= 5;
        report += `Moderate dependency count (${depCount}).\n`;
      }

      // Check for deprecated / known problematic packages
      const riskyPkgs = ['request', 'moment', 'lodash', 'webpack-dev-server'];
      for (const pkg of riskyPkgs) {
        if (allDeps && allDeps[pkg]) {
          score -= 5;
          report += `'${pkg}' is deprecated or has known issues. Consider replacing it.\n`;
        }
      }
    } catch {
      // skip
    }

    // Try `npm audit` if available
    try {
      const auditOutput = execSync('npm audit --json 2>/dev/null', { encoding: 'utf-8', cwd: process.cwd(), stdio: 'pipe', timeout: 15000 });
      const audit = JSON.parse(auditOutput);
      const vulnCount = audit.metadata?.vulnerabilities?.total || 0;
      const criticalCount = audit.metadata?.vulnerabilities?.critical || 0;
      const highCount = audit.metadata?.vulnerabilities?.high || 0;

      if (criticalCount > 0) {
        score -= 30;
        report += `${criticalCount} critical vulnerabilities found!\n`;
      }
      if (highCount > 0) {
        score -= 15;
        report += `${highCount} high-severity vulnerabilities found.\n`;
      }
      if (vulnCount === 0) {
        report += 'npm audit: no known vulnerabilities.\n';
      } else {
        report += `npm audit: ${vulnCount} total vulnerabilities.\n`;
      }
    } catch {
      // npm audit failed — might not have lock file or network
    }

    if (score < 0) score = 0;
    return { score, rawOutput: report || 'Dependencies look healthy.' };
  } catch (err: unknown) {
    return { score: 50, rawOutput: `Error checking dependencies: ${getErrorMessage(err)}` };
  }
}

export function getDocumentationScore(): DimensionScore {
  try {
    let score = 0;
    let report = '';

    const checks: { file: string; points: number; label: string }[] = [
      { file: 'README.md', points: 30, label: 'README' },
      { file: 'LICENSE', points: 20, label: 'LICENSE' },
      { file: 'CHANGELOG.md', points: 15, label: 'CHANGELOG' },
      { file: 'CONTRIBUTING.md', points: 10, label: 'CONTRIBUTING' },
      { file: 'SECURITY.md', points: 10, label: 'SECURITY' },
      { file: 'DISCLAIMER.md', points: 5, label: 'DISCLAIMER' },
    ];

    for (const check of checks) {
      if (fileExists(check.file)) {
        score += check.points;
        // Check if file has meaningful content (not just stub)
        const content = fs.readFileSync(path.join(process.cwd(), check.file), 'utf-8');
        if (content.length > 100) {
          report += `${check.label}: present and detailed.\n`;
        } else {
          score -= Math.floor(check.points / 2);
          report += `${check.label}: present but minimal (< 100 chars).\n`;
        }
      } else {
        report += `${check.label}: missing.\n`;
      }
    }

    // Check for JSDoc/TSDoc in source
    const srcDirs = ['src', 'cli', 'lib'];
    let docBlocks = 0;
    for (const dir of srcDirs) {
      const fullDir = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullDir)) continue;
      const scanDir = (d: string) => {
        if (!fs.existsSync(d)) return;
        const entries = fs.readdirSync(d);
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === '.git') continue;
          const fp = path.join(d, entry);
          if (fs.statSync(fp).isDirectory()) {
            scanDir(fp);
          } else if (fp.endsWith('.ts') || fp.endsWith('.js')) {
            const content = fs.readFileSync(fp, 'utf-8');
            docBlocks += (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
          }
        }
      };
      scanDir(fullDir);
    }
    if (docBlocks > 10) {
      score += 10;
      report += `Good inline documentation (${docBlocks} JSDoc blocks).\n`;
    } else if (docBlocks > 0) {
      score += 5;
      report += `Some inline documentation (${docBlocks} JSDoc blocks).\n`;
    }

    if (score > 100) score = 100;
    return { score, rawOutput: report || 'Documentation status unknown.' };
  } catch (err: unknown) {
    return { score: 50, rawOutput: `Error checking docs: ${getErrorMessage(err)}` };
  }
}
