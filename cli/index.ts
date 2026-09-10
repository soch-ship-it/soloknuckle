#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { scanDiffForSecretsAndPII } from './scanner';
import { applyPersona, applyPersonaManifest, PersonaType } from './personas';
import { generatePRDescription } from './pr-enforcer';
import { initWebhookListener } from './rollback';
import { logTelemetry, getTelemetry } from './telemetry';
import { getOrPromptApiKey } from './config';
import { callLLM } from './llm-client';
import { calculateMetrics, generateSuggestions } from './scorer';
import { runCheck } from './check';
import { generateSbom, writeSbom } from './sbom';
import { runCompliance, printComplianceReport } from './compliance';
import { getVersion } from './path-utils';
import { printBanner } from './banner';
import { watchCommit, watchRecentCommits, getWatcherSummary, loadWatcherData } from './ai-watcher';

const program = new Command();

program
  .name('soloknuckle')
  .description('Production Hygiene Kit & Agent Firewall for any project')
  .version(getVersion());

// Multi-pronged capabilities registry
const CAPABILITIES: Array<{ name: string; arguments: string; description: string; requiresLlm: boolean }> = [
  { name: 'check', arguments: '[options]', description: 'Runs strict pre-flight checks (lint, test, typecheck, secret scan). Supports --strict for hard gates and --fix for auto-fixes. MUST be run before any git commit.', requiresLlm: false },
  { name: 'audit', arguments: '', description: 'Analyzes local uncommitted code against AGENTS.md rules using an LLM.', requiresLlm: true },
  { name: 'score', arguments: '', description: 'Calculates a 0-100 project health score across 7 weighted domains.', requiresLlm: false },
  { name: 'init', arguments: '', description: 'Scaffolds hooks and rules for any project (AGENTS.md, git hooks, IDE configs).', requiresLlm: false },
  { name: 'pr', arguments: '', description: 'Auto-generates a PR description from a git diff using an LLM.', requiresLlm: true },
  { name: 'persona', arguments: '<type> <folder>', description: 'Applies bounded-context agent rules to specific directories.', requiresLlm: false },
  { name: 'sbom', arguments: '[-o path]', description: 'Generates a CycloneDX SBOM from your dependencies.', requiresLlm: false },
  { name: 'compliance', arguments: '', description: 'Audits your codebase for production hygiene compliance.', requiresLlm: false },
  { name: 'telemetry', arguments: '', description: 'Shows AI vs human contribution telemetry.', requiresLlm: false },
  { name: 'ai-watch', arguments: '[count]', description: 'Tracks AI-authored commits, scans their diffs, and creates approval/quarantine branches.', requiresLlm: false },
  { name: 'capabilities', arguments: '[-f json|text]', description: 'Lists every command available to AI agents in machine-readable form.', requiresLlm: false },
  { name: 'watch', arguments: '', description: 'Starts the rollback daemon and webhook listener.', requiresLlm: false },
];

// IDE agent configs, each gated on whether the target project actually uses that tool.
type IdeDef = {
  name: string;
  markers: string[];
  create: (target: string, agentInstructions: string) => void;
};

const IDE_DEFINITIONS: IdeDef[] = [
  {
    name: 'Cursor',
    markers: ['.cursor', '.cursorrules'],
    create(target, agentInstructions) {
      const path_ = path.join(target, '.cursorrules');
      if (!fs.existsSync(path_)) {
        fs.writeFileSync(path_, agentInstructions);
        console.log(chalk.green('✅ Created .cursorrules for Cursor AI'));
      }
    },
  },
  {
    name: 'Windsurf',
    markers: ['.windsurf', '.windsurfrules'],
    create(target, agentInstructions) {
      const path_ = path.join(target, '.windsurfrules');
      if (!fs.existsSync(path_)) {
        fs.writeFileSync(path_, agentInstructions);
        console.log(chalk.green('✅ Created .windsurfrules for Windsurf IDE'));
      }
    },
  },
  {
    name: 'Claude Code / Antigravity / Gemini',
    markers: ['SKILL.md', '.claude'],
    create(target, agentInstructions) {
      const path_ = path.join(target, 'SKILL.md');
      if (!fs.existsSync(path_)) {
        const skillContent = `---
name: production-hygiene-enforcer
description: Enforces safe deployment rules and hygiene practices.
---
# Instructions
${agentInstructions}`;
        fs.writeFileSync(path_, skillContent);
        console.log(chalk.green('✅ Created SKILL.md for Claude Code / Antigravity / Gemini'));
      }
    },
  },
  {
    name: 'Replit',
    markers: ['.replit'],
    create(target) {
      const path_ = path.join(target, '.replit');
      if (!fs.existsSync(path_)) {
        fs.writeFileSync(path_, 'run = "npx soloknuckle check"\n');
        console.log(chalk.green('✅ Created .replit config for Replit Agent'));
      }
    },
  },
  {
    name: 'ChatGPT Codex / Lovable / Claude Desktop',
    markers: ['mcp-config.json', '.mcp.json', '.codex', '.gemini'],
    create(target) {
      const path_ = path.join(target, 'mcp-config.json');
      if (!fs.existsSync(path_)) {
        const mcpContent = JSON.stringify({
          mcpServers: {
            soloknuckle: {
              command: "npx",
              args: ["-y", "soloknuckle-mcp"]
            }
          }
        }, null, 2);
        fs.writeFileSync(path_, mcpContent);
        console.log(chalk.green('✅ Created mcp-config.json for ChatGPT Codex / Lovable / Claude Desktop integration'));
      }
    },
  },
];

function detectIdes(target: string): string[] {
  return IDE_DEFINITIONS
    .filter((ide) => ide.markers.some((marker) => fs.existsSync(path.join(target, marker))))
    .map((ide) => ide.name);
}

// Extracted init logic — used by both the default handler and the init command
function runInit(target: string, allIdes = false): void {
  printBanner();
  console.log(chalk.green('🚀 Initializing Soloknuckle Production Hygiene Kit...'));
  console.log(chalk.blue(`Target directory: ${target}`));

  // Core Rules
  const agentsMdPath = path.join(target, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath)) {
    fs.writeFileSync(agentsMdPath, '# Production Hygiene Rules\n\n1. Do not push to main.\n2. Use feature flags.');
    console.log(chalk.green('✅ Created AGENTS.md'));
  }

  // Git Hooks (via Husky compatibility or native)
  const hooksDir = path.join(target, '.git', 'hooks');
  if (fs.existsSync(path.join(target, '.git'))) {
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
    const prePushPath = path.join(hooksDir, 'pre-push');
    const hookContent = `#!/usr/bin/env bash
branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" = "main" ]; then
  echo "❌ Direct pushes to main are blocked by Soloknuckle."
  exit 1
fi
if command -v soloknuckle >/dev/null 2>&1; then
  echo "🛡️ Soloknuckle running pre-push checks..."
  soloknuckle check || { echo "❌ Soloknuckle check failed. Push aborted."; exit 1; }
else
  echo "⚠️ soloknuckle not installed; skipping pre-push check. Install with 'npm i -g soloknuckle'."
fi
exit 0`;
    fs.writeFileSync(prePushPath, hookContent);
    fs.chmodSync(prePushPath, '755');

    const preCommitPath = path.join(hooksDir, 'pre-commit');
    const preCommitContent = `#!/usr/bin/env bash
if command -v soloknuckle >/dev/null 2>&1; then
  echo "🛡️ Soloknuckle checking for secrets/PII before commit..."
  soloknuckle check || { echo "❌ Pre-commit checks failed. Commit aborted."; exit 1; }
  echo "🛡️ Soloknuckle tracking AI vs human commit..."
  soloknuckle ai-watch --quiet || true
else
  echo "⚠️ soloknuckle not installed; skipping pre-commit check. Install with 'npm i -g soloknuckle'."
fi
exit 0`;
    fs.writeFileSync(preCommitPath, preCommitContent);
    fs.chmodSync(preCommitPath, '755');
    console.log(chalk.green('✅ Installed git pre-push and pre-commit hooks (Husky-compatible)'));
  } else {
    console.log(chalk.yellow('⚠️ No .git directory — skipped git hook installation. Run `git init` first, then re-run `soloknuckle init`.'));
  }

  // Agentic IDE Plugin & Skill Generation — only for IDEs detected in the project,
  // or for all supported IDEs when running with --all-ides. If nothing is detected,
  // scaffold the defaults so a fresh project is immediately agent-ready.
  const agentInstructions = 'Always read AGENTS.md before modifying code. If you need to know what tools are available, run `npx soloknuckle capabilities`. Run `npx soloknuckle check` before committing.';

  const detected = detectIdes(target);
  const autoOnly = detected.length > 0 && !allIdes
    ? IDE_DEFINITIONS.filter((ide) => detected.includes(ide.name))
    : IDE_DEFINITIONS;

  if (allIdes) {
    console.log(chalk.cyan('📌 --all-ides: scaffolding configs for every supported agent.'));
  } else if (detected.length === 0) {
    console.log(chalk.cyan('📌 No editor/agent detected — scaffolding the default set (use --all-ides for every agent).'));
  } else {
    console.log(chalk.cyan(`📌 Detected: ${detected.join(', ')}. Scaffolding only these.`));
  }

  for (const ide of autoOnly) {
    ide.create(target, agentInstructions);
  }

  console.log(chalk.cyan('✨ Initialization complete. Your project is now fully protected and Multi-Pronged Agent-Ready.'));
}

// Default action when no args are provided: show usage. Never mutates the
// current directory or auto-runs checks without an explicit command.
if (process.argv.length <= 2) {
  printBanner();
  console.log(chalk.cyan.bold('\n🛡️  Soloknuckle — Production Hygiene CLI\n'));
  console.log(chalk.white('Usage: npx soloknuckle <command> [options]\n'));
  console.log(chalk.dim('Commands:'));
  console.log(chalk.dim('  init        — scaffold AGENTS.md, git hooks, IDE rules'));
  console.log(chalk.dim('  check       — run strict pre-flight checks (lint, test, typecheck, secrets)'));
  console.log(chalk.dim('  score       — calculate the 0-100 project health score'));
  console.log(chalk.dim('  audit       — LLM review of uncommitted code'));
  console.log(chalk.dim('  compliance  — audit against production hygiene standards'));
  console.log(chalk.dim('  sbom        — generate a CycloneDX-like SBOM'));
  console.log(chalk.dim('  watch       — start the rollback daemon + webhook listener'));
  console.log(chalk.dim('  persona     — generate directory-specific agent rules'));
  console.log(chalk.dim('  pr          — auto-generate a PR description'));
  console.log(chalk.dim('  telemetry   — view agent telemetry'));
  console.log(chalk.dim('  capabilities — list agent-facing capabilities\n'));
  console.log(chalk.dim('Run `npx soloknuckle <command> --help` for details.'));
  console.log(chalk.dim('Run `npx soloknuckle init` first to protect a project.'));
  process.exit(0);
} else {
  // If arguments exist, commander will parse them normally
}

program
  .command('capabilities')
  .description('Returns a structured registry of all tools available to AI agents')
  .option('-f, --format <type>', 'Output format: text (default) or json', 'text')
  .action((options) => {
    if (options.format === 'json') {
      console.log(JSON.stringify(CAPABILITIES, null, 2));
      return;
    }
    console.log(chalk.cyan.bold('# Soloknuckle Agent Capabilities Registry'));
    console.log(chalk.dim('You are integrated with Soloknuckle, a Production Hygiene OS.\n'));
    for (const cap of CAPABILITIES) {
      const llmTag = cap.requiresLlm ? chalk.yellow(' (LLM)') : '';
      console.log(`${chalk.green('npx soloknuckle')} ${chalk.bold(cap.name)} ${chalk.dim(cap.arguments)}${llmTag}`);
      console.log(chalk.dim(`  ${cap.description}`));
    }
    console.log(chalk.dim('\nRun `npx soloknuckle capabilities -f json` for machine-readable output.'));
  });


program
  .command('init')
  .description('Scaffolds AGENTS.md, git hooks, IDE plugin configs, and Agent Skills into any target project')
  .option('--all-ides', 'Scaffold configs for every supported agent, not just detected ones')
  .action((options) => {
    runInit(process.cwd(), Boolean(options.allIdes));
  });

program
  .command('check')
  .description('Check if your code is production-ready (human-friendly output)')
  .option('--fix', 'Attempt to auto-fix issues')
  .option('--verbose', 'Show detailed output')
  .option('--strict', 'Enforce hard gates — fail if critical dimensions are below threshold')
  .option('--format <type>', 'Output format: text (default) or json', 'text')
  .action(async (options) => {
    await runCheck(options);
  });

program
  .command('audit')
  .description('AI agent reviews local, uncommitted code changes against AGENTS.md rules')
  .action(async () => {
    console.log(chalk.blue('🤖 Auditing local changes...'));
    
    let apiKey: string;
    try {
      apiKey = await getOrPromptApiKey();
    } catch (e: unknown) {
      // Handle ExitPromptError from inquirer when user presses Ctrl+C
      if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'ExitPromptError') {
        console.log(chalk.yellow('\n⚠️ Audit cancelled by user.'));
        process.exit(1);
      }
      throw e;
    }

    console.log(chalk.yellow('Fetching local diff and AGENTS.md...'));
    let diff = '';
    try {
      diff = execSync('git diff --cached', { encoding: 'utf-8', cwd: process.cwd() });
      if (!diff) diff = execSync('git diff', { encoding: 'utf-8', cwd: process.cwd() });
    } catch (e) {
      console.log(chalk.dim('No git repo or diff found.'));
    }

    let agentsMd = '';
    try {
      agentsMd = fs.readFileSync(path.join(process.cwd(), 'AGENTS.md'), 'utf-8');
    } catch (e) {
      console.log(chalk.red('⚠️ AGENTS.md not found in project root.'));
    }

    console.log(chalk.yellow('Sending code context to LLM for review...'));
    
    try {
      const systemPrompt = 'You are an elite code auditor. Review the provided git diff against the rules in AGENTS.md. If there are violations, concisely explain them and provide text-based suggestions for fixes.';
      const userPrompt = `AGENTS.md:\n${agentsMd}\n\nGIT DIFF:\n${diff || '(No changes)'}`;
      
      const reply = await callLLM(systemPrompt, userPrompt);
      logTelemetry(true, diff ? diff.split('\n').length : 0);

      console.log(chalk.green('\n✅ Audit Complete!'));
      console.log(chalk.white(reply));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.log(chalk.red(`❌ Audit failed: ${msg}`));
      console.log(chalk.dim('Please ensure your API key/Base URL is valid and you have an internet connection.'));
    }
  });

program
  .command('persona <type> <folder>')
  .description('Generate directory-specific agent rules (frontend-ux | backend-security | data-engineer)')
  .option('-f, --format <type>', 'Output format: text (default) or json', 'text')
  .action((type, folder, options) => {
    try {
      if (options.format === 'json') {
        const manifest = applyPersonaManifest(folder, type as PersonaType);
        console.log(JSON.stringify(manifest, null, 2));
        return;
      }
      const p = applyPersona(folder, type as PersonaType);
      console.log(chalk.green(`✅ Created persona config at ${p}`));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.log(chalk.red(`Failed to apply persona: ${msg}`));
      process.exit(1);
    }
  });

program
  .command('pr')
  .description('Generate strict PR description from git diff')
  .action(async () => {
    let apiKey: string;
    try {
      apiKey = await getOrPromptApiKey();
    } catch (e: unknown) {
      // Handle ExitPromptError from inquirer when user presses Ctrl+C
      if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'ExitPromptError') {
        console.log(chalk.yellow('\n⚠️ PR generation cancelled by user.'));
        process.exit(1);
      }
      throw e;
    }
    await generatePRDescription(apiKey);
  });

program
  .command('watch')
  .description('Start the Rollback Daemon and Webhook Listener')
  .action(() => {
    initWebhookListener();
  });

program
  .command('telemetry')
  .description('View Agent Telemetry')
  .action(() => {
    const data = getTelemetry();
    console.log(chalk.magenta('📊 Agent Telemetry:'));
    console.log(chalk.white(JSON.stringify(data, null, 2)));
  });

program
  .command('score')
  .description('Calculates the health of the project across 7 domains')
  .action(async () => {
    console.log(chalk.magenta('🔍 Calculating Vibe Score...'));
    const metrics = calculateMetrics();
    console.log(chalk.white(`Overall Score: ${metrics.overall}/100`));
    console.log(chalk.blue(`- Quality: ${metrics.quality.score}`));
    console.log(chalk.blue(`- Testing: ${metrics.testing.score}`));
    console.log(chalk.blue(`- Security: ${metrics.security.score}`));
    console.log(chalk.blue(`- Efficiency: ${metrics.efficiency.score}`));
    console.log(chalk.blue(`- Accessibility: ${metrics.accessibility.score}`));
    console.log(chalk.blue(`- Performance: ${metrics.performance.score}`));
    console.log(chalk.blue(`- Reliability: ${metrics.reliability.score}`));
    console.log(chalk.blue(`- Supply Chain: ${metrics.supplyChain.score}`));
    
    console.log(chalk.yellow('\n🤖 Generating AI Suggestions...'));
    const suggestions = await generateSuggestions(metrics);
    suggestions.forEach(s => console.log(chalk.green(`💡 ${s}`)));
  });

program
  .command('sbom')
  .description('Generate a CycloneDX-like SBOM from your dependencies')
  .option('-o, --output <path>', 'Output file path (default: stdout)')
  .action(async (options) => {
    writeSbom(options.output);
  });

program
  .command('compliance')
  .description('Audit your codebase for production hygiene compliance')
  .action(() => {
    const report = runCompliance();
    printComplianceReport(report);
  });

program
  .command('ai-watch [count]')
  .description('Track AI-authored commits, scan their diffs, and create approval/quarantine branches')
  .option('--quiet', 'Suppress non-essential output (used inside git hooks)')
  .option('--all', 'Watch the last 10 commits instead of just HEAD')
  .action((count, options) => {
    const all = options.all || count;
    const results = all
      ? watchRecentCommits(typeof count === 'number' ? count : 10)
      : [watchCommit()];

    for (const result of results) {
      if (result.success && result.record) {
        logTelemetry(result.record.isAi, result.record.diffStats.additions);
      }

      if (result.success && result.record && result.record.scanResult.violations.length > 0) {
        console.log(chalk.red(`🔒 ${result.message}`));
        for (const v of result.record.scanResult.violations) {
          console.log(chalk.dim(`    → ${v}`));
        }
      } else if (result.success) {
        console.log(chalk.green(`✅ ${result.message}`));
      } else {
        console.log(chalk.yellow(`⚠️  ${result.message}`));
      }
    }

    if (!options.quiet) {
      const summary = loadWatcherData();
      console.log(chalk.dim(`\n${getWatcherSummary()}`));
      console.log(chalk.dim(`Acceptance rate: ${summary.acceptanceRate}%, Quarantine rate: ${summary.quarantineRate}%`));
    }
  });

if (process.argv.length > 2) {
  program.parse(process.argv);
}
