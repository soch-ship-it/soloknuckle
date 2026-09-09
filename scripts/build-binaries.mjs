import { build } from 'esbuild';
import { copyFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const dir = 'dist-bin';
const outfile = path.join(dir, 'soloknuckle-bundle');
const targets = ['linux-x64', 'linux-arm64', 'linux-armv7', 'darwin-x64', 'darwin-arm64'];

mkdirSync(dir, { recursive: true });

await build({
  entryPoints: ['cli/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logOverride: {
    'ignored-dynamic-require': 'silent',
    'umd-global-name': 'silent',
  },
  outfile,
});

execSync(`chmod +x ${outfile}`);

for (const [plat, arch] of targets.map((t) => t.split('-'))) {
  const tmp = path.join(dir, `tmp-${plat}-${arch}`);
  mkdirSync(tmp, { recursive: true });
  copyFileSync(outfile, path.join(tmp, 'soloknuckle'));
  execSync(`tar -C "${tmp}" -czf "${path.join(dir, `soloknuckle-${plat}-${arch}.tar.gz`)}" soloknuckle`);
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Built ${targets.length} release tarballs in ${dir}:`);
console.log(targets.map((t) => `  soloknuckle-${t}.tar.gz`).join('\n'));