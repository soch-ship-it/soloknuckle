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
import { applyPersona, PersonaType } from './personas';
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

const program = new Command();

program
  .name('soloknuckle')
  .description('Production Hygiene Kit & Agent Firewall for any project')
  .version(getVersion());

// Multi-pronged capabilities registry
const CAPABILITIES = `
# Soloknuckle Agent Capabilities Registry

You are integrated with Soloknuckle, a Production Hygiene OS. You have access to the following commands:
- \`npx soloknuckle check\`: Runs strict pre-flight checks (lint, test, typecheck, secret scan). Supports --strict mode for hard gate enforcement. MUST be run before any git commit.
- \`npx soloknuckle audit\`: Analyzes local uncommitted code against AGENTS.md rules.
- \`npx soloknuckle score\`: Calculates a 0-100 project health score and provides AI suggestions.
- \`npx soloknuckle init\`: Scaffolds hooks and rules for any project.
- \`npx soloknuckle pr\`: Auto-generates a PR description from a git diff.
- \`npx soloknuckle persona <type> <folder>\`: Applies bounded-context agent rules to specific directories.
- \`npx soloknuckle sbom\`: Generates a CycloneDX-like SBOM from your dependencies.
- \`npx soloknuckle compliance\`: Audits your codebase for production hygiene compliance.
`;

// Extracted init logic — used by both the default handler and the init command
function runInit(target: string): void {
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
else
  echo "⚠️ soloknuckle not installed; skipping pre-commit check. Install with 'npm i -g soloknuckle'."
fi
exit 0`;
    fs.writeFileSync(preCommitPath, preCommitContent);
    fs.chmodSync(preCommitPath, '755');
    console.log(chalk.green('✅ Installed git pre-push and pre-commit hooks (Husky-compatible)'));
  }

  // Agentic IDE Plugin & Skill Generation
  const agentInstructions = 'Always read AGENTS.md before modifying code. If you need to know what tools are available, run `npx soloknuckle capabilities`. Run `npx soloknuckle check` before committing.';

  const cursorRulesPath = path.join(target, '.cursorrules');
  if (!fs.existsSync(cursorRulesPath)) {
    fs.writeFileSync(cursorRulesPath, agentInstructions);
    console.log(chalk.green('✅ Created .cursorrules for Cursor AI'));
  }

  const windsurfRulesPath = path.join(target, '.windsurfrules');
  if (!fs.existsSync(windsurfRulesPath)) {
    fs.writeFileSync(windsurfRulesPath, agentInstructions);
    console.log(chalk.green('✅ Created .windsurfrules for Windsurf IDE'));
  }

  const skillMdPath = path.join(target, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    const skillContent = `---
name: production-hygiene-enforcer
description: Enforces safe deployment rules and hygiene practices.
---
# Instructions
${agentInstructions}`;
    fs.writeFileSync(skillMdPath, skillContent);
    console.log(chalk.green('✅ Created SKILL.md for Claude Code / Antigravity / Gemini'));
  }

  const replitPath = path.join(target, '.replit');
  if (!fs.existsSync(replitPath)) {
    fs.writeFileSync(replitPath, 'run = "npx soloknuckle check"\n');
    console.log(chalk.green('✅ Created .replit config for Replit Agent'));
  }

  const mcpPath = path.join(target, 'mcp-config.json');
  if (!fs.existsSync(mcpPath)) {
    const mcpContent = JSON.stringify({
      mcpServers: {
        soloknuckle: {
          command: "npx",
          args: ["-y", "soloknuckle-mcp"]
        }
      }
    }, null, 2);
    fs.writeFileSync(mcpPath, mcpContent);
    console.log(chalk.green('✅ Created mcp-config.json for ChatGPT Codex / Lovable / Claude Desktop integration'));
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
  .action(() => {
    console.log(CAPABILITIES);
  });


program
  .command('init')
  .description('Scaffolds AGENTS.md, git hooks, IDE plugin configs, and Agent Skills into any target project')
  .action(() => {
    runInit(process.cwd());
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
  .action((type, folder) => {
    try {
      const p = applyPersona(folder, type as PersonaType);
      console.log(chalk.green(`✅ Created persona config at ${p}`));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.log(chalk.red(`Failed to apply persona: ${msg}`));
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

if (process.argv.length > 2) {
  program.parse(process.argv);
}
