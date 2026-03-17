import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateDeliveryPlan } from '../engines/ai.js';
import { saveProjects, getApiKey } from '../utils/config.js';

export async function deliverProject(gigId, config) {
  const gigIndex = parseInt(gigId) - 1;
  const gig = config.gigs[gigIndex];

  if (!gig) {
    console.log(chalk.red(`\n  ⚠ Gig #${gigId} not found. Run `) + chalk.white('hustlebot scan') + chalk.red(' first.\n'));
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.red('\n  ⚠ No API key configured.\n'));
    return;
  }

  console.log(chalk.hex('#FF6B00')('\n  🚀 Setting up project delivery...\n'));
  console.log(chalk.white(`  Gig: `) + chalk.hex('#FF6B00')(gig.title));
  console.log();

  const spinner = ora('  Generating delivery plan with AI...').start();

  try {
    const plan = await generateDeliveryPlan(gig, config.profile);

    if (!plan) {
      spinner.fail('  Could not generate plan');
      return;
    }

    spinner.succeed('  Delivery plan ready!');

    // Display plan
    console.log('\n' + boxen(
      chalk.hex('#FF6B00')(`  PROJECT: ${plan.project_name}\n\n`) +
      chalk.white(`  ${plan.summary}\n\n`) +
      chalk.gray(`  Tech: ${plan.tech_stack?.join(', ')}\n`) +
      chalk.gray(`  Est. hours: ${plan.total_hours}\n\n`) +
      chalk.hex('#FF6B00')('  PHASES:\n') +
      (plan.phases || []).map((phase, i) =>
        chalk.white(`\n  ${i + 1}. ${phase.name}`) + chalk.gray(` (${phase.estimated_hours}hrs)`) + '\n' +
        (phase.tasks || []).map(t => chalk.gray(`     • ${t}`)).join('\n') + '\n' +
        chalk.dim(`     Deliverables: ${(phase.deliverables || []).join(', ')}`)
      ).join('\n'),
      { padding: 1, borderColor: '#FF6B00', borderStyle: 'round', title: chalk.hex('#FF6B00')(' DELIVERY PLAN '), titleAlignment: 'center' }
    ));

    // Ask to scaffold
    const { shouldScaffold } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldScaffold',
      message: chalk.white('Create project workspace and files?'),
      default: true,
    }]);

    if (shouldScaffold) {
      const projectDir = join(process.cwd(), plan.project_name || `hustlebot-project-${Date.now()}`);

      if (!existsSync(projectDir)) {
        mkdirSync(projectDir, { recursive: true });
      }

      // Create project structure
      writeFileSync(join(projectDir, 'README.md'), `# ${plan.project_name}\n\n${plan.summary}\n\n## Tech Stack\n${(plan.tech_stack || []).map(t => `- ${t}`).join('\n')}\n\n## Phases\n${(plan.phases || []).map((p, i) => `### Phase ${i + 1}: ${p.name}\n${(p.tasks || []).map(t => `- [ ] ${t}`).join('\n')}`).join('\n\n')}\n`);

      writeFileSync(join(projectDir, 'CLAUDE.md'), `# Claude Code Instructions for ${plan.project_name}

## Project Context
${plan.summary}

## Tech Stack
${(plan.tech_stack || []).map(t => `- ${t}`).join('\n')}

## Current Phase
Phase 1: ${plan.phases?.[0]?.name || 'Setup'}

## Tasks
${(plan.phases?.[0]?.tasks || []).map(t => `- [ ] ${t}`).join('\n')}

## Rules
- Write clean, well-documented code
- Include error handling
- Write tests for critical paths
- Commit after each completed task
- Ask for clarification before making assumptions
`);

      writeFileSync(join(projectDir, '.gitignore'), `node_modules/\n.env\n*.log\ndist/\n.DS_Store\n`);

      writeFileSync(join(projectDir, 'plan.json'), JSON.stringify(plan, null, 2));

      console.log(chalk.green(`\n  ✓ Project scaffolded at: ${projectDir}`));
      console.log();
      console.log(chalk.hex('#FF6B00')('  ── Next Steps ──\n'));
      console.log(chalk.gray('  1. ') + chalk.white(`cd ${plan.project_name}`));
      console.log(chalk.gray('  2. ') + chalk.white('claude') + chalk.gray('  ← Start Claude Code'));
      console.log(chalk.gray('  3. ') + chalk.white('Tell Claude: "Read CLAUDE.md and start Phase 1"'));
      console.log();

      if (plan.claude_code_commands?.length > 0) {
        console.log(chalk.hex('#FF6B00')('  Suggested Claude Code commands:\n'));
        for (const cmd of plan.claude_code_commands) {
          console.log(chalk.cyan(`  > ${cmd}`));
        }
        console.log();
      }

      // Track project
      const project = {
        id: `project-${Date.now()}`,
        gig_id: gig.id,
        name: plan.project_name,
        gig_title: gig.title,
        platform: gig.platform,
        plan,
        directory: projectDir,
        status: 'active',
        created_at: new Date().toISOString(),
        client: gig.client_info,
        value: gig.budget,
      };

      config.projects.push(project);
      saveProjects(config.projects);
    }

  } catch (err) {
    spinner.fail(`  Error: ${err.message}`);
  }
}
