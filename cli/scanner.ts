const SECRET_PATTERNS = [
  /sk_live_[0-9a-zA-Z]{24}/,                  // Stripe live key
  /sk_[0-9a-zA-Z]{24,}/,                      // Stripe restricted/secret key
  /sk-[a-zA-Z0-9]{32}/,                       // OpenAI/Anthropic-style API key
  /xoxb-[0-9A-Za-z\-]+/,                      // Slack bot token
  /xoxp-[0-9A-Za-z\-]+/,                      // Slack user token
  /xoxe-[0-9A-Za-z\-]+/,                      // Slack app-level token
  /(mfa\.[A-Za-z0-9_-]{20,}|[MN][A-Za-z0-9_-]{23,}\.[\w-]{6}\.[\w-]{27,})/, // Discord bot/user token
  /[a-hj-zA-HJ-NP-Z0-9]{26,}\.[\w-]{6}\.[\w-]{38,}/, // Discord webhook token (base64 id + 6-char timestamp + 38-char hmac)
  /api[_-]?key[_-]?\s*[:=]\s*["']?[0-9a-zA-Z]{16,}/i, // Generic API key assignment (incl. YAML-style)
  /AKIA[0-9A-Z]{16}/,                         // AWS access key
  /ASIA[0-9A-Z]{16}/,                         // AWS temporary access key
  /ghp_[A-Za-z0-9]{36}/,                      // GitHub personal access token
  /github_pat_[A-Za-z0-9_]{22,}/,             // GitHub fine-grained PAT
  /ghs_[A-Za-z0-9]{36}/,                      // GitHub server-to-server token
  /gho_[A-Za-z0-9]{36}/,                      // GitHub OAuth token
  /ghr_[A-Za-z0-9]{36}/,                      // GitHub refresh token
  /npm_[A-Za-z0-9]{36}/,                      // npm access token
  /(?:npmjs\.com|registry\.npmjs\.org)[^ ]*_authToken\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}/i, // npm _authToken leak
  /SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{40,}/, // SendGrid API key
/\b[0-9]{8,10}:[A-Za-z0-9_-]{35}/, // Telegram bot token
  /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Za-z]+\/B[0-9A-Za-z]+\/[A-Za-z0-9]+/, // Slack webhook
  /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/, // Private key incl. PGP
  /AIza[0-9A-Za-z\-_]{35}/,                   // GCP API key
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT
];

const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email address
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN-like
];

/**
 * Scans a git diff string for potential secrets, API keys, and Personally Identifiable Information (PII).
 * This function only scans line additions (`+`) to prevent flagging deleted secrets.
 * 
 * @param diff - The git diff string to scan.
 * @returns An array of string violations. If empty, no violations were found.
 */
export function scanDiffForSecretsAndPII(diff: string): string[] {
  const violations: string[] = [];

  const lines = diff.split('\n');
  lines.forEach((line, index) => {
    // Only scan additions
    if (!line.startsWith('+') || line.startsWith('+++')) return;

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        violations.push(`Line ${index + 1}: Potential secret/API key detected.`);
        break;
      }
    }
    for (const pattern of PII_PATTERNS) {
      if (pattern.test(line) && !line.includes('example.com') && !line.includes('test@')) {
        violations.push(`Line ${index + 1}: Potential PII (Email/SSN) detected.`);
        break;
      }
    }
  });

  return violations;
}
