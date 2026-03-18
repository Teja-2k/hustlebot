import chalk from 'chalk';
import { listAgents, classifyGig } from '../workers/router.js';

/**
 * Show all worker agents and their status.
 */
export async function showWorkers() {
  const agents = listAgents();

  console.log(chalk.hex('#FF6B00')('\n  ━━━ AI Worker Army ━━━\n'));
  console.log(chalk.gray('  Specialized agents that autonomously deliver freelance work.\n'));

  for (const agent of agents) {
    console.log(
      `  ${agent.emoji} ${chalk.white(agent.name.padEnd(14))} ` +
      chalk.gray('— ') +
      chalk.dim(agent.description)
    );
    console.log(
      chalk.gray('     Handles: ') +
      agent.keywords.slice(0, 6).map(k => chalk.cyan(k)).join(chalk.gray(', '))
    );
    console.log();
  }

  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(chalk.white('  Total agents: ') + chalk.hex('#FF6B00')(`${agents.length}`));
  console.log();
  console.log(chalk.gray('  How it works:'));
  console.log(chalk.gray('  1. Gig comes in → Router classifies it'));
  console.log(chalk.gray('  2. Correct agent spawns Claude Code with domain expertise'));
  console.log(chalk.gray('  3. Agent scaffolds, builds, and quality-checks the delivery'));
  console.log(chalk.gray('  4. You review for 5 min → submit to client'));
  console.log();
}

/**
 * Test classification of a gig title.
 */
export async function testClassify(title) {
  console.log(chalk.hex('#FF6B00')('\n  🧪 Testing gig classification\n'));

  const mockGig = {
    title,
    description: title,
    skills: [],
  };

  const result = classifyGig(mockGig);

  console.log(chalk.white('  Input: ') + chalk.dim(title));
  console.log(chalk.white('  Agent: ') + chalk.hex('#FF6B00')(`${result.emoji} ${result.agentName}`));
  console.log(chalk.white('  Type:  ') + chalk.cyan(result.type));
  console.log(chalk.white('  Score: ') + chalk.yellow(`${result.confidence}%`));
  console.log();

  // Test a batch of sample gigs
  const samples = [
    'Build a portfolio website with React',
    'Create a Telegram bot for crypto price alerts',
    'Scrape competitor pricing data from 5 websites',
    'Design YouTube thumbnail pack (10 thumbnails)',
    'Write SEO blog posts about AI automation',
    'Fix WordPress site showing 500 error',
    'Build API integration between Shopify and Airtable',
    'Create a Discord bot for server moderation',
    'Build a Streamlit dashboard for sales analytics',
    'Automate email follow-ups with n8n workflow',
  ];

  console.log(chalk.hex('#FF6B00')('  ── Sample Classifications ──\n'));

  for (const sample of samples) {
    const r = classifyGig({ title: sample, description: sample, skills: [] });
    console.log(
      `  ${r.emoji} ${chalk.cyan(r.type.padEnd(10))} ` +
      chalk.gray('→ ') +
      chalk.dim(sample.substring(0, 55))
    );
  }
  console.log();
}
