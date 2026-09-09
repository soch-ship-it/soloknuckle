import fs from 'fs';
import path from 'path';

/**
 * The installed package version, read from the package.json that ships with
 * the CLI. Works in both layouts:
 *  - installed/published: dist/cli/*.js -> ../../package.json
 *  - running from source (ts-node / vitest): cli/*.ts -> ../package.json
 * Falls back to 0.0.0 only if no package.json can be found.
 */
export function getVersion(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'package.json'),
    path.join(__dirname, '..', 'package.json'),
  ];
  for (const pkgPath of candidates) {
    try {
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
      if (typeof pkg.version === 'string') return pkg.version;
    } catch {
      // try the next candidate
    }
  }
  return '0.0.0';
}

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
      // Normalize to forward slashes so glob patterns ('src/**/*.ts') match
      // the same way on every platform — path.relative uses '\' on Windows.
      const relPosix = rel.split(path.sep).join('/');
      const parts = relPosix.split('/');
      if (parts.includes('node_modules') || parts.some(p => p.startsWith('.'))) continue;
      if (re.test(relPosix) && !seen.has(relPosix)) {
        seen.add(relPosix);
        matches.push(relPosix);
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