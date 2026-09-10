import { describe, it, expect } from 'vitest';
import { scanDiffForSecretsAndPII } from '../cli/scanner';

describe('scanDiffForSecretsAndPII', () => {
  it('should ignore code without secrets', () => {
    const diff = `+ const message = "Hello World";\n+ console.log(message);`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(0);
  });

  it('should detect Stripe live keys', () => {
    const diff = '+ const stripeKey = "' + 'sk_live_' + '1234567890abcdefgh123456";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('secret/API key');
  });

  it('should detect Slack bot tokens', () => {
    const diff = `+ const token = "xoxb-fake-token-for-test";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('secret/API key');
  });

  it('should detect SSN patterns', () => {
    const diff = `+ const user_ssn = "123-45-6789";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('PII');
  });

  it('should ignore example emails', () => {
    const diff = `+ const email = "test@example.com";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(0);
  });

  it('should detect real emails', () => {
    const diff = `+ const email = "founder@startup.com";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('PII');
  });

  it('should detect AWS access keys', () => {
    const diff = '+ const accessKey = "' + 'AKIA' + 'IOSFODNN7EXAMPLE";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('secret/API key');
  });

  it('should detect GitHub personal access tokens', () => {
const diff = '+ const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('secret/API key');
  });

  it('should detect GitHub OAuth tokens', () => {
const diff = '+ const token = "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect private keys', () => {
    const diff = `+ const key = "-----BEGIN RSA PRIVATE KEY-----";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('secret/API key');
  });

  it('should detect GCP API keys', () => {
const diff = '+ const apiKey = "AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect JWTs', () => {
const diff = '+ const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456ghi789jkl012mno345pqr678stu901";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect Slack user tokens', () => {
const diff = '+ const token = "xoxp-1234567890-1234567890-abcde-fghij";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect API key assignments', () => {
const diff = '+ const api_key = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should not flag benign strings as secrets', () => {
    const diff = `+ const message = "Hello World";\n+ console.log("test");\n+ import fs from 'fs';`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(0);
  });

  it('should detect Discord bot tokens', () => {
    const diff = '+ const token = "' + 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTA5MDEyMzQ1Njc4OTAxMjM0NTY3OAQ' + '.TG9yZW' + '.YXhhbXBsZXRva2Vub25seWZvcnRlc3Rpbmc";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect npm access tokens', () => {
    const diff = '+ const token = "' + 'npm_' + 'ARizGXo5MduBSj0HYp6NevCTk1IZq7OfwDUl";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect npm _authToken leaks', () => {
    const diff = '+ //registry.npmjs.org/:_authToken=' + 'NPM_TOKEN_VALUE_1234567890abc';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect GitHub fine-grained PATs', () => {
    const diff = '+ const token = "' + 'github_pat_' + '11ABCDEFGHIJKLMNOPQRSTUVWXYZ";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect AWS temporary access keys', () => {
    const diff = '+ const key = "' + 'ASIA' + 'IOSFODNN7EXAMPLE";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect PGP private key blocks', () => {
    const diff = '+ const key = "' + '-----BEGIN PGP PRIVATE KEY' + ' BLOCK-----";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect SendGrid API keys', () => {
    const diff = '+ const key = "' + 'SG.1a2b3c4d5e6f7g8h9i0j1k2l' + '.3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect Telegram bot tokens', () => {
    const diff = '+ const key = "' + '1234567890' + ':' + 'ABCdefGHIjklMNOpqrsTUVwxyzABcdefGhiJkLm";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect Slack webhook URLs', () => {
    const diff = '+ const url = "' + 'https://hooks.slack.com/services/' + 'T00000000' + '/B00000000' + '/XXXXXXXXXXXXXXXXXXXXXXXX";';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect YAML-style API key assignments', () => {
    const diff = '+ API_KEY:' + ' 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q';
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });
});
