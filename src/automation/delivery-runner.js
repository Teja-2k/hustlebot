import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { log, error as logError, logDelivery } from '../utils/logger.js';
import { generateDeliveryPlan } from '../engines/ai.js';
import { advanceGig, States } from './pipeline.js';
import { notify } from '../notifications/notify.js';

/**
 * Run full delivery for a won gig using the Worker Agent system.
 * Routes gig to the correct specialized agent (WebAgent, BotAgent, etc.)
 * Falls back to legacy Claude Code spawn if agent system fails.
 */
export async function runDelivery(gigEntry, profile) {
  const { gig, id } = gigEntry;

  log(`[DELIVERY] Starting delivery for "${gig.title}"`);

  try {
    // Use the Worker Agent router for intelligent delivery
    const { routeAndExecute } = await import('../workers/router.js');
    const result = await routeAndExecute(gig, profile);

    if (result.success) {
      advanceGig(id, States.DELIVERED, {
        projectDir: result.projectDir,
        agent: result.agentName,
        files: result.files?.length || 0,
        quality: result.qualityReport,
      });

      await notify('DELIVERY_DONE', {
        projectName: gig.title,
        projectDir: result.projectDir,
        agent: result.agentName,
        files: result.files?.length || 0,
        quality: result.qualityReport?.passed ? 'PASSED' : 'NEEDS REVIEW',
      });

      log(`[DELIVERY] ✅ Complete via ${result.agentName}: ${gig.title} (${result.files?.length || 0} files)`);
    } else {
      logError(`[DELIVERY] Agent delivery had issues: ${result.errors?.join(', ')}`);

      // If partial success (some files created), still mark as delivered with review flag
      if (result.files?.length > 2) {
        advanceGig(id, States.DELIVERED, {
          projectDir: result.projectDir,
          agent: result.agentName,
          needsReview: true,
        });
        await notify('DELIVERY_DONE', {
          projectName: gig.title,
          projectDir: result.projectDir,
          quality: 'NEEDS REVIEW',
        });
        log(`[DELIVERY] ⚠️ Partial delivery via ${result.agentName}: ${gig.title}`);
      } else {
        // Full failure — fallback to legacy
        log(`[DELIVERY] Falling back to legacy delivery`);
        await runLegacyDelivery(gigEntry, profile);
      }
    }
  } catch (err) {
    logError(`[DELIVERY] Router error: ${err.message}`);
    log(`[DELIVERY] Falling back to legacy delivery`);
    await runLegacyDelivery(gigEntry, profile);
  }
}

/**
 * Legacy delivery — direct Claude Code spawn without specialized agents.
 */
async function runLegacyDelivery(gigEntry, profile) {
  const { gig, id } = gigEntry;
  const slug = `hustlebot-delivery-${Date.now()}`;

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

  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  writeFileSync(join(projectDir, 'CLAUDE.md'), `# ${projectName}\n\n## Project Context\n${plan.summary}\n\n## Tech Stack\n${(plan.tech_stack || []).map(t => `- ${t}`).join('\n')}\n\n## Phases\n${(plan.phases || []).map((p, i) => `### Phase ${i + 1}: ${p.name}\n${(p.tasks || []).map(t => `- [ ] ${t}`).join('\n')}\nDeliverables: ${(p.deliverables || []).join(', ')}`).join('\n\n')}\n\n## Rules\n- Write clean, well-documented code\n- Include error handling\n- Write tests for critical paths\n`);

  writeFileSync(join(projectDir, 'plan.json'), JSON.stringify(plan, null, 2));
  writeFileSync(join(projectDir, '.gitignore'), 'node_modules/\n.env\n*.log\ndist/\n');

  advanceGig(id, States.DELIVERING, { deliveryPlan: plan, projectDir });

  const phases = plan.phases || [];
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    logDelivery(projectName, `Starting Phase ${i + 1}: ${phase.name}`);

    const prompt = [
      `You are delivering Phase ${i + 1} of ${phases.length}: "${phase.name}"`,
      `Project: ${plan.summary}`,
      `Tech Stack: ${(plan.tech_stack || []).join(', ')}`,
      '', 'Tasks to complete:',
      ...(phase.tasks || []).map((t, j) => `${j + 1}. ${t}`),
      '', 'Read CLAUDE.md for full context. Complete all tasks.',
    ].join('\n');

    try {
      const output = await runClaudeHeadless(prompt, projectDir);
      logDelivery(projectName, `Phase ${i + 1} complete.`);
    } catch (err) {
      logError(`[DELIVERY] Phase ${i + 1} failed: ${err.message}`);
      return;
    }
  }

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
