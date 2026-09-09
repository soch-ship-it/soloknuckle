import fs from 'fs';
import path from 'path';

/**
 * Correct, minimal glob discovery for the patterns this codebase uses,
 * e.g. 'src' + any-deep '*.ts', any-deep '*.test.ts', 'cli' + '*.spec.js'.
 *
 * The previous hand-rolled variant (splitting a glob at its asterisk and
 * only keeping a trailing extension) silently matched nothing the moment a
 * glob had a mid-pattern double-asterisk or a single-asterisk pattern, so
 * several advertised features found zero files.
 */
export function findFiles(patterns: string[]): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    if (!pattern) continue;
    const base = baseDirOf(pattern);
    const re = globToRegExp(pattern);
    const root = path.join(process.cwd(), base);
    if (!fs.existsSync(root)) continue;

    let items: string[] = [];
    try {
      items = fs.readdirSync(root, { encoding: 'utf8', recursive: true });
    } catch {
      continue;
    }

    for (const item of items) {
      const itemPath = path.join(root, String(item));
      try {
        if (!fs.statSync(itemPath).isFile()) continue;
      } catch {
        continue;
      }
      const rel = path.relative(process.cwd(), itemPath);
      const parts = rel.split(/[\\/]/);
      if (parts.includes('node_modules') || parts.some(p => p.startsWith('.'))) continue;
      if (re.test(rel) && !seen.has(rel)) {
        seen.add(rel);
        matches.push(rel);
      }
    }
  }

  return matches;
}

function baseDirOf(pattern: string): string {
  const wildcard = pattern.indexOf('*');
  if (wildcard === -1) return path.dirname(pattern);
  const rawBase = pattern.slice(0, wildcard);
  const dir = rawBase.endsWith('/') ? rawBase : path.dirname(rawBase);
  return dir === '.' ? '' : dir;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?') // a '**/' spans zero or more path segments
    .replace(/\*/g, '[^/\\\\]*'); //   a single '*' never crosses a segment
  return new RegExp(`^${escaped}$`);
}