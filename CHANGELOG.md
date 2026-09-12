# Changelog

All notable changes to Soloknuckle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-09-11

### Added

- **`intercept` CLI command** — run a shell command through Soloknuckle's firewall rules; exits `1` when blocked and offers machine-readable `--json` output for agents
- **`guard-install` command** — optionally wrap `rm`, `git`, `chmod`, `dd`, `mkfs`, `curl`, and `wget` in `~/.zshrc` / `~/.bashrc` so raw terminals get Malware-style protection too; `--remove` cleans it up
- **macOS Keychain storage** — prompt-saved LLM API keys are stored in Keychain (`apiKeyRef` marker in config) with a permission-safe fallback; `resolveApiKey()` reads env → stored config → keychain
- **`ai-watch --mark <sha>:ai|human`** — manual overrides in `.soloknuckle/ai-overrides.json`
- **Shared secret scanner** — `scanTextForSecrets` line classifier reused by the compliance hardcoded-secret check over `src/*` and root `.env*`
- **2FA-protected publishing** — every npm publish requires the owner's two-factor authentication (security key / Touch ID); no unattended CI credential can publish

### Fixed

- **Webhook read route was unauthenticated** — `GET /webhooks/incidents` now requires `X-Webhook-Secret`; loud warning when `WEBHOOK_HOST` is set to a non-loopback address
- **Compliance now detects committed `.env` files** (11th check: "No `.env` committed to git")
- **Hardcoded credential assignment detection** + placeholder heuristic so `.env.example` / docs don't self-flag
- **`ai-watch` misclassification** — scoring for AI signatures/bot authors/human authors with high/low confidence
- **`capabilities -f json`** emitted banner noise from dotenv; now real JSON
- **Pre-publish guard** — `prepublishOnly` builds and runs the full test suite before any npm publish
- **`dev` script** — replaced broken `ts-node` with `tsx` (works on Node 24)

## [1.0.0] - 2026-08-19

### Added

- **13-dimension scoring across 7 domains** — quality, testing, security, efficiency, accessibility, dependencies, documentation, git hygiene, CI/CD, feature flags, performance, reliability, supply chain
- **Human-friendly CLI** — `soloknuckle check` with expandable `--fix` commands
- **AI Watcher** — detects AI-authored commits, scans diffs, creates approval/quarantine branches
- **Budget system** — enforce limits on AI agent actions (commits, edits, deploys, API calls)
- **Sentry integration** — auto-detect AI commits as incident culprits, auto-revert, create reports
- **MCP Server** — stdio-based server with 9 tools for AI agent integration
- **Express API** — REST endpoints for scoring and health checks
- **React dashboard** — neo-brutalist UI for visualizing scores
- **Secret scanner** — detects API keys, passwords, tokens, PII in code
- **Agent guardrails** — requires AGENTS.md, .cursorrules, or SKILL.md for AI coding
- **Configurable weights** — customize dimension importance via `.soloknuckle/score-weights.json`
- **Zero-config setup** — `npx soloknuckle init` just works
- **Landing page** — SEO-optimized, deployable to Netlify/Vercel/GitHub Pages/Render
- **CI pipeline** — GitHub Actions with Node 22/24 matrix, security audit, typecheck, lint, tests
- **Test suite** — unit tests for CLI, scorer, API, MCP, scanner, and webhook logic
- **ISC license** — free forever, no accounts, no cloud

### Security

- No secrets in code
- No PII in logs
- Input validation on all endpoints
- Webhook signature verification
- Timing-safe comparison for secrets
