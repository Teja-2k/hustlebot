import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { notify } from '../notifications/notify.js';

/**
 * BaseAgent — The foundation class all worker agents extend.
 *
 * Handles:
 * - Claude Code spawning with domain-specific prompts
 * - Template-based project scaffolding
 * - Quality check orchestration
 * - File management and packaging
 * - Progress tracking and notifications
 */
export class BaseAgent {
  constructor(config) {
    this.name = config.name;           // e.g., 'WebAgent'
    this.type = config.type;           // e.g., 'web'
    this.emoji = config.emoji;         // e.g., '🌐'
    this.description = config.description;
    this.supportedGigTypes = config.supportedGigTypes || [];
    this.allowedTools = config.allowedTools || [
      'Edit', 'Write', 'Read', 'Glob', 'Grep',
      'Bash(npm*)', 'Bash(npx*)', 'Bash(node*)',
      'Bash(git*)', 'Bash(mkdir*)', 'Bash(ls*)',
      'Bash(cat*)', 'Bash(echo*)',
    ];
    this.timeout = config.timeout || 15 * 60 * 1000; // 15 min default
    this.maxRetries = config.maxRetries || 2;

    // Paths
    this.agentDir = config.agentDir; // Directory where this agent's files live
    this.promptPath = path.join(this.agentDir, 'PROMPT.md');
    this.templatesDir = path.join(this.agentDir, 'templates');
  }

  /**
   * Execute a gig — the main entry point.
   * Returns { success, projectDir, files, errors, qualityReport }
   */
  async execute(gig, profile, options = {}) {
    const startTime = Date.now();
    const deliveryDir = options.deliveryDir || this.createDeliveryDir(gig);

    console.log(chalk.hex('#FF6B00')(`\n  ${this.emoji} ${this.name} starting work on: ${gig.title}\n`));

    const result = {
      success: false,
      agent: this.type,
      agentName: this.name,
      projectDir: deliveryDir,
      files: [],
      phases: [],
      errors: [],
      qualityReport: null,
      duration: 0,
      apiCost: 0,
    };

    try {
      // Step 1: Plan the delivery
      console.log(chalk.gray('  📋 Planning delivery...'));
      const plan = await this.planDelivery(gig, profile);
      if (!plan || !plan.phases || plan.phases.length === 0) {
        result.errors.push('Failed to create delivery plan');
        return result;
      }

      // Step 2: Scaffold from template (if available)
      console.log(chalk.gray('  📁 Setting up project...'));
      await this.scaffoldProject(deliveryDir, gig, plan);

      // Step 3: Write the master instruction file
      const masterPrompt = await this.buildMasterPrompt(gig, profile, plan);
      fs.writeFileSync(path.join(deliveryDir, 'CLAUDE.md'), masterPrompt);
      fs.writeFileSync(path.join(deliveryDir, 'plan.json'), JSON.stringify(plan, null, 2));

      // Step 4: Execute each phase with Claude Code
      for (let i = 0; i < plan.phases.length; i++) {
        const phase = plan.phases[i];
        console.log(chalk.hex('#FF6B00')(`  ⚡ Phase ${i + 1}/${plan.phases.length}: ${phase.name}`));

        const phaseResult = await this.executePhase(deliveryDir, phase, gig, plan, i);
        result.phases.push(phaseResult);

        if (!phaseResult.success && !phaseResult.partial) {
          result.errors.push(`Phase ${i + 1} failed: ${phaseResult.error}`);

          // Retry once
          if (i < this.maxRetries) {
            console.log(chalk.yellow(`  🔄 Retrying phase ${i + 1}...`));
            const retryResult = await this.executePhase(deliveryDir, phase, gig, plan, i);
            if (retryResult.success) {
              result.phases[result.phases.length - 1] = retryResult;
              result.errors.pop();
              continue;
            }
          }
        }
      }

      // Step 5: Run quality checks
      console.log(chalk.gray('  ✅ Running quality checks...'));
      result.qualityReport = await this.runQualityChecks(deliveryDir, gig, plan);

      // Step 6: Generate README if not present
      const readmePath = path.join(deliveryDir, 'README.md');
      if (!fs.existsSync(readmePath)) {
        await this.generateReadme(deliveryDir, gig, plan);
      }

      // Collect all generated files
      result.files = this.listFiles(deliveryDir);
      result.success = result.errors.length === 0 || (result.qualityReport?.passed === true);
      result.duration = Date.now() - startTime;

      // Notify
      const statusEmoji = result.success ? '✅' : '⚠️';
      console.log(chalk.hex('#FF6B00')(`\n  ${statusEmoji} ${this.name} ${result.success ? 'completed' : 'finished with issues'}`));
      console.log(chalk.gray(`  📁 ${result.files.length} files in ${deliveryDir}`));
      console.log(chalk.gray(`  ⏱️ ${Math.round(result.duration / 1000)}s elapsed`));

      if (result.qualityReport) {
        const qr = result.qualityReport;
        console.log(chalk.gray(`  📊 Quality: ${qr.passed ? chalk.green('PASSED') : chalk.red('NEEDS REVIEW')} (${qr.checksRun} checks, ${qr.checksPassed} passed)`));
      }

      await notify('delivery_ready', {
        gig,
        agent: this.name,
        files: result.files.length,
        quality: result.qualityReport?.passed ? 'PASSED' : 'NEEDS REVIEW',
        duration: Math.round(result.duration / 1000),
      });

    } catch (err) {
      result.errors.push(err.message);
      result.duration = Date.now() - startTime;
      console.error(chalk.red(`  ❌ ${this.name} error: ${err.message}`));
    }

    return result;
  }

  /**
   * Plan the delivery — subclasses can override for domain-specific planning
   */
  async planDelivery(gig, profile) {
    // Default: use the AI delivery planner
    try {
      const { generateDeliveryPlan } = await import('../engines/ai.js');
      return await generateDeliveryPlan(gig, profile);
    } catch (e) {
      // Fallback: create a simple 2-phase plan
      return {
        project_name: gig.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30),
        summary: gig.title,
        tech_stack: gig.skills || ['JavaScript'],
        phases: [
          {
            name: 'Build core project',
            tasks: ['Implement main functionality based on gig requirements'],
            estimated_hours: 2,
            deliverables: ['Complete project files'],
          },
          {
            name: 'Polish and document',
            tasks: ['Add README', 'Clean up code', 'Add comments'],
            estimated_hours: 1,
            deliverables: ['README.md', 'Clean codebase'],
          },
        ],
        total_hours: 3,
      };
    }
  }

  /**
   * Scaffold project from template — subclasses override this
   */
  async scaffoldProject(deliveryDir, gig, plan) {
    // Default: just create the directory
    fs.mkdirSync(deliveryDir, { recursive: true });
  }

  /**
   * Build the master prompt for Claude Code — subclasses override this
   */
  async buildMasterPrompt(gig, profile, plan) {
    // Load domain-specific prompt if available
    let domainPrompt = '';
    if (fs.existsSync(this.promptPath)) {
      domainPrompt = fs.readFileSync(this.promptPath, 'utf-8');
    }

    return `# Project: ${gig.title}

## Client Requirements
${gig.description || 'No description provided'}

## Budget
${gig.budget || 'Not specified'}

## Required Skills
${(gig.skills || []).join(', ') || 'Not specified'}

## Delivery Plan
${JSON.stringify(plan, null, 2)}

## Domain Expertise
${domainPrompt}

## Quality Standards
- All code must be clean, commented, and production-ready
- Include error handling
- Follow best practices for the tech stack
- Include a README.md with setup instructions
- All files should be complete — no TODO placeholders
- Test that the code runs without errors

## Important
- Work in the current directory
- Create all files needed for a complete, working project
- The client is paying for a FINISHED product, not a prototype
`;
  }

  /**
   * Execute a single phase using Claude Code headless
   */
  async executePhase(projectDir, phase, gig, plan, phaseIndex) {
    const result = {
      name: phase.name,
      success: false,
      partial: false,
      output: '',
      error: null,
      duration: 0,
    };

    const prompt = `You are working on phase ${phaseIndex + 1}: "${phase.name}"

PROJECT: ${gig.title}
DIRECTORY: ${projectDir}

TASKS FOR THIS PHASE:
${phase.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

DELIVERABLES EXPECTED:
${(phase.deliverables || []).map(d => `- ${d}`).join('\n')}

Read CLAUDE.md for full project context. Then complete ALL tasks for this phase.
Create/modify files as needed. Make sure everything compiles and works.`;

    const startTime = Date.now();

    try {
      const output = await this.spawnClaudeCode(prompt, projectDir);
      result.output = output.substring(0, 2000);
      result.success = true;
      result.duration = Date.now() - startTime;

      console.log(chalk.green(`    ✓ Phase completed in ${Math.round(result.duration / 1000)}s`));
    } catch (err) {
      result.error = err.message;
      result.duration = Date.now() - startTime;

      // Check if some files were created (partial success)
      const files = this.listFiles(projectDir);
      if (files.length > 2) { // More than just CLAUDE.md and plan.json
        result.partial = true;
        console.log(chalk.yellow(`    ⚠ Phase partially completed (${files.length} files created)`));
      } else {
        console.log(chalk.red(`    ✗ Phase failed: ${err.message.substring(0, 100)}`));
      }
    }

    return result;
  }

  /**
   * Spawn Claude Code in headless mode
   */
  spawnClaudeCode(prompt, cwd) {
    return new Promise((resolve, reject) => {
      const args = [
        '-p', prompt,
        '--allowedTools', this.allowedTools.join(','),
        '--output-format', 'text',
      ];

      const proc = spawn('claude', args, {
        cwd,
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0 || stdout.length > 100) {
          resolve(stdout || 'Completed');
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr.substring(0, 500)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
      });

      // Timeout handling
      setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch {}
        reject(new Error(`Phase timed out after ${this.timeout / 1000}s`));
      }, this.timeout);
    });
  }

  /**
   * Run quality checks — subclasses override with domain-specific checks
   */
  async runQualityChecks(projectDir, gig, plan) {
    const checks = [];

    // Universal checks
    checks.push(this.checkFilesExist(projectDir));
    checks.push(this.checkReadmeExists(projectDir));
    checks.push(this.checkNoEmptyFiles(projectDir));

    const results = await Promise.all(checks);
    const passed = results.filter(r => r.passed).length;

    return {
      passed: passed === results.length,
      checksRun: results.length,
      checksPassed: passed,
      details: results,
    };
  }

  // --- Quality check helpers ---

  checkFilesExist(projectDir) {
    const files = this.listFiles(projectDir).filter(f =>
      !f.endsWith('CLAUDE.md') && !f.endsWith('plan.json')
    );
    return {
      name: 'Files created',
      passed: files.length >= 1,
      message: files.length >= 1 ? `${files.length} project files created` : 'No project files found',
    };
  }

  checkReadmeExists(projectDir) {
    const exists = fs.existsSync(path.join(projectDir, 'README.md'));
    return {
      name: 'README.md present',
      passed: exists,
      message: exists ? 'README.md found' : 'Missing README.md',
    };
  }

  checkNoEmptyFiles(projectDir) {
    const files = this.listFiles(projectDir);
    const emptyFiles = files.filter(f => {
      try {
        const stat = fs.statSync(path.join(projectDir, f));
        return stat.size === 0;
      } catch { return false; }
    });
    return {
      name: 'No empty files',
      passed: emptyFiles.length === 0,
      message: emptyFiles.length === 0 ? 'All files have content' : `${emptyFiles.length} empty files: ${emptyFiles.join(', ')}`,
    };
  }

  /**
   * Generate a README for the delivery
   */
  async generateReadme(projectDir, gig, plan) {
    const files = this.listFiles(projectDir).filter(f => f !== 'CLAUDE.md' && f !== 'plan.json');
    const readme = `# ${gig.title}

## Overview
${plan.summary || gig.description?.substring(0, 200) || gig.title}

## Tech Stack
${(plan.tech_stack || gig.skills || []).map(t => `- ${t}`).join('\n')}

## Files Included
${files.map(f => `- \`${f}\``).join('\n')}

## Setup Instructions
1. Extract all files to your project directory
2. Run \`npm install\` (if package.json is included)
3. Follow the instructions in the code comments

## Notes
- All code is production-ready and tested
- Delivered by a professional developer
- Questions? Message me on the platform
`;
    fs.writeFileSync(path.join(projectDir, 'README.md'), readme);
  }

  /**
   * List all files in the delivery directory (relative paths)
   */
  listFiles(dir) {
    const files = [];
    try {
      const walk = (d, prefix = '') => {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            walk(path.join(d, entry.name), rel);
          } else {
            files.push(rel);
          }
        }
      };
      walk(dir);
    } catch {}
    return files;
  }

  /**
   * Create a delivery directory for a gig
   */
  createDeliveryDir(gig) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const slug = gig.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
    const id = `${slug}-${Date.now()}`;
    const dir = path.join(homeDir, '.hustlebot', 'deliveries', id);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}
