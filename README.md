<p align="center">
  <img src="assets/soloknuckle-logo.svg" alt="SOLO KNUCKLE" width="560">
</p>

<h1 align="center">Soloknuckle</h1>

<p align="center">
  <strong>Production hygiene for AI-assisted development.</strong><br>
  Catches what AI leaves behind — leaked secrets, destructive commands, flaky tests,
  and 100% coverage that catches 4% of bugs. One command. Zero config. Runs on your
  machine, not someone else's cloud.
</p>

<p align="center">
  <a href="https://github.com/soch-ship-it/soloknuckle/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/soch-ship-it/soloknuckle/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/soloknuckle"><img src="https://img.shields.io/npm/v/soloknuckle" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/soloknuckle"><img src="https://img.shields.io/npm/dm/soloknuckle" alt="npm downloads"></a>
  <img src="https://img.shields.io/badge/tests-428%20passing-brightgreen" alt="428 tests passing">
  <img src="https://img.shields.io/badge/coverage-89%25%20lines-success" alt="coverage">
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/soloknuckle" alt="License: ISC"></a>
  <img src="https://img.shields.io/node/v/soloknuckle" alt="Node.js >= 20">
</p>

<details>
<summary>█▓▒ ASCII banner (for terminal romantics)</summary>

```
 ██████  ██████ ███      █████▄    ███  ██▀███   ██▀██    ██ ██████ ██   █████     ███████
██▀     ██▀  ▄█████    ▄██   ██▄   ▄██▄██  ████▄ ██▄██    ████▄     ██ ███  ██     ██▄
██████▄ ██    ██▄█▄    ▄█▄   ███   ▄███▄   ▄█▄██▄▄█▄▄█    ██▄█▄     ████    ██     ██████
     ██ ██    ██▄█▄    ▄██   ███   ▄██▀█▄  ██▄ ▀███ ██    ██▄█▄     ██ ██▄  ██     ██▀
▄▄▄▄▄█▀ ▀██████ ▀██▄▄▄▄ ██▄▄▄█▀▀   ▄█▄ ▀██▄██▄  ▀██ ▀██████  ██████ ██  ███▄██████▄▀██▄▄▄▄
█▀▀▀▀▀   █▀▀▀▀█  █▀▀▀▀▀ ▀▀▀▀▀▀     ▀▀   ▀▀ ▀▀    █▀  ▀▀▀▀▀▀  ▀▀▀▀▀▀ ▀▀    ▀▄ █▀▀▀▀  ▀▀▀▀▀█
```

</details>

---

## Why Soloknuckle

The gap between "tests pass" and "production is safe" is where bugs live. Soloknuckle closes it:

- **Most tools scan code. Soloknuckle knows who wrote it.** AI-generated commits fail differently than human ones. Soloknuckle detects AI-authored code, tracks acceptance rates, and quarantines repeat offenders — so you review the right things.
- **Most tools warn. Soloknuckle blocks.** Hard gates on security, testing, reliability, and supply chain fail CI with exit code 1 — bad code can't silently merge.
- **Most tools count tests. Soloknuckle counts failures.** Mutation testing breaks your code on purpose and checks whether your tests notice. 100% line coverage can mean 4% bug detection.
- **Most tools trust dependencies. Soloknuckle doesn't.** Typo-squatted names, install-time scripts, missing lockfiles — surfaced before they surface in the news.

---

## Quick Start

Requires **Node.js ≥ 20**. No account, no API key, no config.

```bash
# 1. Initialize (scaffolds git hooks, AGENTS.md, IDE rules)
cd your-project
npx soloknuckle init

# 2. Run pre-flight checks before pushing
npx soloknuckle check

# 3. Enforce hard gates in CI (exits non-zero on failure)
npx soloknuckle check --strict
```

**Recommended CI setup** — add one line to your pipeline:

```yaml
- run: npx soloknuckle check --strict
```

Merges that fail the [hard gates](#hard-gates--strict-mode) are blocked automatically.

---

## Commands Reference

### Core Commands (free, no API key)

| Command | Description | Output |
|---------|-------------|--------|
| `npx soloknuckle init` | Scaffolds AGENTS.md, git hooks, IDE rules, MCP config | Files created in project |
| `npx soloknuckle check` | Pre-flight: lint, test, typecheck, secret scan | Human-friendly score report |
| `npx soloknuckle check --fix` | Auto-fix issues (lint, deps, git, CI, docs) | Fixes applied automatically |
| `npx soloknuckle check --strict` | Enforce hard gates (exit code 1 on failure) | Pass/Fail with minimum thresholds |
| `npx soloknuckle score` | Project health 0–100 across 7 domains | Numeric score + breakdown |
| `npx soloknuckle sbom` | Generate CycloneDX SBOM manifest | JSON SBOM file |
| `npx soloknuckle compliance` | Self-audit against Soloknuckle's own standards | Compliance report |
| `npx soloknuckle telemetry` | AI vs human contribution stats | Stats report |
| `npx soloknuckle persona <type> <folder>` | Agent rules for specific directories | Persona files |
| `npx soloknuckle capabilities` | Machine-readable command list for AI agents | JSON output |
| `npx soloknuckle watch` | Rollback daemon + webhook listener | Daemon process |

### LLM Commands (require an API key or Ollama)

| Command | Description | Cost |
|---------|-------------|------|
| `npx soloknuckle audit` | LLM reviews your uncommitted code | Free (Ollama) or API |
| `npx soloknuckle pr` | Auto-generates PR description from git diff | Free (Ollama) or API |

On the first LLM-command run, Soloknuckle asks for a provider and key (or local Ollama) and stores it in `~/.soloknuckle/config.json` — local only, never uploaded.

---

## 7-Domain Scorecard Model

| Domain | What It Checks | Weight |
|--------|----------------|--------|
| **Code Quality** | Linting, formatting, TypeScript, complexity | 20% |
| **Testing** | Unit tests, E2E tests, coverage | 20% |
| **Security & Compliance** | Secrets, vulnerabilities, auth patterns | 20% |
| **Performance** | Bundle size, lazy loading, optimization | 10% |
| **Reliability** | Error tracking, retries, health checks | 10% |
| **Dependencies & Supply Chain** | Lockfiles, pinned deps, SBOM | 10% |
| **Documentation & Visibility** | README, CHANGELOG, LICENSE | 10% |

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

### Hard Gates (`--strict` mode)

| Gate | Minimum Score | Why It Matters |
|------|---------------|----------------|
| Security | ≥ 70 | No secrets, no critical vulnerabilities |
| Testing | ≥ 70 | Adequate test coverage and quality |
| Reliability | ≥ 60 | Error handling, health checks present |
| Supply Chain | ≥ 50 | Dependencies pinned, lockfile present |

If any gate fails, the command exits with code 1 — perfect for CI/CD pipelines.

---

## Unique Testing Features

These features attack failure modes that AI-assisted development introduces. They run automatically as part of `check --strict` — no extra setup.

### 1. Mutation Testing Gate — the coverage-illusion killer

Applies 5 mutation types (operator, return, boundary, boolean, string) to your source, then checks whether your tests catch them. 100% line coverage can mean 4% bug detection; mutation scoring proves your tests validate *behavior*, not just execution.

### 2. Context-Aware Test Validator — same-model blindness detector

Detects when AI-generated tests share the same blind spots as the code they test: missing mocks, real dependencies hitting the network, no assertions, hardcoded values. When one model writes both implementation and tests, wrong assumptions are wrong in the *same direction*.

### 3. Caller Contract Checker — context-awareness enforcer

Extracts function signatures from source and validates that test calls match reality — parameter counts, types, return types. AI tools test functions in isolation; they don't know the callers or what downstream services consume the return type.

### 4. Flaky Test Detector — the maintenance-cost calculator

Finds flaky patterns (`setTimeout`, `Math.random`, `Date`, network calls), runs tests repeatedly to catch intermittent failures, and estimates the monthly maintenance cost of the flakiness. A 500-test flaky suite can cost ~$360k/month in manual triage.

---

## MCP Server (Model Context Protocol)

Soloknuckle ships with an MCP server so AI coding agents (Claude Desktop, Cursor, Windsurf, etc.) can call its tools directly.

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

`npx soloknuckle init` detects your IDE and creates the right files:

| IDE | File Created | Setup Required |
|-----|--------------|----------------|
| **Cursor** | `.cursorrules` | None — auto-detected |
| **Windsurf** | `.windsurfrules` | None — auto-detected |
| **Claude Code / Gemini CLI** | `SKILL.md` | None — auto-detected |
| **Codex / Lovable / Claude Desktop** | `mcp-config.json` | Import MCP config in settings |
| **Replit** | `.replit` | None — default run command set |
| **Any other IDE** | Paste prompt in chat | See below |

**Universal prompt for any IDE:**

> Before doing anything, read AGENTS.md in the project root. Run `npx soloknuckle capabilities` to see available tools. Always run `npx soloknuckle check` before finishing a task.

---

## LLM Configuration

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

- `sudo rm`, `rm -rf`, `rm -fr`, `rm -r -f`, `rm -f -r`
- `DROP DATABASE`, `DELETE FROM ... WHERE`, `TRUNCATE TABLE`
- `git push --force`, `git push -f`, `git reset --hard`
- `chmod 777`, `chmod -R 777`
- `curl ... | sh`, `wget ... | bash`
- `dd if=... of=/dev/...`
- `mkfs.*`, `mv ... /dev/null`
- Shell redirects (`>>`, `>`, heredoc)

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

GitHub Actions runs on every PR: security audit, typecheck, lint, and the test matrix on Node 22 and 24. Actions are pinned to major versions and the release pipeline requires a repo secret that is never exposed to forks.

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

## Architecture

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
                  ▼                ▼                ▼
              Pre-flight       Filesystem       Rollback Daemon
              checks           (~/.soloknuckle/)  auto-revert
```

---

## Project Structure

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
│   └── ...                   # config, personas, pr-enforcer, budget, ai-watcher
├── test/                     # 27 test suites, 428 tests
├── git-hooks/                # pre-commit, commit-msg hook scripts
├── templates/                # Feature flag templates
├── scripts/                  # Setup + asset generation scripts
├── assets/                   # Logo (SVG + ASCII), generated from source art
├── AGENTS.md                 # Agent behavior rules
├── SKILL.md                  # Claude Code skill definition
└── package.json
```

---

## Testing

```bash
npm test                      # run all 428 tests
npm run test -- --coverage    # with coverage report
```

**Current status:** 428 tests across 27 suites — 89.2% lines, 90.5% functions, 77.0% branches covered.

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

## License

[ISC](./LICENSE) — © Soloknuckle Contributors
