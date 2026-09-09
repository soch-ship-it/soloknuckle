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
    const diff = `+ const accessKey = "REDACTED";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('secret/API key');
  });

  it('should detect GitHub personal access tokens', () => {
    const diff = `+ const token = "REDACTED";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('secret/API key');
  });

  it('should detect GitHub OAuth tokens', () => {
    const diff = `+ const token = "REDACTED";`;
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
    const diff = `+ const apiKey = "REDACTED";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect JWTs', () => {
    const diff = `+ const token = "REDACTED";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect Slack user tokens', () => {
    const diff = `+ const token = "REDACTED";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should detect API key assignments', () => {
    const diff = `+ const api_key = "REDACTED";`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(1);
  });

  it('should not flag benign strings as secrets', () => {
    const diff = `+ const message = "Hello World";\n+ console.log("test");\n+ import fs from 'fs';`;
    const violations = scanDiffForSecretsAndPII(diff);
    expect(violations).toHaveLength(0);
  });
});
