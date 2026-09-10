import fs from 'fs';
import os from 'os';
import path from 'path';
import chalk from 'chalk';

const GUARD_BEGIN = '# >>> soloknuckle guard (optional firewall for raw terminals)';
const GUARD_END = '# <<< soloknuckle guard';

const GUARDED_COMMANDS = ['rm', 'git', 'chmod', 'dd', 'mkfs', 'curl', 'wget'];

/**
 * Builds a POSIX shell snippet that redefines the guarded commands so every
 * invocation is first checked by `soloknuckle intercept`. Blocked commands
 * never reach the real binary and print the firewall reason.
 *
 * This is optional and opt-in: Soloknuckle's firewall is otherwise enforced
 * for commands routed through it (git hooks, MCP tool, the `intercept` CLI).
 */
export function generateShellGuard(shell: 'bash' | 'zsh'): string {
  const wrappers = GUARDED_COMMANDS.map(cmd => `  ${cmd}() { _soloknuckle_guard ${cmd} "$@"; }`).join('\n');

  return `${GUARD_BEGIN}
# Added by: soloknuckle guard-install
# Removes itself via: soloknuckle guard-install --remove
_soloknuckle_guard() {
  if command -v soloknuckle >/dev/null 2>&1; then
    local _cmd="$1"
    shift
    local _int
    _int="$(command soloknuckle intercept "$_cmd" "$@" --json 2>&1)"
    local _code=$?
    if [ "$_code" -eq 1 ]; then
      printf '%s\\n' "$_int" >&2
      return 1
    fi
  fi
  command "$_cmd" "$@"
}

${wrappers}
${GUARD_END}`;
}

export function getShellConfig(shell: 'bash' | 'zsh'): string {
  return shell === 'zsh' ? path.join(os.homedir(), '.zshrc') : path.join(os.homedir(), '.bashrc');
}

function guardInstalled(configPath: string): boolean {
  if (!fs.existsSync(configPath)) return false;
  const content = fs.readFileSync(configPath, 'utf-8');
  return content.includes(GUARD_BEGIN) && content.includes(GUARD_END);
}

export function installShellGuard(options: { shell: 'bash' | 'zsh'; remove?: boolean }): void {
  const configPath = getShellConfig(options.shell);

  if (options.remove) {
    if (!fs.existsSync(configPath)) {
      console.log(chalk.yellow(`No ${path.basename(configPath)} found — nothing to remove.`));
      return;
    }
    let content = fs.readFileSync(configPath, 'utf-8');
    const start = content.indexOf(GUARD_BEGIN);
    const end = content.indexOf(GUARD_END);
    if (start === -1 || end === -1) {
      console.log(chalk.yellow('No soloknuckle guard block found. Nothing to remove.'));
      return;
    }
    content = content.slice(0, start) + content.slice(end + GUARD_END.length);
    fs.writeFileSync(configPath, content.trimEnd() + '\n');
    console.log(chalk.green(`✅ Removed soloknuckle guard from ${configPath} (restart your shell to apply).`));
    return;
  }

  if (guardInstalled(configPath)) {
    console.log(chalk.yellow(`Soloknuckle guard already installed in ${configPath}.`));
    return;
  }

  const block = generateShellGuard(options.shell);
  fs.appendFileSync(configPath, '\n' + block + '\n');
  console.log(chalk.green(`✅ Installed soloknuckle shell guard into ${configPath}.`));
  console.log(chalk.dim('   Run `source ~/.zshrc` (zsh) or `source ~/.bashrc` (bash) to activate, or open a new terminal.'));
  console.log(chalk.dim('   To remove later: soloknuckle guard-install --shell ' + options.shell + ' --remove'));
}

export function detectShell(): 'bash' | 'zsh' {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  return 'bash';
}