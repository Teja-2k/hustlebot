import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { log, error as logError, logDelivery } from '../utils/logger.js';
import { generateDeliveryPlan } from '../engines/ai.js';
import { advanceGig, States } from './pipeline.js';
import { notify } from '../notifications/notify.js';

/**
 * Run full delivery for a won gig using Claude Code headless mode.
 */
export async function runDelivery(gigEntry, profile) {
  const { gig, id } = gigEntry;
  const slug = `hustlebot-delivery-${Date.now()}`;

  log(`[DELIVERY] Starting delivery for "${gig.title}"`);

  // Step 1: Generate delivery plan
  let plan;
  try {
    plan = await generateDeliveryPlan(gig, profile);
    if (!plan) throw new Error('AI returned no plan');
  } catch (err) {
    logError(`[DELIVERY] Plan generation failed: ${err.message}`);
    await notify('ERROR', { message: `Delivery plan failed for "${gig.title}": ${err.message}` });
    return;
  }

  const projectName = plan.project_name || slug;
  const projectDir = join(process.cwd(), projectName);

  // Step 2: Scaffold project
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  writeFileSync(join(projectDir, 'CLAUDE.md'), `# ${projectName}

## Project Context
${plan.summary}

## Tech Stack
${(plan.tech_stack || []).map(t => `- ${t}`).join('\n')}

## Phases
${(plan.phases || []).map((p, i) => `### Phase ${i + 1}: ${p.name}\n${(p.tasks || []).map(t => `- [ ] ${t}`).join('\n')}\nDeliverables: ${(p.deliverables || []).join(', ')}`).join('\n\n')}

## Rules
- Write clean, well-documented code
- Include error handling
- Write tests for critical paths
- Commit after each completed task
`);

  writeFileSync(join(projectDir, 'plan.json'), JSON.stringify(plan, null, 2));
  writeFileSync(join(projectDir, '.gitignore'), 'node_modules/\n.env\n*.log\ndist/\n');

  advanceGig(id, States.DELIVERING, { deliveryPlan: plan, projectDir });

  await notify('DELIVERY_STARTED', {
    projectName,
    phase: `Phase 1: ${plan.phases?.[0]?.name || 'Setup'}`,
  });

  // Step 3: Execute each phase with Claude Code headless
  const phases = plan.phases || [];
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];

    logDelivery(projectName, `Starting Phase ${i + 1}: ${phase.name}`);

    const prompt = [
      `You are delivering Phase ${i + 1} of ${phases.length}: "${phase.name}"`,
      `Project: ${plan.summary}`,
      `Tech Stack: ${(plan.tech_stack || []).join(', ')}`,
      '',
      'Tasks to complete:',
      ...(phase.tasks || []).map((t, j) => `${j + 1}. ${t}`),
      '',
      'Read CLAUDE.md for full context. Complete all tasks. Commit after each task.',
    ].join('\n');

    try {
      const output = await runClaudeHeadless(prompt, projectDir);
      logDelivery(projectName, `Phase ${i + 1} complete. Output: ${output.substring(0, 500)}`);

      await notify('DELIVERY_PHASE_COMPLETE', {
        projectName,
        phaseNum: i + 1,
        totalPhases: phases.length,
      });
    } catch (err) {
      logError(`[DELIVERY] Phase ${i + 1} failed: ${err.message}`);
      await notify('ERROR', { message: `Phase ${i + 1} failed for ${projectName}: ${err.message}` });
      return; // Stop delivery on phase failure
    }
  }

  // Step 4: Mark as delivered
  advanceGig(id, States.DELIVERED, { projectDir });

  await notify('DELIVERY_DONE', { projectName, projectDir });

  log(`[DELIVERY] Complete: ${projectName}`);
}

/**
 * Invoke Claude Code in headless mode.
 */
function runClaudeHeadless(prompt, cwd) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--allowedTools', 'Edit,Write,Bash(npm*),Bash(npx*),Bash(git*),Bash(node*),Bash(mkdir*)',
    ];

    const proc = spawn('claude', args, {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000, // 10 min per phase
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude Code exited with code ${code}: ${stderr.substring(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Claude Code: ${err.message}. Is 'claude' installed?`));
    });
  });
}
