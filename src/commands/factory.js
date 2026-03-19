/**
 * Factory CLI Command — The user-facing interface to the Product Factory
 *
 * Usage:
 *   hustlebot factory              — Show factory status dashboard
 *   hustlebot factory research     — Scan market for opportunities
 *   hustlebot factory build        — Build top product ideas
 *   hustlebot factory build-one    — Build a specific product
 *   hustlebot factory deploy <id>  — Deploy a built product
 *   hustlebot factory launch       — Full pipeline: research → build → deploy → market
 *   hustlebot factory catalog      — Show all products
 *   hustlebot factory growth       — Show marketing queue
 *   hustlebot factory config       — Configure deployment keys
 *   hustlebot factory nightly      — Run nightly consolidation
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { runMarketResearch, getCuratedIdeas } from '../factory/market-research.js';
import { addProduct, loadCatalog, ProductState, ProductTypes, getCatalogSummary,
  getProductsByState, updateProduct } from '../factory/product-catalog.js';
import { buildProduct, runProductQuality } from '../factory/product-builder.js';
import { fullDeploy, deployToVercel, loadDeployConfig, saveDeployConfig } from '../factory/deployer.js';
import { launchGrowthCampaign, getGrowthQueue, approveQueueItem } from '../factory/growth-engine.js';
import { runFullPipeline, getFactoryStatus, nightlyConsolidation, buildSingleProduct } from '../factory/factory.js';

export default function registerFactoryCommand(program) {
  const factory = program
    .command('factory [action]')
    .description('🏭 AI Product Factory — Build & sell digital products autonomously')
    .option('--max <n>', 'Max products to build', '3')
    .option('--skip-deploy', 'Skip deployment step')
    .option('--skip-marketing', 'Skip marketing step')
    .option('--skip-research', 'Use curated ideas instead of live research')
    .action(async (action, options) => {
      switch (action) {
        case 'research':
          await handleResearch();
          break;
        case 'build':
          await handleBuild(options);
          break;
        case 'build-one':
          await handleBuildOne();
          break;
        case 'deploy':
          await handleDeploy();
          break;
        case 'launch':
          await handleLaunch(options);
          break;
        case 'catalog':
          handleCatalog();
          break;
        case 'growth':
          await handleGrowth();
          break;
        case 'config':
          await handleConfig();
          break;
        case 'nightly':
          await nightlyConsolidation();
          break;
        default:
          handleStatus();
          break;
      }
    });
}

/**
 * Show factory status dashboard
 */
function handleStatus() {
  const status = getFactoryStatus();

  console.log(chalk.bold('\n  🏭 AI Product Factory — Status\n'));

  // Product pipeline
  const table = new Table({
    head: ['', 'Count'].map(h => chalk.cyan(h)),
    style: { head: [], border: ['grey'] },
  });

  table.push(
    ['💡 Ideas', status.catalog.byState.ideas],
    ['🏗 Building', status.catalog.byState.building],
    ['🟢 Live', status.catalog.byState.live],
    ['⏸ Paused', status.catalog.byState.paused],
    ['💀 Killed', status.catalog.byState.killed],
  );
  console.log(table.toString());

  // Revenue
  console.log(chalk.bold('\n  💰 Revenue'));
  console.log(`  Total: ${chalk.green('$' + status.catalog.revenue.total)}`);
  console.log(`  Top Product: ${status.catalog.revenue.topProduct}`);

  // Growth queue
  if (status.growthQueue.pending > 0) {
    console.log(chalk.yellow(`\n  📬 ${status.growthQueue.pending} marketing posts awaiting approval`));
    console.log('  Run: hustlebot factory growth');
  }

  // Top products
  if (status.topProducts.length > 0) {
    console.log(chalk.bold('\n  🏆 Top Products'));
    status.topProducts.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} — $${p.revenue} (${p.sales} sales)`);
    });
  }

  // Stalled
  if (status.stalledProducts > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${status.stalledProducts} products with no sales in 7 days`));
  }

  console.log(chalk.dim('\n  Commands:'));
  console.log(chalk.dim('  hustlebot factory research  — Find new opportunities'));
  console.log(chalk.dim('  hustlebot factory launch    — Full pipeline (research → build → deploy → market)'));
  console.log(chalk.dim('  hustlebot factory build-one — Build a specific product'));
  console.log(chalk.dim('  hustlebot factory catalog   — View all products'));
  console.log(chalk.dim('  hustlebot factory config    — Set up Vercel/Lemon Squeezy keys\n'));
}

/**
 * Run market research
 */
async function handleResearch() {
  console.log(chalk.bold('\n  🔍 Running Market Research...\n'));

  const research = await runMarketResearch();

  console.log(chalk.bold('\n  💡 Top Product Ideas:\n'));

  const table = new Table({
    head: ['#', 'Score', 'Product Idea', 'Type', 'Price'].map(h => chalk.cyan(h)),
    style: { head: [], border: ['grey'] },
    colWidths: [4, 7, 45, 20, 8],
  });

  research.ideas.slice(0, 15).forEach((idea, i) => {
    const typeInfo = ProductTypes[idea.type] || {};
    const scoreColor = idea.demandScore >= 80 ? chalk.green : idea.demandScore >= 60 ? chalk.yellow : chalk.red;
    table.push([
      i + 1,
      scoreColor(idea.demandScore),
      idea.name.slice(0, 43),
      typeInfo.name?.slice(0, 18) || idea.type,
      `$${idea.price || typeInfo.defaultPrice || 29}`,
    ]);
  });

  console.log(table.toString());

  console.log(chalk.dim(`\n  Sources: PH:${research.sources.productHunt} Reddit:${research.sources.reddit} HN:${research.sources.hackerNews} GH:${research.sources.github} Curated:${research.sources.curated}`));
  console.log(chalk.dim('  Run: hustlebot factory build — to build top ideas'));
  console.log(chalk.dim('  Run: hustlebot factory build-one — to build a specific one\n'));
}

/**
 * Build products from top ideas
 */
async function handleBuild(options) {
  const max = parseInt(options.max) || 3;
  const ideas = getCuratedIdeas(max);

  console.log(chalk.bold(`\n  🏗 Building top ${max} products...\n`));

  for (const idea of ideas) {
    const product = addProduct(idea);
    console.log(chalk.bold(`\n  ━━━ ${product.name} ━━━`));

    const result = await buildProduct(product);
    if (result.success) {
      console.log(chalk.green(`  ✅ Built: ${result.files.length} files`));

      const quality = await runProductQuality(product);
      console.log(`  Quality: ${quality.summary}`);
    } else {
      console.log(chalk.red(`  ❌ Failed: ${result.error?.slice(0, 100)}`));
    }
  }
}

/**
 * Build a specific product (interactive)
 */
async function handleBuildOne() {
  const ideas = getCuratedIdeas(20);

  const choices = ideas.map((idea, i) => ({
    name: `[${idea.demandScore}] $${idea.price} — ${idea.name}`,
    value: i,
  }));

  const { selection } = await inquirer.prompt([{
    type: 'list',
    name: 'selection',
    message: 'Which product do you want to build?',
    choices,
    pageSize: 20,
  }]);

  const idea = ideas[selection];
  console.log(chalk.bold(`\n  🏗 Building: ${idea.name}\n`));

  const result = await buildSingleProduct(idea);

  if (result.success) {
    console.log(chalk.green(`\n  ✅ Product built! ${result.files.length} files created`));
    console.log(`  Quality: ${result.quality.summary}`);
    console.log(`  Directory: ${result.product.buildDir}`);
    console.log(chalk.dim('\n  Next: hustlebot factory deploy'));
  } else {
    console.log(chalk.red(`\n  ❌ Build failed: ${result.error?.slice(0, 200)}`));
  }
}

/**
 * Deploy a ready product
 */
async function handleDeploy() {
  const ready = getProductsByState(ProductState.READY);
  const tested = getProductsByState(ProductState.TESTING);
  const deployable = [...ready, ...tested];

  if (deployable.length === 0) {
    console.log(chalk.yellow('\n  No products ready to deploy. Run: hustlebot factory build\n'));
    return;
  }

  const { productId } = await inquirer.prompt([{
    type: 'list',
    name: 'productId',
    message: 'Which product to deploy?',
    choices: deployable.map(p => ({
      name: `${p.name} ($${p.price}) — ${p.state}`,
      value: p.id,
    })),
  }]);

  const product = deployable.find(p => p.id === productId);
  console.log(chalk.bold(`\n  🚀 Deploying: ${product.name}\n`));

  const result = await fullDeploy(product);
  console.log(`\n  ${result.summary}`);
}

/**
 * Full launch pipeline
 */
async function handleLaunch(options) {
  await runFullPipeline({
    maxProducts: parseInt(options.max) || 3,
    skipDeploy: options.skipDeploy,
    skipMarketing: options.skipMarketing,
    skipResearch: options.skipResearch,
  });
}

/**
 * Show product catalog
 */
function handleCatalog() {
  const catalog = loadCatalog();

  if (catalog.products.length === 0) {
    console.log(chalk.yellow('\n  No products yet. Run: hustlebot factory launch\n'));
    return;
  }

  console.log(chalk.bold(`\n  📦 Product Catalog (${catalog.products.length} products)\n`));

  const table = new Table({
    head: ['Name', 'Type', 'State', 'Price', 'Sales', 'Revenue', 'URL'].map(h => chalk.cyan(h)),
    style: { head: [], border: ['grey'] },
    colWidths: [30, 15, 12, 8, 7, 10, 30],
  });

  for (const p of catalog.products) {
    const stateColors = {
      [ProductState.IDEA]: chalk.dim,
      [ProductState.BUILDING]: chalk.yellow,
      [ProductState.LIVE]: chalk.green,
      [ProductState.PAUSED]: chalk.gray,
      [ProductState.KILLED]: chalk.red,
    };
    const colorFn = stateColors[p.state] || chalk.white;

    table.push([
      p.name.slice(0, 28),
      ProductTypes[p.type]?.name?.slice(0, 13) || p.type,
      colorFn(p.state),
      `$${p.price}`,
      p.totalSales,
      chalk.green(`$${p.totalRevenue}`),
      (p.deployUrl || '').slice(0, 28) || '-',
    ]);
  }

  console.log(table.toString());
  console.log(`\n  Total Revenue: ${chalk.green('$' + catalog.stats.totalRevenue)}\n`);
}

/**
 * Show and manage growth queue
 */
async function handleGrowth() {
  const queue = getGrowthQueue();
  const pending = queue.filter(q => q.status === 'pending_approval');

  if (pending.length === 0) {
    console.log(chalk.yellow('\n  No pending marketing posts. Products need to be built and deployed first.\n'));
    return;
  }

  console.log(chalk.bold(`\n  📬 Growth Queue (${pending.length} pending)\n`));

  for (const [i, item] of pending.entries()) {
    const platform = item.platform === 'twitter' ? '🐦 Twitter' : '📮 Reddit';
    console.log(`  ${i + 1}. ${platform}${item.subreddit ? ` r/${item.subreddit}` : ''}`);
    console.log(`     ${chalk.dim(item.content?.slice(0, 100) || item.title?.slice(0, 100))}`);
    console.log('');
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What do you want to do?',
    choices: [
      { name: 'Approve all', value: 'approve_all' },
      { name: 'Skip for now', value: 'skip' },
    ],
  }]);

  if (action === 'approve_all') {
    pending.forEach((_, i) => approveQueueItem(i));
    console.log(chalk.green(`\n  ✅ ${pending.length} posts approved!\n`));
  }
}

/**
 * Configure deployment keys
 */
async function handleConfig() {
  const config = loadDeployConfig();

  console.log(chalk.bold('\n  ⚙️ Factory Configuration\n'));
  console.log(`  Vercel Token: ${config.vercel?.token ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
  console.log(`  GitHub Org:   ${config.github?.org ? chalk.green(config.github.org) : chalk.red('✗ Not set')}`);
  console.log(`  Lemon Squeezy: ${config.lemonsqueezy?.apiKey ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
  console.log(`  Domain:       ${config.domain ? chalk.green(config.domain) : chalk.dim('Not set')}`);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'vercelToken',
      message: 'Vercel Token (from vercel.com/account/tokens):',
      default: config.vercel?.token || '',
      when: () => !config.vercel?.token,
    },
    {
      type: 'input',
      name: 'githubOrg',
      message: 'GitHub username/org for repos:',
      default: config.github?.org || '',
    },
    {
      type: 'input',
      name: 'lemonApiKey',
      message: 'Lemon Squeezy API Key (from dashboard.lemonsqueezy.com):',
      default: config.lemonsqueezy?.apiKey || '',
      when: () => !config.lemonsqueezy?.apiKey,
    },
    {
      type: 'input',
      name: 'lemonStoreId',
      message: 'Lemon Squeezy Store ID:',
      default: config.lemonsqueezy?.storeId || '',
      when: () => !config.lemonsqueezy?.storeId,
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Custom domain (optional):',
      default: config.domain || '',
    },
  ]);

  // Update config
  if (answers.vercelToken) config.vercel = { ...config.vercel, token: answers.vercelToken };
  if (answers.githubOrg) config.github = { ...config.github, org: answers.githubOrg };
  if (answers.lemonApiKey) config.lemonsqueezy = { ...config.lemonsqueezy, apiKey: answers.lemonApiKey };
  if (answers.lemonStoreId) config.lemonsqueezy = { ...config.lemonsqueezy, storeId: answers.lemonStoreId };
  if (answers.domain) config.domain = answers.domain;

  saveDeployConfig(config);
  console.log(chalk.green('\n  ✅ Configuration saved!\n'));
}
