import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadAutopilotConfig, saveAutopilotConfig } from '../automation/autopilot-config.js';
import { getPipelineStats, getGigsByState, States } from '../automation/pipeline.js';
import { readLogs } from '../utils/logger.js';

const PID_FILE = join(homedir(), '.hustlebot', 'daemon.pid');

export async function autopilotStart() {
  if (isDaemonRunning()) {
    console.log(chalk.yellow('\n  ⚠ Autopilot is already running.\n'));
    return;
  }

  const config = loadAutopilotConfig();
  if (!config.enabled && !config.discord_webhook) {
    console.log(chalk.yellow('\n  ⚠ Run ') + chalk.white('hustlebot autopilot config') + chalk.yellow(' first to set up.\n'));
    return;
  }

  console.log(chalk.hex('#FF6B00')('\n  🚀 Starting HustleBot Autopilot...\n'));

  const daemonPath = join(import.meta.dirname, '..', 'automation', 'daemon.js');

  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });

  child.unref();
  writeFileSync(PID_FILE, String(child.pid));

  const autonomyLabels = { 1: 'Supervised', 2: 'Semi-Auto', 3: 'Full-Auto' };

  console.log(chalk.green('  ✓ Autopilot daemon started!'));
  console.log(chalk.gray(`  PID: ${child.pid}`));
  console.log(chalk.gray(`  Autonomy: ${autonomyLabels[config.autonomy_level] || 'Supervised'}`));
  console.log(chalk.gray(`  Scan interval: every ${config.scan_interval_hours}h`));
  console.log(chalk.gray(`  Max proposals/day: ${config.max_proposals_per_day}`));
  if (config.discord_webhook) {
    console.log(chalk.gray('  Discord notifications: enabled'));
  }
  console.log();
  console.log(chalk.gray('  View logs: ') + chalk.white('hustlebot autopilot logs'));
  console.log(chalk.gray('  Check status: ') + chalk.white('hustlebot autopilot status'));
  console.log(chalk.gray('  Stop: ') + chalk.white('hustlebot autopilot stop'));
  console.log();
}

export async function autopilotStop() {
  if (!isDaemonRunning()) {
    console.log(chalk.yellow('\n  ⚠ Autopilot is not running.\n'));
    return;
  }

  const pid = readFileSync(PID_FILE, 'utf-8').trim();

  try {
    process.kill(parseInt(pid), 'SIGTERM');
    unlinkSync(PID_FILE);
    console.log(chalk.green(`\n  ✓ Autopilot stopped (PID: ${pid}).\n`));
  } catch (err) {
    unlinkSync(PID_FILE);
    console.log(chalk.yellow(`\n  ⚠ Process ${pid} was not running. Cleaned up PID file.\n`));
  }
}

export async function autopilotStatus() {
  const running = isDaemonRunning();
  const config = loadAutopilotConfig();
  const stats = getPipelineStats();
  const autonomyLabels = { 1: 'Supervised', 2: 'Semi-Auto', 3: 'Full-Auto' };

  console.log(chalk.hex('#FF6B00')('\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.hex('#FF6B00')('  ██ AUTOPILOT STATUS'));
  console.log(chalk.hex('#FF6B00')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const statusColor = running ? chalk.green : chalk.red;
  console.log(chalk.white('  Daemon: ') + statusColor(running ? '● RUNNING' : '○ STOPPED'));
  console.log(chalk.white('  Autonomy: ') + chalk.cyan(autonomyLabels[config.autonomy_level] || 'Supervised'));
  console.log(chalk.white('  Scan interval: ') + chalk.gray(`every ${config.scan_interval_hours}h`));
  console.log(chalk.white('  Discord: ') + chalk.gray(config.discord_webhook ? 'connected' : 'not configured'));
  console.log();

  // Pipeline stats
  console.log(boxen(
    chalk.hex('#FF6B00')('  PIPELINE\n\n') +
    chalk.gray(`  Discovered:     `) + chalk.white(stats.DISCOVERED || 0) + '\n' +
    chalk.gray(`  Scored:         `) + chalk.white(stats.SCORED || 0) + '\n' +
    chalk.yellow(`  Draft:          `) + chalk.white(stats.PROPOSAL_DRAFT || 0) + '\n' +
    chalk.yellow(`  Needs Review:   `) + chalk.white(stats.PROPOSAL_REVIEW || 0) + '\n' +
    chalk.cyan(`  Submitted:      `) + chalk.white(stats.SUBMITTED || 0) + '\n' +
    chalk.blue(`  Waiting:        `) + chalk.white(stats.WAITING || 0) + '\n' +
    chalk.green(`  Won:            `) + chalk.white(stats.WON || 0) + '\n' +
    chalk.magenta(`  Delivering:     `) + chalk.white(stats.DELIVERING || 0) + '\n' +
    chalk.green(`  Delivered:      `) + chalk.white(stats.DELIVERED || 0) + '\n' +
    chalk.hex('#FFD700')(`  Paid:           `) + chalk.white(stats.PAID || 0) + '\n' +
    chalk.red(`  Lost/Skipped:   `) + chalk.white((stats.LOST || 0) + (stats.SKIPPED || 0)),
    { padding: 1, borderColor: '#FF6B00', borderStyle: 'round' }
  ));

  // Pending reviews
  const reviewGigs = getGigsByState(States.PROPOSAL_REVIEW);
  if (reviewGigs.length > 0) {
    console.log(chalk.hex('#FF6B00')('\n  ── Awaiting Your Review ──\n'));
    for (const entry of reviewGigs.slice(0, 5)) {
      console.log(chalk.white(`  • [${entry.score}%] `) + chalk.cyan(entry.gig.title?.substring(0, 60)));
      console.log(chalk.gray(`    ${entry.gig.platform} | ${entry.gig.budget || 'Budget TBD'}`));
    }
  }

  console.log();
}

export async function autopilotConfig() {
  console.log(chalk.hex('#FF6B00')('\n  ⚙️  Autopilot Configuration\n'));

  const current = loadAutopilotConfig();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'autonomy_level',
      message: chalk.white('Autonomy level:'),
      choices: [
        { name: '1 — Supervised: scan + draft proposals, you approve before submit', value: 1 },
        { name: '2 — Semi-Auto: auto-submit for 85%+ scores, review 70-84%', value: 2 },
        { name: '3 — Full-Auto: auto-submit 70%+, auto-deliver won gigs', value: 3 },
      ],
      default: current.autonomy_level - 1,
    },
    {
      type: 'input',
      name: 'discord_webhook',
      message: chalk.white('Discord webhook URL') + chalk.gray(' (for notifications):'),
      default: current.discord_webhook || '',
    },
    {
      type: 'list',
      name: 'scan_interval_hours',
      message: chalk.white('Scan interval:'),
      choices: [
        { name: 'Every 1 hour', value: 1 },
        { name: 'Every 2 hours (recommended)', value: 2 },
        { name: 'Every 4 hours', value: 4 },
        { name: 'Every 8 hours', value: 8 },
      ],
      default: [1, 2, 4, 8].indexOf(current.scan_interval_hours),
    },
    {
      type: 'input',
      name: 'min_score_propose',
      message: chalk.white('Minimum score to generate proposals (0-100):'),
      default: String(current.min_score_propose),
      validate: v => !isNaN(parseInt(v)) && parseInt(v) >= 0 && parseInt(v) <= 100 ? true : 'Enter 0-100',
    },
    {
      type: 'input',
      name: 'max_proposals_per_day',
      message: chalk.white('Max proposals per day:'),
      default: String(current.max_proposals_per_day),
      validate: v => !isNaN(parseInt(v)) && parseInt(v) > 0 ? true : 'Enter a positive number',
    },
  ]);

  const newConfig = {
    ...current,
    enabled: true,
    autonomy_level: answers.autonomy_level,
    discord_webhook: answers.discord_webhook || null,
    scan_interval_hours: answers.scan_interval_hours,
    min_score_propose: parseInt(answers.min_score_propose),
    max_proposals_per_day: parseInt(answers.max_proposals_per_day),
  };

  saveAutopilotConfig(newConfig);

  console.log(chalk.green('\n  ✓ Autopilot configured!\n'));
  console.log(chalk.gray('  Start it with: ') + chalk.white('hustlebot autopilot start'));
  console.log();
}

export async function autopilotLogs() {
  console.log(chalk.hex('#FF6B00')('\n  ── Autopilot Logs ──\n'));
  const logs = readLogs('autopilot.log', 40);
  console.log(chalk.gray(logs));
  console.log();
}

export async function autopilotRunNow() {
  console.log(chalk.hex('#FF6B00')('\n  ⚡ Running immediate scan + propose cycle...\n'));

  // Import and run the daemon's scan cycle directly
  const { startDaemon } = await import('../automation/daemon.js');

  // Override to run once then exit
  const config = loadAutopilotConfig();
  if (!config.enabled) {
    config.enabled = true;
    saveAutopilotConfig(config);
  }

  // Just start the daemon — it runs an immediate cycle
  // But we want it in the foreground this time
  const daemonPath = join(import.meta.dirname, '..', 'automation', 'daemon.js');
  const { execFileSync } = await import('child_process');

  try {
    execFileSync(process.execPath, [daemonPath, '--run-once'], {
      stdio: 'inherit',
      env: { ...process.env, HUSTLEBOT_RUN_ONCE: '1' },
      timeout: 5 * 60 * 1000,
    });
  } catch {
    // Process exits after run-once
  }

  console.log(chalk.green('\n  ✓ Cycle complete. Check ') + chalk.white('hustlebot autopilot status') + chalk.green(' for results.\n'));
}

function isDaemonRunning() {
  if (!existsSync(PID_FILE)) return false;
  const pid = readFileSync(PID_FILE, 'utf-8').trim();
  try {
    process.kill(parseInt(pid), 0); // Signal 0 just checks existence
    return true;
  } catch {
    // PID doesn't exist, clean up
    try { unlinkSync(PID_FILE); } catch {}
    return false;
  }
}
