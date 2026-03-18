import { BaseAgent } from '../base-agent.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkJSSyntax, checkPythonSyntax, checkNpmInstall } from '../quality-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * FixAgent — Bug fixes, WordPress issues, debugging, migrations, code review.
 * Unique agent — works with CLIENT'S code rather than generating from scratch.
 * No templates — it reads, diagnoses, and fixes.
 */
export default class FixAgent extends BaseAgent {
  constructor() {
    super({
      name: 'FixAgent',
      type: 'fix',
      emoji: '🔧',
      description: 'Bug fixes, debugging, WordPress fixes, code review, migrations',
      supportedGigTypes: ['bug fix', 'debug', 'wordpress', 'fix', 'migration', 'code review', 'refactor'],
      allowedTools: [
        'Edit', 'Write', 'Read', 'Glob', 'Grep',
        'Bash(npm*)', 'Bash(npx*)', 'Bash(node*)',
        'Bash(python*)', 'Bash(pip*)',
        'Bash(git*)', 'Bash(mkdir*)', 'Bash(ls*)',
        'Bash(cat*)', 'Bash(echo*)', 'Bash(cp*)',
        'Bash(php*)', 'Bash(composer*)',
      ],
      timeout: 20 * 60 * 1000, // 20 min — debugging takes time
      agentDir: __dirname,
    });
  }

  async scaffoldProject(deliveryDir, gig, plan) {
    fs.mkdirSync(deliveryDir, { recursive: true });

    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Detect what kind of fix
    let fixType = 'general';
    if (text.includes('wordpress') || text.includes('wp') || text.includes('woocommerce')) fixType = 'wordpress';
    else if (text.includes('react') || text.includes('next.js') || text.includes('vue')) fixType = 'frontend';
    else if (text.includes('api') || text.includes('backend') || text.includes('server')) fixType = 'backend';
    else if (text.includes('database') || text.includes('sql') || text.includes('migration')) fixType = 'database';
    else if (text.includes('css') || text.includes('styling') || text.includes('responsive')) fixType = 'css';

    fs.writeFileSync(path.join(deliveryDir, '.fix-type'), fixType);

    // Fix agent creates a diagnostic structure
    fs.mkdirSync(path.join(deliveryDir, 'diagnosis'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'patches'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'before'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'after'), { recursive: true });

    // Create a diagnosis template
    fs.writeFileSync(path.join(deliveryDir, 'diagnosis', 'report.md'),
      `# Bug Diagnosis Report\n\n## Issue\n${gig.title}\n\n## Description\n${gig.description || 'See gig details'}\n\n## Root Cause\n*To be determined during analysis*\n\n## Fix Applied\n*Details of the fix*\n\n## Files Changed\n*List of modified files*\n\n## Testing\n*How to verify the fix works*\n`);
  }

  async buildMasterPrompt(gig, profile, plan) {
    // Override to give fix-specific instructions
    let domainPrompt = '';
    if (fs.existsSync(this.promptPath)) {
      domainPrompt = fs.readFileSync(this.promptPath, 'utf-8');
    }

    return `# Fix/Debug Project: ${gig.title}

## Client's Problem
${gig.description || 'No description provided'}

## Your Approach
1. First DIAGNOSE the issue — understand what's broken and why
2. Create a BEFORE snapshot of the problematic code/files
3. Implement the FIX with minimal, targeted changes
4. Create an AFTER snapshot showing the fix
5. Write a diagnosis report explaining root cause and solution
6. Generate a PATCH file so the client can apply it to their codebase

## Important
- Make MINIMAL changes — only fix what's broken
- Don't refactor unrelated code
- Document every change in diagnosis/report.md
- Create diff/patch files in patches/ directory
- Test that the fix actually resolves the issue
- Keep the before/ and after/ directories for comparison

## Budget
${gig.budget || 'Not specified'}

## Required Skills
${(gig.skills || []).join(', ') || 'Not specified'}

## Delivery Plan
${JSON.stringify(plan, null, 2)}

## Domain Expertise
${domainPrompt}

## Quality Standards
- Fix must resolve the reported issue
- No regressions — don't break other things
- Clean, documented changes
- Diagnosis report is clear and professional
- Patch is easy for client to apply
`;
  }

  async runQualityChecks(projectDir, gig, plan) {
    const checks = [];
    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Language-specific syntax checks
    if (text.includes('python') || text.includes('.py')) {
      checks.push(checkPythonSyntax());
    }
    if (text.includes('javascript') || text.includes('node') || text.includes('react') || text.includes('.js')) {
      checks.push(checkJSSyntax());
    }
    if (fs.existsSync(path.join(projectDir, 'package.json'))) {
      checks.push(checkNpmInstall());
    }

    // Fix-specific: diagnosis report exists and is filled
    checks.push({
      name: 'Diagnosis report complete',
      run: async (dir) => {
        const reportPath = path.join(dir, 'diagnosis', 'report.md');
        if (!fs.existsSync(reportPath)) {
          return { passed: false, message: 'Missing diagnosis/report.md' };
        }
        const content = fs.readFileSync(reportPath, 'utf-8');
        const hasRootCause = !content.includes('*To be determined');
        const hasFix = !content.includes('*Details of the fix*');
        return {
          passed: hasRootCause && hasFix,
          message: (hasRootCause && hasFix)
            ? 'Diagnosis report is complete'
            : 'Diagnosis report has unfilled sections',
        };
      },
    });

    // Fix-specific: patches directory has content
    checks.push({
      name: 'Fix patches created',
      run: async (dir) => {
        const patchDir = path.join(dir, 'patches');
        if (!fs.existsSync(patchDir)) return { passed: false, message: 'No patches directory' };
        const files = fs.readdirSync(patchDir);
        return {
          passed: files.length > 0,
          message: files.length > 0
            ? `${files.length} patch files created`
            : 'No patch files — client needs to know what changed',
        };
      },
    });

    const { runQualityChecks: runChecks } = await import('../quality-runner.js');
    return await runChecks(projectDir, checks);
  }
}
