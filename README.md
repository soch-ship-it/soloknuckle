# Soloknuckle — Production Hygiene for AI-Assisted Development

<p align="center">
  <img src="assets/soloknuckle-logo.svg" alt="SOLO KNUCKLE wordmark" width="560">
</p>

**Soloknuckle** is a free, open-source CLI that runs [production hygiene](#core-commands-free-no-api-key) checks — secret scanning, a destructive-command firewall, mutation testing, AI-vs-human telemetry, and hard CI gates — on Node.js projects before they ship. One command (`npx soloknuckle init`), zero config, everything runs locally on Node.js 20+.

It is built for **AI-assisted development**: code written or reviewed by Cursor, Claude Code, Copilot, Windsurf, or any coding agent. Those tools ship fast and fail in specific, repeatable ways — leaked API keys, `rm -rf` in a shell step, tests that pass without testing anything, dependencies nobody pinned. Soloknuckle catches exactly those failure modes before they reach production.

<p align="center">
  <a href="https://github.com/soch-ship-it/soloknuckle/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/soch-ship-it/soloknuckle/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/soloknuckle"><img src="https://img.shields.io/npm/v/soloknuckle" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/soloknuckle"><img src="https://img.shields.io/npm/dm/soloknuckle" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/tests-467%20passing-brightgreen" alt="467 tests passing">
  <img src="https://img.shields.io/badge/coverage-89%25%20lines-success" alt="coverage">
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/soloknuckle" alt="License: ISC"></a>
  <img src="https://img.shields.io/node/v/soloknuckle" alt="Node.js >= 20">
</p>

---

## Table of Contents

- [Quick Start](#quick-start)
- [What Soloknuckle Actually Does](#what-soloknuckle-actually-does)
- [Commands Reference](#commands-reference)
- [7-Domain Scorecard](#7-domain-scorecard)
- [Hard Gates (`--strict`)](#hard-gates--strict)
- [Unique Testing Features](#unique-testing-features)
- [MCP Server for AI Agents](#mcp-server-for-ai-agents)
- [IDE Integration](#ide-integration)
- [LLM Configuration (Optional)](#llm-configuration-optional)
- [Security](#security)
- [What Soloknuckle Does NOT Do](#what-soloknuckle-does-not-do)
- [Who Is It For](#who-is-it-for)
- [Architecture & Project Structure](#architecture--project-structure)
- [Testing](#testing)
- [Updating](#updating)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)

---

## Quick Start

```bash
# 1. Initialize (scaffolds git hooks, AGENTS.md, IDE rules)
cd your-project
npx soloknuckle init

# 2. Run pre-flight checks before pushing
npx soloknuckle check

# 3. Enforce hard gates in CI (exits non-zero on failure)
npx soloknuckle check --strict
```

Requires Node.js ≥ 20. No account, no API key, no config.

**Add to CI (one line):**

```yaml
- run: npx soloknuckle check --strict
```

Merges that fail the [hard gates](#hard-gates--strict) are blocked automatically.

---

## What Soloknuckle Actually Does

Five things, all local, all free:

| Capability | What it means in practice |
|---|---|
| **Secret scanning** | Scans staged code and diffs for API keys, tokens, and PII before commit/push |
| **Command firewall** | Blocks destructive patterns — `rm -rf`, `git push --force`, `chmod 777`, `curl \| sh`, SQL drops — before they execute |
| **Mutation testing gate** | Breaks your code on purpose (5 mutation types), then checks whether your tests notice. Exposes "100% coverage, 4% bug detection" |
| **AI vs human telemetry** | Tracks how much of your codebase is AI-authored, per week, and flags repeat-offender patterns |
| **Hard CI gates** | Four minimum scores (security, testing, reliability, supply chain) — failing CI exits non-zero so bad merges are blocked |

Everything else — SBOM, scorecard, PR descriptions, flaky detection, rollback webhooks — builds on those five.

---

## Commands Reference

### Core Commands (free, no API key)

| Command | Description | Output |
|---------|-------------|--------|
| `npx soloknuckle init` | Scaffolds AGENTS.md, git hooks, IDE rules (only for detected editors; `--all-ides` forces all) | Files created in project |
| `npx soloknuckle check` | Pre-flight: lint, test, typecheck, secret scan | Score report |
| `npx soloknuckle check --fix` | Auto-fix issues (lint, tests, deps, git, CI, docs, supply chain, reliability) | Fixes applied |
| `npx soloknuckle check --strict` | Enforce hard gates (exit code 1 on failure) | Pass/Fail per gate |
| `npx soloknuckle score` | Project health 0–100 across 7 domains | Numeric score + breakdown |
| `npx soloknuckle sbom` | Generate CycloneDX SBOM manifest | JSON SBOM file |
| `npx soloknuckle compliance` | Self-audit against Soloknuckle's own standards | Compliance report |
| `npx soloknuckle telemetry` | AI vs human contribution stats | Stats report |
| `npx soloknuckle ai-watch` | Track AI-authored commits and quarantine them (runs in pre-commit) | Quarantine/approval branch |
| `npx soloknuckle persona <type> <folder>` | Agent rules for specific directories (text; `-f json` for a manifest) | Persona files or JSON |
| `npx soloknuckle capabilities` | Command registry for AI agents (`-f text`, default, or `-f json`) | Text list or JSON |
| `npx soloknuckle watch` | Rollback daemon + webhook listener | Daemon process |

### LLM Commands (require an API key or Ollama)

| Command | Description | Cost |
|---------|-------------|------|
| `npx soloknuckle audit` | LLM reviews your uncommitted code | Free (Ollama) or API |
| `npx soloknuckle pr` | Auto-generates PR description from git diff | Free (Ollama) or API |

On the first LLM-command run, Soloknuckle asks for a provider and key (or local Ollama) and stores it in `~/.soloknuckle/config.json` — local only, never uploaded.

---

## 7-Domain Scorecard

```
┌─────────────────────────────────────────┐
│  7-Domain Scorecard                     │
│  Code Quality        ████████░░  85/100 │
│  Testing             ██████████  100/100│
│  Security            ███████░░░  72/100 │
│  Performance         ████████░░  88/100 │
│  Reliability         ███████░░░  78/100 │
│  Supply Chain        ██████░░░░  65/100 │
│  Documentation       ███████░░░  75/100 │
│                                         │
│  Overall: 82/100 — Production Ready ✓   │
└─────────────────────────────────────────┘
```

| Domain | What It Checks | Weight |
|--------|----------------|--------|
| **Code Quality** | Linting, formatting, TypeScript, complexity | 20% |
| **Testing** | Unit tests, E2E tests, coverage | 20% |
| **Security & Compliance** | Secrets, vulnerabilities, auth patterns | 20% |
| **Performance** | Bundle size, lazy loading, optimization | 10% |
| **Reliability** | Error tracking, retries, health checks | 10% |
| **Dependencies & Supply Chain** | Lockfiles, pinned deps, SBOM | 10% |
| **Documentation & Visibility** | README, CHANGELOG, LICENSE | 10% |

---

## Hard Gates (`--strict`)

| Gate | Minimum Score | Why It Matters |
|------|---------------|----------------|
| Security | ≥ 70 | No secrets, no critical vulnerabilities |
| Testing | ≥ 70 | Adequate test coverage and quality |
| Reliability | ≥ 60 | Error handling, health checks present |
| Supply Chain | ≥ 50 | Dependencies pinned, lockfile present |

If any gate fails, the command exits with code 1 — perfect for CI/CD pipelines.

---

## Unique Testing Features

These four features attack failure modes that AI-assisted development introduces. They run automatically as part of `check --strict` — no extra setup.

### 1. Mutation Testing Gate — the coverage-illusion killer

Applies 5 mutation types (operator, return, boundary, boolean, string) to your source, then checks whether your tests catch them. 100% line coverage can mean 4% bug detection; mutation scoring proves your tests validate *behavior*, not just execution.

### 2. Context-Aware Test Validator — same-model blindness detector

Detects when AI-generated tests share the same blind spots as the code they test: missing mocks, real dependencies hitting the network, no assertions, hardcoded values. When one model writes both implementation and tests, wrong assumptions are wrong in the *same direction*.

### 3. Caller Contract Checker — context-awareness enforcer

Extracts function signatures from source and validates that test calls match reality — parameter counts, types, return types. AI tools test functions in isolation; they don't know the callers or what downstream services consume the return type.

### 4. Flaky Test Detector — the maintenance-cost calculator

Finds flaky patterns (`setTimeout`, `Math.random`, `Date`, network calls), runs tests repeatedly to catch intermittent failures, and estimates the monthly maintenance cost of the flakiness. A 500-test flaky suite can cost ~$360k/month in manual triage.

---

## MCP Server for AI Agents

Soloknuckle ships with an [Model Context Protocol](https://modelcontextprotocol.io) server so AI coding agents (Claude Desktop, Cursor, Windsurf, etc.) can call its tools directly.

```json
{
  "mcpServers": {
    "soloknuckle": {
      "command": "npx",
      "args": ["soloknuckle-mcp"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `soloknuckle_score` | Project health score (0–100) with per-domain breakdown |
| `soloknuckle_telemetry` | AI vs human contribution telemetry |
| `soloknuckle_intercept` | Check if a shell command is safe or destructive |
| `soloknuckle_secrets` | Scan a git diff for secrets, API keys, and PII |
| `soloknuckle_flags` | Read all feature flags and their state |
| `soloknuckle_flag_set` | Enable or disable a feature flag |
| `soloknuckle_supply_chain_sentinel` | Scan dependencies for typosquats and hostile packages |
| `soloknuckle_suggest` | AI-powered improvement suggestions |
| `soloknuckle_branches` | List local git branches |

### Example: agent checks the score before coding

```
Agent:  soloknuckle_score
Server: { "overall": 82, "quality": 90, "testing": 100, "security": 70, ... }
Agent:  "Security is low. Let me check for secrets..."
Agent:  soloknuckle_secrets { "diff": "" }
Server: { "clean": false, "violations": ["Line 5: Potential secret detected"] }
Agent:  "Found a secret. Fixing it before proceeding."
```

---

## IDE Integration

`npx soloknuckle init` detects which agent/editor is actually present in your project and only scaffolds files for the ones you use. Run with `--all-ides` to force the full set. If no IDE is detected, the defaults are scaffolded so a fresh project is immediately agent-ready.

| IDE | File Created | Setup Required |
|-----|--------------|----------------|
| **Cursor** | `.cursorrules` | None — auto-detected |
| **Windsurf** | `.windsurfrules` | None — auto-detected |
| **Claude Code / Gemini CLI** | `SKILL.md` | None — auto-detected |
| **Codex / Lovable / Claude Desktop** | `mcp-config.json` | Import MCP config in settings |
| **Replit** | `.replit` | None — default run command set |
| **Any other IDE** | Paste prompt in chat | See below |

If the project isn't a git repository, `init` prints a warning and skips hook installation until `git init` has been run.

**Universal prompt for any IDE:**

> Before doing anything, read AGENTS.md in the project root. Run `npx soloknuckle capabilities` to see available tools. Always run `npx soloknuckle check` before finishing a task.

---

## LLM Configuration (Optional)

Only needed for `audit` and `pr`. Everything else works with zero configuration.

### Option A: Ollama (free, local)

```bash
brew install ollama        # or: https://ollama.com/download
ollama pull llama3
npx soloknuckle audit      # choose "Ollama (Local)" on first run
```

### Option B: Cloud API

```bash
npx soloknuckle audit      # choose OpenAI / Anthropic / Gemini / ... on first run
# enter your API key when prompted — stored in ~/.soloknuckle/config.json
```

**Supported providers:** OpenAI, Anthropic, Google Gemini, Ollama, Azure OpenAI, DeepSeek, Groq, Mistral, OpenRouter, Together AI, xAI

---

## Security

### What it protects against

| Threat | Mitigation |
|--------|------------|
| Secret leakage | Scans for API keys, tokens, credentials in code and diffs |
| Destructive commands | Firewall blocks `rm -rf`, `git push --force`, SQL drops |
| Path traversal | Persona system validates directory boundaries |
| API key exposure | Keys stored locally, never committed to git |
| Bad merges | Rollback daemon auto-reverts AI-authored bugs |
| Unpinned deps | Dependency scanning surfaces transitive audit warnings |

### Command firewall patterns

The interceptor blocks these destructive patterns:

- `sudo rm`, `rm -rf`, `rm -fr`, `rm -r -f`, `rm -f -r` — including uppercase variants (`rm -Rf`, `rm -fR`) and long-form `rm --recursive --force`
- `DROP DATABASE` / `DROP TABLE` / `DROP SCHEMA`, `DELETE FROM` (without a `WHERE` guard), `TRUNCATE TABLE`
- `git push --force`, `git push -f`, `git push --force-with-lease` (incl. case-insensitive), `git reset --hard`, `git clean -fd`
- `chmod 777`, `chmod -R 777`, `chmod a+rwx`, `chmod o+w`, `chmod a=rwx`
- `curl ... | sh`, `wget ... | bash` — also `zsh`, `ksh`, `csh`, `tcsh`, `fish`, `dash`
- `dd if=... of=/dev/...`, `mkfs.*`, `mv ... /dev/null`
- Shell redirects — `>` / `>>` to absolute or relative paths, heredocs (`<<`), pipes to `tee`, and `sudo <cmd> >`

### Package integrity

| Protection | How It Works |
|------------|--------------|
| **npm provenance** | Releases are published by GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) — every artifact is cryptographically tied to the source commit and workflow |
| **Verifiable signatures** | `npm audit signatures` verifies registry signatures on every install |
| **Tag-gated releases** | Publishing only happens from `v*` tags that match `package.json`, after the full test gate passes |

### Install-time hardening (recommended for consumers)

Soloknuckle can't change your npm settings, but it recommends hardening your own installs:

```ini
# .npmrc
ignore-scripts=true      # block malicious install scripts
allow-git=none           # block git operations during install
```

```bash
npm audit signatures     # verify package signatures
npm audit                # check for known vulnerabilities
```

### Runtime safety

- **Local-only** — nothing is sent to external services. Config lives in `~/.soloknuckle/`; telemetry, watch, and budget data live in your project's `.soloknuckle/`
- **No phone-home** — no usage telemetry, no PII collection
- Cloud LLM calls happen only if you explicitly configure `audit`/`pr` with a provider

### CI

GitHub Actions runs on every PR: security audit, typecheck, lint, and the test matrix on Node 22 and 24. Release publishing uses a repo secret that is never exposed to forks, and npm provenance ties every artifact to this repository.

### Responsible disclosure

Found a security vulnerability? Please report it privately — see [SECURITY.md](SECURITY.md).

---

## What Soloknuckle Does NOT Do

- **Not a hosting provider** — manages rollbacks conceptually via Vercel/Railway, doesn't host code
- **Not a CI pipeline** — use GitHub Actions for remote validation; Soloknuckle is the gate inside it
- **Doesn't write your code** — it's a hygiene layer; you write the features
- **Doesn't send your code anywhere** — all checks run locally unless you explicitly enable a cloud LLM for `audit`/`pr`

---

## Who Is It For

| Persona | Pain Point | How Soloknuckle Helps |
|---------|-----------|----------------------|
| **Solo founders** | No QA team, shipping fast with AI | Pre-flight gate catches what AI misses before it ships |
| **AI-assisted teams** | Don't know how much code is AI-written | Telemetry tracks AI vs human contributions per week |
| **Open-source maintainers** | Contributors submit AI-generated code | `--strict` enforces quality gates in CI |
| **Agencies & consultancies** | Client projects must be production-ready | 7-domain scorecard proves quality with numbers |

---

## Architecture & Project Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SOLOKNUCKLE CLI                              │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  init    │  │  check   │  │  score   │  │  audit   │             │
│  │ (scaffold│  │(pre-     │  │(health   │  │  (LLM    │             │
│  │  hooks)  │  │ flight)  │  │  0-100)  │  │  review) │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │              │              │              │                 │
│       ▼              ▼              ▼              ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    CORE MODULES                              │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ scanner    │  │ interceptor│  │  scorer    │              │   │
│  │  │ (secret    │  │ (command   │  │ (project   │              │   │
│  │  │  detection)│  │  firewall) │  │  health)   │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │ config     │  │ telemetry  │  │  rollback  │              │   │
│  │  │ (provider  │  │ (AI vs     │  │ (auto      │              │   │
│  │  │  registry) │  │  human)    │  │  revert)   │              │   │
│  │  └────────────┘  └────────────┘  └────────────┘              │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │          MCP SERVER (agents) + WEBHOOKS              │    │   │
│  │  │  POST /webhooks/rollback → disable a feature flag    │    │   │
│  │  │  POST /webhooks/sentry   → auto-revert AI culprit    │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────┐
                         │   DATA FLOW     │
                         └─────────────────┘

User/Agent ──▶ CLI Command ──▶ Core Module ──▶ Git Hooks / Webhooks
                  │                │                │
                  ▼                ▼                ▢
              Pre-flight       Filesystem       Rollback Daemon
              checks           (~/.soloknuckle/)  auto-revert
```

```
soloknuckle/
├── cli/                      # Core CLI modules
│   ├── index.ts              # Entry point + command router
│   ├── check.ts              # Pre-flight orchestration + gates
│   ├── scanner.ts            # Secret detection engine
│   ├── interceptor.ts        # Command firewall
│   ├── scorer/               # Project health scoring (13 dimensions, 7 domains)
│   ├── gates.ts              # Hard gate evaluation + scorecard
│   ├── mutation.ts           # Mutation testing gate
│   ├── context-validator.ts  # Context-aware test validator
│   ├── caller-contract.ts    # Caller contract checker
│   ├── flaky-detector.ts     # Flaky test detector
│   ├── supply-chain-sentinel.ts  # Dependency typosquat scanner
│   ├── sbom.ts               # CycloneDX SBOM generation
│   ├── compliance.ts         # Self-compliance audit
│   ├── llm-client.ts         # Multi-provider LLM client
│   ├── telemetry.ts          # AI vs human tracking
│   ├── rollback.ts           # Auto-rollback daemon + webhooks
│   ├── mcp-server.ts         # MCP server for AI agents
│   ├── ai-watcher.ts         # AI-commit tracking + quarantine branches
│   ├── personas.ts           # Per-directory bounded-context rules
│   ├── pr-enforcer.ts        # Strict PR description generator
│   └── budget.ts             # Agent budget tracking
├── test/                     # 28 test suites, 467 tests
├── git-hooks/                # pre-commit, commit-msg hook scripts
├── templates/                # Feature flag templates + example flags.json
├── scripts/                  # Setup + asset generation scripts
├── assets/                   # Logo (SVG + ASCII), generated from source art
├── AGENTS.md                 # Agent behavior rules
├── SKILL.md                  # Claude Code skill definition
└── package.json
```

---

## Testing

```bash
npm test                      # run all 467 tests
npm run test -- --coverage    # with coverage report
```

**Current status:** 467 tests across 28 suites — 89.2% lines, 90.4% functions, 77.1% branches covered.

Every release is gated: the [release workflow](.github/workflows/release.yml) runs the full suite, typecheck, and lint before anything touches npm.

---

## Updating

```bash
# via npx — always gets latest
npx soloknuckle check

# as a dev dependency
npm update soloknuckle --save-dev
```

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup:

```bash
git clone https://github.com/soch-ship-it/soloknuckle.git
cd soloknuckle
npm install
npm test
```

Please run `npx soloknuckle check` on your own PRs. Soloknuckle practices what it preaches — `npx soloknuckle compliance` audits this repo against its own standards.

---

## FAQ

**Is Soloknuckle free?**
Yes — all core commands are free and open source (ISC). The two LLM commands (`audit`, `pr`) work free with local Ollama, or with your own API key.

**Does my code leave my machine?**
No. All checks run locally. The only network calls happen when you explicitly configure a cloud LLM provider for `audit`/`pr`.

**Which AI tools does it work with?**
Any that read files or run commands: Cursor, Claude Code, Copilot, Windsurf, Gemini CLI, Codex, Replit Agent, Lovable, and plain terminal agents. The MCP server adds native tool-calling for clients that support it.

**Does it replace CI?**
No — it runs *inside* your CI as a quality gate. Use GitHub Actions/GitLab CI for orchestration; Soloknuckle is the check that fails the build when hygiene standards aren't met.

**What languages does it support?**
Soloknuckle itself is TypeScript. Its checks are language-agnostic where possible (git hooks, secrets, commands) and TypeScript-aware where deep analysis helps. If your project runs on Node.js 20+, the CLI runs.

**How is this different from ESLint or Snyk?**
Linters check style; Snyk checks CVEs. Soloknuckle adds what neither covers: mutation testing, AI-vs-human telemetry, a destructive-command firewall, and cross-domain hard gates with exit codes your CI can enforce.

**Why "Soloknuckle"?**
Built for solo founders and small teams who move fast with AI and need a knuckle-dragging gatekeeper that refuses to let bad code through.

---

## License

[ISC](./LICENSE) — © Soloknuckle Contributors
