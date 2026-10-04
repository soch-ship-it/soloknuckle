const SECRET_PATTERNS = [
  /sk_live_[0-9a-zA-Z]{24}/,                  // Stripe live key
  /rk_live_[0-9a-zA-Z]{24}/,                  // Stripe restricted key
  /sk_[0-9a-zA-Z]{24,}/,                      // Stripe restricted/secret key
  /sk-[a-zA-Z0-9]{32,}/,                      // OpenAI/Anthropic-style API key
  /sk-proj-[0-9A-Za-z_-]{20,}/,               // OpenAI project API key (hyphenated)
  /sk-ant-api[0-9]{2}-[0-9A-Za-z_-]{40,}/,    // Anthropic API key
  /xoxb-[0-9A-Za-z\-]+/,                      // Slack bot token
  /xoxp-[0-9A-Za-z\-]+/,                      // Slack user token
  /xoxe-[0-9A-Za-z\-]+/,                      // Slack app-level token
  /xoxa-[0-9A-Za-z\-]+/,                      // Slack workspace token
  /(mfa\.[A-Za-z0-9_-]{20,}|[MN][A-Za-z0-9_-]{23,}\.[\w-]{6}\.[\w-]{27,})/, // Discord bot/user token
  /[a-hj-zA-HJ-NP-Z0-9]{26,}\.[\w-]{6}\.[\w-]{38,}/, // Discord webhook token (base64 id + 6-char timestamp + 38-char hmac)
  /api[_-]?key[_-]?\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/i, // Generic API key assignment (quoted, incl. underscore sites)
  /api[_-]?key[_-]?\s*[:=]\s*[A-Za-z0-9]{16,}/i, // Generic API key assignment (bare / YAML-style)
  /(?:secret|password|passwd|auth[_-]?token|token)\s*[:=]\s*["'][^"']{6,}["']/i, // Hardcoded credential assignments
  /AKIA[0-9A-Z]{16}/,                         // AWS access key
  /ASIA[0-9A-Z]{16}/,                         // AWS temporary access key
  /(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/i, // AWS secret key
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
  /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY( BLOCK)?-----/, // Private key incl. PGP/PKCS8
  /AIza[0-9A-Za-z\-_]{35}/,                   // GCP API key
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT
  /\bglpat-[0-9A-Za-z_-]{20,}/,               // GitLab personal access token
  /\bhf_[A-Za-z0-9]{16,}/,                    // Hugging Face access token
  /\bpul-[0-9a-fA-F]{40}/,                    // Pulumi access token
  /\bshpat_[0-9a-fA-F]{32}/,                  // Shopify access token
  /\bSK[0-9a-fA-F]{32}\b/,                    // Twilio API key
  /AccountKey=[A-Za-z0-9+/=]{40,}/i,          // Azure Storage account key
  /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}/,  // PyPI upload token
  /(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|mariadb):\/\/[a-zA-Z0-9_\-\.]+:[^@\s"']+@[a-zA-Z0-9_\-\.]+/i, // Database URI with credentials
];

const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email address
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN-like
];

/**
 * Heuristic for placeholder values. Seeded docs/.env.example files and
 * tutorial snippets use values like `your_key_here`, `xxx`, `<token>`; those
 * should not be treated as leaked secrets.
 */
function isPlaceholder(line: string): boolean {
  return /your[_ -]?[a-z]+/i.test(line) ||
    /\bplaceholder\b/i.test(line) ||
    /xxxx/i.test(line) ||
    /<[^>]{1,20}>/.test(line) ||
    /localhost/i.test(line) ||
    /mock/i.test(line) ||
    /dummy/i.test(line);
}

// Assignment-style patterns where documented placeholders (your_key_here,
// changeme, <token>) are common and should not be treated as leaks.
const ASSIGN_PATTERNS = [
  /api[_-]?key[_-]?\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/i,
  /api[_-]?key[_-]?\s*[:=]\s*[A-Za-z0-9]{16,}/i,
  /(?:secret|password|passwd|auth[_-]?token|token)\s*[:=]\s*["'][^"']{6,}["']/i,
  /(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|mariadb):\/\/[a-zA-Z0-9_\-\.]+:[^@\s"']+@[a-zA-Z0-9_\-\.]+/i,
];

function isAssignPattern(pattern: RegExp): boolean {
  return ASSIGN_PATTERNS.some(p => p.source === pattern.source);
}

function isRegexDefinition(line: string): boolean {

  const trimmed = line.trim();
  return (trimmed.startsWith('/') && (trimmed.endsWith('/') || trimmed.endsWith('/,') || trimmed.endsWith('/;'))) ||
    /\bnew\s+RegExp\b/.test(line) ||
    /SECRET_PATTERNS|PII_PATTERNS|const\s+[A-Z_]+_PATTERNS/.test(line);
}

/**
 * Classifies a single line of source/diff content. Returns a short label when
 * the line looks like a secret, credential, or PII, undefined otherwise.
 */
function classifyLine(line: string): string | undefined {
  if (isRegexDefinition(line)) return undefined;

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(line)) {
      return isAssignPattern(pattern) && isPlaceholder(line) ? undefined : 'secret/API key';
    }
  }
  if (
    PII_PATTERNS.some(p => p.test(line)) &&
    !line.includes('example.com') &&
    !line.includes('test@')
  ) {
    return 'PII';
  }
  return undefined;
}


export interface SecurityVulnerability {
  type: 'secret' | 'sast' | 'pii';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  file?: string;
  rule: string;
}

/**
 * Scans source code content for Static Application Security Testing (SAST)
 * vulnerabilities such as command injection, XSS, insecure crypto, and disabled TLS.
 */
export function scanCodeForSecurityVulnerabilities(content: string, filename = ''): SecurityVulnerability[] {
  const vulnerabilities: SecurityVulnerability[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip comment lines and analyzer pattern checks
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    if (trimmed.startsWith('/') || /RegExp|PATTERNS|RULES|\.test\(|rule:/.test(line)) return;


    // 1. Command Injection: eval() or new Function()
    if (/\beval\s*\([^)]+\)/.test(line)) {
      vulnerabilities.push({
        type: 'sast',
        severity: 'critical',
        message: `Use of 'eval()' allows arbitrary remote code execution`,
        line: lineNum,
        file: filename,
        rule: 'no-eval',
      });
    }

    if (/new\s+Function\s*\(/.test(line)) {
      vulnerabilities.push({
        type: 'sast',
        severity: 'high',
        message: `Dynamic function constructor 'new Function()' is unsafe`,
        line: lineNum,
        file: filename,
        rule: 'no-new-func',
      });
    }

    // 2. Unsafe child_process execution with template variables
    if (/child_process\.(exec|execSync)\s*\(\s*`[^`]*\$\{/.test(line)) {
      vulnerabilities.push({
        type: 'sast',
        severity: 'high',
        message: `Dynamic command interpolation in child_process.exec may lead to command injection`,
        line: lineNum,
        file: filename,
        rule: 'no-dynamic-exec',
      });
    }

    // 3. XSS / DOM Injection: dangerouslySetInnerHTML without sanitize comment or raw innerHTML
    if (/\bdangerouslySetInnerHTML\s*=\s*\{/i.test(line)) {
      const isSanitized = /DOMPurify|sanitize|escapeHtml|safeHtml/i.test(line);
      if (!isSanitized) {
        vulnerabilities.push({
          type: 'sast',
          severity: 'high',
          message: `Unsanitized 'dangerouslySetInnerHTML' may cause Cross-Site Scripting (XSS)`,
          line: lineNum,
          file: filename,
          rule: 'xss-dangerously-set-inner-html',
        });
      }
    }


    if (/\.innerHTML\s*=/i.test(line)) {
      const isSanitized = /DOMPurify|sanitize|escapeHtml|safeHtml/i.test(line) || /innerHTML\s*=\s*["'`][^"'`]*["'`]/.test(line);
      if (!isSanitized) {
        vulnerabilities.push({
          type: 'sast',
          severity: 'medium',
          message: `Direct assignment to '.innerHTML' without sanitization can introduce XSS`,
          line: lineNum,
          file: filename,
          rule: 'no-unsafe-innerhtml',
        });
      }
    }


    // 4. Insecure Cryptography: DES, RC4, MD5, SHA1 in crypto ciphers
    if (/crypto\.createCipher(?:iv)?\s*\(\s*['"](des|rc2|rc4|md5|sha1)['"]/i.test(line)) {
      vulnerabilities.push({
        type: 'sast',
        severity: 'high',
        message: `Insecure cryptographic algorithm detected (use AES-256-GCM or ChaCha20-Poly1305)`,
        line: lineNum,
        file: filename,
        rule: 'no-weak-crypto',
      });
    }

    // 5. Disabled TLS / SSL Certificate verification
    if (/rejectUnauthorized\s*:\s*false/.test(line) || /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/.test(line)) {
      vulnerabilities.push({
        type: 'sast',
        severity: 'critical',
        message: `TLS verification disabled (rejectUnauthorized: false) allows Man-in-the-Middle attacks`,
        line: lineNum,
        file: filename,
        rule: 'no-disabled-tls',
      });
    }
  });

  return vulnerabilities;
}

/**
 * Scans any text (not just diffs) for potential secrets, hardcoded
 * credentials, and PII — every line is inspected regardless of +/- markers.
 */
export function scanTextForSecrets(content: string): string[] {
  const violations: string[] = [];
  content.split('\n').forEach((line, index) => {
    const kind = classifyLine(line);
    if (kind === 'PII') {
      violations.push(`Line ${index + 1}: Potential PII (Email/SSN) detected.`);
    } else if (kind) {
      violations.push(`Line ${index + 1}: Potential secret/API key detected.`);
    }
  });
  return violations;
}

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

    const kind = classifyLine(line);
    if (kind === 'PII') {
      violations.push(`Line ${index + 1}: Potential PII (Email/SSN) detected.`);
    } else if (kind) {
      violations.push(`Line ${index + 1}: Potential secret/API key detected.`);
    }
  });

  return violations;
}

