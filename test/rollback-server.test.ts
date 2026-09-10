import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';

const TEST_DIR = path.join(os.tmpdir(), 'soloknuckle-rollback-server');
const ORIGINAL_CWD = process.cwd;
let execSyncMock: ReturnType<typeof vi.fn>;

vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => execSyncMock(...args),
}));

describe('real rollback server (createRollbackServer)', () => {
  let app: Express;
  let flagsPath: string;

  beforeEach(async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    flagsPath = path.join(TEST_DIR, 'flags.json');
    process.cwd = () => TEST_DIR;
    process.env.WEBHOOK_SECRET = 'test-secret';
    execSyncMock = vi.fn(() => '');
    const { createRollbackServer } = await import('../cli/rollback');
    app = createRollbackServer();
  });

  afterEach(() => {
    process.cwd = ORIGINAL_CWD;
    delete process.env.WEBHOOK_SECRET;
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  function disableRequest(flagName: string, body = { flagName }) {
    return request(app).post('/webhooks/rollback').set('x-webhook-secret', 'test-secret').send(body);
  }

  function postRaw(urlPath: string, extraHeaders: Record<string, string>, rawBody: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as { port: number };
        let body = '';
        const http = require('http');
        const req = http.request({
          hostname: '127.0.0.1',
          port: address.port,
          method: 'POST',
          path: urlPath,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(rawBody),
            ...extraHeaders,
          },
        }, (res) => {
          res.on('data', (c: Buffer) => (body += c));
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode ?? 0, body });
          });
        });
        req.on('error', (err: Error) => {
          server.close();
          reject(err);
        });
        req.end(rawBody);
      });
    });
  }

  describe('/webhooks/rollback', () => {
    it('disables a valid flag', async () => {
      fs.writeFileSync(flagsPath, JSON.stringify({ 'export-csv': true, 'dark-mode': true }));
      const res = await disableRequest('export-csv');
      expect(res.status).toBe(200);
      const flags = JSON.parse(fs.readFileSync(flagsPath, 'utf-8'));
      expect(flags['export-csv']).toBe(false);
      expect(flags['dark-mode']).toBe(true);
    });

    it('rejects missing secret', async () => {
      fs.writeFileSync(flagsPath, JSON.stringify({ 'export-csv': true }));
      const res = await request(app).post('/webhooks/rollback').send({ flagName: 'export-csv' });
      expect(res.status).toBe(401);
    });

    it('rejects invalid secret', async () => {
      fs.writeFileSync(flagsPath, JSON.stringify({ 'export-csv': true }));
      const res = await request(app).post('/webhooks/rollback')
        .set('x-webhook-secret', 'wrong').send({ flagName: 'export-csv' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when flagName is missing or not a string', async () => {
      const missing = await request(app).post('/webhooks/rollback')
        .set('x-webhook-secret', 'test-secret').send({});
      expect(missing.status).toBe(400);
      const notString = await request(app).post('/webhooks/rollback')
        .set('x-webhook-secret', 'test-secret').send({ flagName: 123 });
      expect(notString.status).toBe(400);
    });

    it('returns 400 for path traversal flag names', async () => {
      const res = await disableRequest('../etc');
      expect(res.status).toBe(400);
    });

    it('returns 404 when flags.json is missing', async () => {
      const res = await disableRequest('x');
      expect(res.status).toBe(404);
    });

    it('returns 400 when the flag does not exist', async () => {
      fs.writeFileSync(flagsPath, JSON.stringify({ other: true }));
      const res = await disableRequest('missing');
      expect(res.status).toBe(400);
    });

    it('returns 500 on corrupt flags.json', async () => {
      fs.writeFileSync(flagsPath, '{ not json');
      const res = await disableRequest('x');
      expect(res.status).toBe(500);
    });
  });

  describe('/webhooks/sentry', () => {
    function sentryPost(payload: Record<string, unknown>) {
      return request(app).post('/webhooks/sentry')
        .set('x-webhook-secret', 'test-secret')
        .send(payload);
    }

    it('records an incident without an AI culprit', async () => {
      const res = await sentryPost({ data: { issue: { id: '1', title: 'Boom', level: 'error' } } });
      expect(res.status).toBe(200);
      expect(res.body.incident.aiRelated).toBe(false);
      const incidents = JSON.parse(fs.readFileSync(path.join(TEST_DIR, '.soloknuckle', 'incidents.json'), 'utf-8'));
      expect(incidents).toHaveLength(1);
      expect(incidents[0].title).toBe('Boom');
    });

    it('auto-reverts an AI-authored commit on success', async () => {
execSyncMock.mockImplementation((cmd: string) => {
        if (cmd.startsWith('git log')) return 'abc123|||fix: thing (ai-generated)\n';
        if (cmd.includes('git branch revert/')) return '';
        if (cmd.includes('git revert')) return 'Revert "fix: thing (ai-generated)"\n';
        if (cmd.includes('git rev-parse HEAD')) return 'revert-sha-123\n';
        return '';
      });
      const res = await sentryPost({ data: { issue: { id: '2', title: 'Issue', level: 'critical' } } });
      expect(res.body.incident.aiRelated).toBe(true);
      expect(res.body.incident.reverted).toBe(true);
      const incidents = JSON.parse(fs.readFileSync(path.join(TEST_DIR, '.soloknuckle', 'incidents.json'), 'utf-8'));
      expect(incidents[0].aiRelated).toBe(true);
      expect(incidents[0].revertedCommit).toBe('revert-sha-123');
      expect(incidents[0].prCreated).toBe(true);
      expect(fs.readdirSync(path.join(TEST_DIR, '.soloknuckle')).some((f) => f.startsWith('rollback-report-'))).toBe(true);
    });

    it('marks AI-related incident as not reverted when revert fails', async () => {
      execSyncMock.mockImplementation((cmd: string) => {
        if (cmd.startsWith('git log')) return 'abc321|||fix regression (ai-generated)\n';
        if (cmd.includes('git branch revert/')) return '';
        if (cmd.includes('git revert') && !cmd.includes('abort')) throw new Error('CONFLICT');
        return '';
      });
      const res = await sentryPost({ data: { issue: { id: '3', title: 'Issue', level: 'error' } } });
      expect(res.status).toBe(200);
      expect(res.body.incident.aiRelated).toBe(true);
      expect(res.body.incident.reverted).toBe(false);
    });

    it('returns 401 without a secret', async () => {
      const res = await request(app).post('/webhooks/sentry').send({ data: { issue: { id: '4' } } });
      expect(res.status).toBe(401);
    });

    it('accepts sentry-style HMAC header', async () => {
      const body = JSON.stringify({ data: { issue: { id: '5', title: 'T' } } });
      const hmac = crypto.createHash('sha256').update('test-secret').update(body).digest('hex');
      const res = await postRaw('/webhooks/sentry', { 'x-sentry-webhook-hmac-sha256': hmac }, body);
      expect(res.status).toBe(200);
    });

    it('accepts github-style hub signature header', async () => {
      const body = JSON.stringify({ data: { issue: { id: '6', title: 'T' } } });
      const signature = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
      const res = await postRaw('/webhooks/sentry', { 'x-hub-signature-256': signature }, body);
      expect(res.status).toBe(200);
    });

    it('returns 401 when the HMAC does not match', async () => {
      const body = JSON.stringify({ data: { issue: { id: '7', title: 'T' } } });
      const res = await postRaw('/webhooks/sentry', { 'x-sentry-webhook-hmac-sha256': 'deadbeef' }, body);
      expect(res.status).toBe(401);
    });

    it('returns 400 for unparseable payload', async () => {
      const res = await sentryPost({ random: 'data' });
      expect(res.status).toBe(400);
    });
  });

  describe('/webhooks/incidents', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/webhooks/incidents');
      expect(res.status).toBe(401);
    });

    it('returns saved incidents and handles corrupt file as empty', async () => {
      const empty = await request(app).get('/webhooks/incidents').set('x-webhook-secret', 'test-secret');
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual([]);

      const dir = path.join(TEST_DIR, '.soloknuckle');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'incidents.json'), '{ nope');
      const corrupt = await request(app).get('/webhooks/incidents').set('x-webhook-secret', 'test-secret');
      expect(corrupt.status).toBe(200);
      expect(corrupt.body).toEqual([]);
    });
  });
});