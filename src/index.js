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
import { authPlatform } from './commands/auth.js';
import { getConfig } from './utils/config.js';
import { generateDelivery, packageDelivery, listDeliveries } from './engines/delivery-engine.js';
import { trackProject, recordPayment, getEarningsStats, getProjects, updateProject, logTime } from './engines/payment-tracker.js';
import { showWorkers, testClassify } from './commands/workers.js';

const VERSION = '0.2.0';

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
  .option('-p, --platform <platform>', 'Scan specific platform (upwork|twitter|hackernews|freelancer|fiverr|all)', 'all')
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

program
  .command('auth')
  .description('Authenticate with a freelance platform')
  .argument('<platform>', 'Platform to log into (upwork|freelancer)')
  .action(async (platform) => {
    await authPlatform(platform);
  });

// Auto-deliver command
program
  .command('auto-deliver')
  .description('Auto-generate project deliverables using AI')
  .argument('<gig-id>', 'Gig ID to generate delivery for')
  .action(async (gigId) => {
    const config = getConfig();
    const gigs = config.gigs || [];
    const gig = gigs.find(g => g.display_id === parseInt(gigId) || g.id === gigId);
    if (!gig) {
      console.log(chalk.red(`\n  ⚠ Gig #${gigId} not found. Run hustlebot scan first.\n`));
      process.exit(1);
    }
    console.log(chalk.hex('#FF6B00')(`\n  🤖 Auto-generating deliverables for: ${gig.title}\n`));
    const result = await generateDelivery(gig);
    console.log(chalk.green(`\n  ✅ Generated ${result.deliverables.length} files`));
    console.log(chalk.gray(`  📁 Location: ${result.delivery_path}`));
    console.log(chalk.gray(`  📝 Notes: ${result.delivery_notes}\n`));
  });

// Earnings command group
const earnings = program
  .command('earnings')
  .description('Track earnings, payments, and project financials');

earnings
  .command('stats')
  .description('Show earnings statistics and analytics')
  .option('--period <period>', 'Time period (week|month|year|all)', 'all')
  .action(async (opts) => {
    const stats = getEarningsStats(opts.period);
    console.log(chalk.hex('#FF6B00')('\n  💰 Earnings Dashboard\n'));
    console.log(chalk.white(`  Total Earned:    `) + chalk.green(`$${stats.total_earnings.toLocaleString()}`));
    console.log(chalk.white(`  Net (after fees):`) + chalk.green(` $${stats.total_net.toLocaleString()}`));
    console.log(chalk.white(`  Platform Fees:   `) + chalk.red(`$${stats.total_fees.toLocaleString()}`));
    console.log(chalk.white(`  Hours Logged:    `) + chalk.cyan(`${stats.total_hours}h`));
    console.log(chalk.white(`  Effective Rate:  `) + chalk.cyan(`$${stats.effective_hourly_rate}/hr`));
    console.log(chalk.white(`  Pipeline Value:  `) + chalk.yellow(`$${stats.pipeline_value.toLocaleString()}`));
    console.log(chalk.gray(`\n  Conversion: ${stats.funnel.proposals_sent} sent → ${stats.funnel.accepted} accepted → ${stats.funnel.paid} paid (${stats.funnel.conversion_rate}%)`));
    if (Object.keys(stats.by_platform).length > 0) {
      console.log(chalk.hex('#FF6B00')('\n  By Platform:'));
      for (const [p, d] of Object.entries(stats.by_platform)) {
        console.log(chalk.gray(`    ${p}: $${d.earnings} (${d.count} payments, $${d.fees} fees)`));
      }
    }
    console.log();
  });

earnings
  .command('add-project')
  .description('Track a won project')
  .argument('<title>', 'Project title')
  .option('--amount <amount>', 'Agreed amount', '0')
  .option('--platform <platform>', 'Platform', 'direct')
  .option('--client <client>', 'Client name', 'Unknown')
  .action(async (title, opts) => {
    const project = trackProject({ title, amount: parseFloat(opts.amount), platform: opts.platform, client: opts.client });
    console.log(chalk.green(`\n  ✅ Project tracked: ${project.gig_title} ($${project.agreed_amount})`));
    console.log(chalk.gray(`  ID: ${project.id}\n`));
  });

earnings
  .command('add-payment')
  .description('Record a payment received')
  .argument('<amount>', 'Amount received')
  .option('--project <id>', 'Project ID')
  .option('--platform <platform>', 'Platform', 'direct')
  .option('--fee <fee>', 'Platform fee', '0')
  .option('--desc <description>', 'Description', '')
  .action(async (amount, opts) => {
    const payment = recordPayment({
      amount: parseFloat(amount), project_id: opts.project, platform: opts.platform,
      platform_fee: parseFloat(opts.fee), description: opts.desc,
    });
    console.log(chalk.green(`\n  ✅ Payment recorded: $${payment.net_amount} net`));
    console.log(chalk.gray(`  ID: ${payment.id}\n`));
  });

earnings
  .command('projects')
  .description('List all tracked projects')
  .option('--status <status>', 'Filter by status')
  .action(async (opts) => {
    const projects = getProjects(opts.status);
    if (projects.length === 0) {
      console.log(chalk.yellow('\n  No projects tracked yet. Use: hustlebot earnings add-project "Title" --amount 500\n'));
      return;
    }
    console.log(chalk.hex('#FF6B00')(`\n  📋 Projects (${projects.length})\n`));
    for (const p of projects) {
      const statusColor = p.status === 'paid' ? chalk.green : p.status === 'delivered' ? chalk.cyan :
        p.status === 'in_progress' ? chalk.yellow : chalk.gray;
      console.log(`  ${statusColor(`[${p.status.toUpperCase()}]`)} ${chalk.white(p.gig_title)} — ${chalk.green(`$${p.agreed_amount}`)} (${p.platform})`);
      console.log(chalk.gray(`    ID: ${p.id}`));
    }
    console.log();
  });

earnings
  .command('log-time')
  .description('Log hours worked on a project')
  .argument('<project-id>', 'Project ID')
  .argument('<hours>', 'Hours worked')
  .argument('[description]', 'What you worked on', 'Development work')
  .action(async (projectId, hours, description) => {
    const project = logTime(projectId, parseFloat(hours), description);
    const totalH = project.time_logged.reduce((s, t) => s + t.hours, 0);
    console.log(chalk.green(`\n  ✅ Logged ${hours}h on "${project.gig_title}" (total: ${totalH}h)\n`));
  });

// Workers command — show AI worker agents
const workers = program
  .command('workers')
  .description('Show AI worker agents and test classification');

workers
  .command('list')
  .description('List all available worker agents')
  .action(showWorkers);

workers
  .command('test')
  .description('Test gig classification with a sample title')
  .argument('[title]', 'Gig title to classify', 'Build a portfolio website')
  .action(async (title) => {
    await testClassify(title);
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
  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(chalk.white('   1.') + chalk.gray(' hustlebot init          ') + chalk.dim('→ Set up your profile'));
  console.log(chalk.white('   2.') + chalk.gray(' hustlebot scan          ') + chalk.dim('→ Find gigs (5 platforms)'));
  console.log(chalk.white('   3.') + chalk.gray(' hustlebot propose <#>   ') + chalk.dim('→ AI-write a proposal'));
  console.log(chalk.white('   4.') + chalk.gray(' hustlebot deliver <#>   ') + chalk.dim('→ Scaffold workspace'));
  console.log(chalk.white('   5.') + chalk.gray(' hustlebot auto-deliver  ') + chalk.dim('→ AI-generate full project'));
  console.log(chalk.white('   6.') + chalk.gray(' hustlebot status        ') + chalk.dim('→ Terminal dashboard'));
  console.log(chalk.white('   7.') + chalk.gray(' hustlebot dashboard     ') + chalk.dim('→ Web UI dashboard'));
  console.log();
  console.log(chalk.hex('#FF6B00')('  💰 Earnings:'));
  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(chalk.white('   8.') + chalk.gray(' hustlebot earnings stats       ') + chalk.dim('→ Revenue analytics'));
  console.log(chalk.white('   9.') + chalk.gray(' hustlebot earnings add-project ') + chalk.dim('→ Track a won gig'));
  console.log(chalk.white('  10.') + chalk.gray(' hustlebot earnings add-payment ') + chalk.dim('→ Record payment'));
  console.log(chalk.white('  11.') + chalk.gray(' hustlebot earnings projects    ') + chalk.dim('→ All projects'));
  console.log();
  console.log(chalk.hex('#FF6B00')('  🤖 AI Worker Army:'));
  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(chalk.white('  12.') + chalk.gray(' hustlebot workers list      ') + chalk.dim('→ Show all worker agents'));
  console.log(chalk.white('  13.') + chalk.gray(' hustlebot workers test      ') + chalk.dim('→ Test gig classification'));
  console.log();
  console.log(chalk.hex('#FF6B00')('  ⚙️  Autopilot:'));
  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(chalk.white('  14.') + chalk.gray(' hustlebot autopilot config  ') + chalk.dim('→ Set up automation'));
  console.log(chalk.white('  15.') + chalk.gray(' hustlebot autopilot start   ') + chalk.dim('→ Start the daemon'));
  console.log(chalk.white('  16.') + chalk.gray(' hustlebot autopilot status  ') + chalk.dim('→ Pipeline overview'));
  console.log(chalk.white('  17.') + chalk.gray(' hustlebot auth <platform>   ') + chalk.dim('→ Login for auto-submit'));
  console.log();
  process.exit(0);
}

program.parse();
