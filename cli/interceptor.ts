import chalk from 'chalk';

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bsudo\s+rm\b/i, reason: 'Sudo rm detected' },
  { pattern: /\brm\s+(-\w*\s+)*-\w*r\w*f\b/i, reason: 'Recursive force delete detected' },
  { pattern: /\brm\s+(-\w*\s+)*-\w*f\w*r\b/i, reason: 'Recursive force delete detected (alt flag order)' },
  { pattern: /\brm\s+-\w*r\w*\s+-\w*f\b/i, reason: 'Recursive force delete detected (spaced flags)' },
  { pattern: /\brm\s+-\w*f\w*\s+-\w*r\b/i, reason: 'Recursive force delete detected (spaced flags)' },
  { pattern: /\brm\s+-rf\b/i, reason: 'Recursive force delete detected' },
  { pattern: /\brm\s+-fr\b/i, reason: 'Recursive force delete detected' },
  { pattern: /\brm\s+--(?:recursive\s+--force|force\s+--recursive)\b/, reason: 'Recursive force delete detected (long-form flags)' },
  { pattern: /\bdrop\s+(database|table|schema)\b/i, reason: 'Destructive SQL drop detected' },
  { pattern: /\bdelete\s+from\b/i, reason: 'Destructive SQL delete detected (missing WHERE safe-guard)' },
  { pattern: /\btruncate\s+(table\s+)?\w/i, reason: 'SQL truncate detected' },
  { pattern: /\bgit\s+push\s+(--force|-f)\b/i, reason: 'Force push detected' },
  { pattern: /\bgit\s+push\s+--force-with-lease\b/i, reason: 'Force push (with lease) detected' },
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: 'Hard reset detected' },
  { pattern: /\bgit\s+clean\s+-fd\w*\b/i, reason: 'Git clean (removes untracked files) detected' },
  { pattern: /\bmv\s+.*\s+\/dev\/null\b/i, reason: 'Moving to /dev/null (data loss) detected' },
  { pattern: /\bchmod\s+(-R\s+)?0?[0-7][0-7][0-7]\b/, reason: 'Overly permissive chmod detected' },
  { pattern: /\bchmod\s+(-R\s+)?(a\+rwx|o\+w|a=rwx)\b/i, reason: 'Overly permissive chmod mode detected' },
  { pattern: /\b(curl|wget)\b.*\|\s*(?:(?:ba|z|k|c|tc)?sh|fish|dash)\b/i, reason: 'Piping remote script to shell detected' },
  { pattern: /\bmkfs\b/, reason: 'Filesystem format command detected' },
  { pattern: /\bdd\s+.*\bof=\/dev\/\w+/i, reason: 'Raw disk write detected' },
  { pattern: /\|\s*tee\s+/, reason: 'Piping to tee (file write via redirect) detected' },
  { pattern: />>?\s+\/\S+/, reason: 'Shell output redirect to absolute path detected' },
  { pattern: />>?\s+(?!\/)[^\s|&=<>`]/, reason: 'Shell output redirect to file detected' },
  { pattern: /<<\s*\S+/, reason: 'Shell heredoc redirect detected' },
  { pattern: /\bsudo\s+\w+\s*>/, reason: 'Sudo command with file redirect detected' },
];

export interface InterceptionResult {
  blocked: boolean;
  reason?: string;
  jsonResponse?: string;
}

/**
 * Intercepts shell commands to block destructive actions.
 * Returns a structured JSON error to force agent self-correction.
 */
export function interceptCommand(command: string): InterceptionResult {
  for (const { pattern, reason } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) {
      console.log(chalk.red(`[Firewall Blocked] ${reason}`));

      const jsonResponse = JSON.stringify({
        error: 'ACTION_BLOCKED_BY_SOLOKNUCKLE_FIREWALL',
        message: 'You attempted a destructive action that violates project constraints.',
        attempted_command: command,
        suggestion: 'Please use a safer alternative or request human approval.',
        reason
      }, null, 2);

      return { blocked: true, reason, jsonResponse };
    }
  }

  return { blocked: false };
}
