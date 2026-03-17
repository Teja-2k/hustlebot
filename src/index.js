#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { initProfile } from './commands/init.js';
import { scanGigs } from './commands/scan.js';
import { proposeGig } from './commands/propose.js';
import { showStatus } from './commands/status.js';
import { deliverProject } from './commands/deliver.js';
import { autopilotStart, autopilotStop, autopilotStatus, autopilotConfig, autopilotLogs, autopilotRunNow } from './commands/autopilot.js';
import { launchDashboard } from './commands/dashboard.js';
import { getConfig } from './utils/config.js';

const VERSION = '0.1.0';

const banner = chalk.hex('#FF6B00')(`
██╗  ██╗██╗   ██╗███████╗████████╗██╗     ███████╗██████╗  ██████╗ ████████╗
██║  ██║██║   ██║██╔════╝╚══██╔══╝██║     ██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝
███████║██║   ██║███████╗   ██║   ██║     █████╗  ██████╔╝██║   ██║   ██║   
██╔══██║██║   ██║╚════██║   ██║   ██║     ██╔══╝  ██╔══██╗██║   ██║   ██║   
██║  ██║╚██████╔╝███████║   ██║   ███████╗███████╗██████╔╝╚██████╔╝   ██║   
╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ╚══════╝╚══════╝╚═════╝  ╚═════╝    ╚═╝   
`);

const program = new Command();

program
  .name('hustlebot')
  .description(chalk.gray('AI agent that finds freelance gigs, writes winning proposals, and helps deliver work'))
  .version(VERSION)
  .hook('preAction', () => {
    console.log(banner);
    console.log(boxen(
      chalk.white('Your AI hustle agent') + chalk.gray(' • ') + chalk.hex('#FF6B00')(`v${VERSION}`),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, borderColor: '#FF6B00', borderStyle: 'round' }
    ));
    console.log();
  });

program
  .command('init')
  .description('Set up your skill profile — tell HustleBot who you are')
  .action(async () => {
    await initProfile();
  });

program
  .command('scan')
  .description('Scan platforms for matching freelance gigs')
  .option('-p, --platform <platform>', 'Scan specific platform (upwork|twitter|hackernews|all)', 'all')
  .option('-l, --limit <number>', 'Max results to show', '20')
  .option('--min-rate <number>', 'Minimum hourly rate filter')
  .option('--min-score <number>', 'Minimum match score (0-100)', '50')
  .action(async (opts) => {
    const config = getConfig();
    if (!config.profile) {
      console.log(chalk.red('\n  ⚠ No profile found. Run ') + chalk.white('hustlebot init') + chalk.red(' first.\n'));
      process.exit(1);
    }
    await scanGigs(opts, config);
  });

program
  .command('propose')
  .description('Generate a winning proposal for a specific gig')
  .argument('<gig-id>', 'Gig ID from scan results')
  .option('--tone <tone>', 'Proposal tone (professional|casual|bold)', 'professional')
  .option('--length <length>', 'Proposal length (short|medium|long)', 'medium')
  .action(async (gigId, opts) => {
    const config = getConfig();
    if (!config.profile) {
      console.log(chalk.red('\n  ⚠ No profile found. Run ') + chalk.white('hustlebot init') + chalk.red(' first.\n'));
      process.exit(1);
    }
    await proposeGig(gigId, opts, config);
  });

program
  .command('deliver')
  .description('Set up a project workspace and scaffold deliverables')
  .argument('<gig-id>', 'Gig ID for the won project')
  .action(async (gigId) => {
    const config = getConfig();
    await deliverProject(gigId, config);
  });

program
  .command('status')
  .description('Show your hustle dashboard — earnings, pipeline, activity')
  .action(async () => {
    const config = getConfig();
    await showStatus(config);
  });

program
  .command('dashboard')
  .description('Open the web dashboard in your browser')
  .option('-p, --port <port>', 'Port to run on', '3456')
  .action(async (opts) => {
    await launchDashboard(opts);
  });

// Autopilot command group
const autopilot = program
  .command('autopilot')
  .description('Manage the autonomous hustle daemon');

autopilot
  .command('start')
  .description('Start the autopilot daemon')
  .action(autopilotStart);

autopilot
  .command('stop')
  .description('Stop the autopilot daemon')
  .action(autopilotStop);

autopilot
  .command('status')
  .description('Show autopilot pipeline and daemon status')
  .action(autopilotStatus);

autopilot
  .command('config')
  .description('Configure autopilot settings')
  .action(autopilotConfig);

autopilot
  .command('logs')
  .description('View autopilot activity logs')
  .action(autopilotLogs);

autopilot
  .command('run-now')
  .description('Trigger an immediate scan + propose cycle')
  .action(autopilotRunNow);

// Default: show help if no command
if (process.argv.length <= 2) {
  console.log(banner);
  console.log(boxen(
    chalk.white('Your AI hustle agent') + chalk.gray(' • ') + chalk.hex('#FF6B00')(`v${VERSION}`),
    { padding: { left: 2, right: 2, top: 0, bottom: 0 }, borderColor: '#FF6B00', borderStyle: 'round' }
  ));
  console.log();
  console.log(chalk.hex('#FF6B00')('  Quick Start:'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(chalk.white('  1.') + chalk.gray(' hustlebot init     ') + chalk.dim('→ Set up your profile'));
  console.log(chalk.white('  2.') + chalk.gray(' hustlebot scan     ') + chalk.dim('→ Find matching gigs'));
  console.log(chalk.white('  3.') + chalk.gray(' hustlebot propose  ') + chalk.dim('→ Write a killer proposal'));
  console.log(chalk.white('  4.') + chalk.gray(' hustlebot deliver  ') + chalk.dim('→ Scaffold & deliver work'));
  console.log(chalk.white('  5.') + chalk.gray(' hustlebot status   ') + chalk.dim('→ See your dashboard'));
  console.log();
  console.log(chalk.white('  6.') + chalk.gray(' hustlebot dashboard ') + chalk.dim('→ Open web dashboard'));
  console.log();
  console.log(chalk.hex('#FF6B00')('  Autopilot:'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(chalk.white('  7.') + chalk.gray(' hustlebot autopilot config ') + chalk.dim('→ Set up automation'));
  console.log(chalk.white('  8.') + chalk.gray(' hustlebot autopilot start  ') + chalk.dim('→ Start the daemon'));
  console.log(chalk.white('  9.') + chalk.gray(' hustlebot autopilot status ') + chalk.dim('→ Pipeline overview'));
  console.log();
  process.exit(0);
}

program.parse();
