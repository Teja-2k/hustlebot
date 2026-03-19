/**
 * Factory Orchestrator — The main pipeline that ties everything together
 *
 * research → plan → build → test → deploy → market → sell → iterate
 *
 * This is the BRAIN of the Product Factory.
 */

import { runMarketResearch, getCuratedIdeas } from './market-research.js';
import { addProduct, updateProduct, ProductState, ProductTypes, loadCatalog,
  getProductsByState, getTopProducts, getStalledProducts, getCatalogSummary } from './product-catalog.js';
import { buildProduct, runProductQuality } from './product-builder.js';
import { fullDeploy, deployToVercel, pushToGitHub } from './deployer.js';
import { launchGrowthCampaign, getGrowthQueue } from './growth-engine.js';

/**
 * FULL PIPELINE: From idea to live product with marketing
 *
 * This is the money-making loop.
 */
export async function runFullPipeline(options = {}) {
  console.log('\n  ┌─────────────────────────────────────────┐');
  console.log('  │     🏭 AI PRODUCT FACTORY — RUNNING      │');
  console.log('  └─────────────────────────────────────────┘\n');

  const results = {
    researched: 0,
    built: 0,
    deployed: 0,
    marketed: 0,
    errors: [],
  };

  // ═══════════════════════════════════════
  // STEP 1: Market Research
  // ═══════════════════════════════════════
  console.log('  ╔═══ STEP 1: Market Research ═══╗\n');

  let ideas;
  if (options.skipResearch) {
    ideas = getCuratedIdeas(options.maxProducts || 3);
  } else {
    const research = await runMarketResearch();
    ideas = research.ideas.slice(0, options.maxProducts || 3);
  }

  console.log(`\n  💡 Top ${ideas.length} product ideas:\n`);
  ideas.forEach((idea, i) => {
    const typeInfo = ProductTypes[idea.type] || {};
    console.log(`  ${i + 1}. [${idea.demandScore}/100] ${idea.name}`);
    console.log(`     Type: ${typeInfo.name} | Price: $${idea.price} | Tier: ${typeInfo.tier}`);
  });
  results.researched = ideas.length;

  // ═══════════════════════════════════════
  // STEP 2: Add to catalog and build
  // ═══════════════════════════════════════
  console.log('\n  ╔═══ STEP 2: Build Products ═══╗\n');

  for (const idea of ideas) {
    const product = addProduct(idea);
    console.log(`\n  ━━━ Building: ${product.name} ━━━`);

    // Build it
    const buildResult = await buildProduct(product);

    if (buildResult.success) {
      results.built++;

      // Quality check
      console.log('  🔍 Running quality checks...');
      const quality = await runProductQuality(product);
      console.log(`  ${quality.passed ? '✅' : '⚠'} Quality: ${quality.summary}`);

      if (quality.passed || quality.score >= 60) {
        // Deploy if we have config
        if (!options.skipDeploy) {
          console.log('  🚀 Deploying...');
          const deploy = await fullDeploy(product);
          if (deploy.success) {
            results.deployed++;

            // Launch marketing
            if (!options.skipMarketing) {
              const growth = await launchGrowthCampaign(product);
              if (growth) results.marketed++;
            }
          } else {
            console.log(`  ⚠ Deploy partial: ${deploy.summary}`);
          }
        } else {
          console.log('  ⏭ Skipping deploy (--skip-deploy)');
          updateProduct(product.id, { state: ProductState.READY });
        }
      } else {
        console.log('  ❌ Quality too low — needs manual review');
        results.errors.push(`${product.name}: Quality score ${quality.score}%`);
      }
    } else {
      results.errors.push(`${product.name}: Build failed`);
    }
  }

  // ═══════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════
  console.log('\n  ╔═══ PIPELINE COMPLETE ═══╗\n');
  console.log(`  📊 Research: ${results.researched} ideas found`);
  console.log(`  🏗 Built:    ${results.built}/${results.researched} products`);
  console.log(`  🚀 Deployed: ${results.deployed}/${results.built} live`);
  console.log(`  📢 Marketed: ${results.marketed}/${results.deployed} campaigns`);

  if (results.errors.length > 0) {
    console.log(`  ⚠ Errors:`);
    results.errors.forEach(e => console.log(`    - ${e}`));
  }

  return results;
}

/**
 * Build a single specific product (by idea or custom spec)
 */
export async function buildSingleProduct(spec) {
  console.log(`\n  🏭 Building single product: ${spec.name}\n`);

  const product = addProduct(spec);
  const buildResult = await buildProduct(product);

  if (buildResult.success) {
    const quality = await runProductQuality(product);
    console.log(`\n  Quality: ${quality.summary}`);
    return { success: true, product, quality, files: buildResult.files };
  }

  return { success: false, product, error: buildResult.error };
}

/**
 * Get factory status dashboard data
 */
export function getFactoryStatus() {
  const catalog = getCatalogSummary();
  const growthQueue = getGrowthQueue();
  const stalled = getStalledProducts();
  const topProducts = getTopProducts(5);

  return {
    catalog,
    growthQueue: {
      pending: growthQueue.filter(q => q.status === 'pending_approval').length,
      total: growthQueue.length,
    },
    stalledProducts: stalled.length,
    topProducts: topProducts.map(p => ({
      name: p.name,
      revenue: p.totalRevenue,
      sales: p.totalSales,
      state: p.state,
    })),
    health: {
      productsLive: catalog.byState.live,
      productsBuilding: catalog.byState.building,
      ideas: catalog.byState.ideas,
      totalRevenue: catalog.revenue.total,
    },
  };
}

/**
 * Nightly consolidation — check what's working, what's not
 */
export async function nightlyConsolidation() {
  console.log('\n  🌙 Running nightly consolidation...\n');

  // 1. Check stalled products
  const stalled = getStalledProducts();
  if (stalled.length > 0) {
    console.log(`  ⚠ ${stalled.length} products with no sales in 7 days:`);
    stalled.forEach(p => console.log(`    - ${p.name} (deployed: ${p.deployedAt})`));
  }

  // 2. Check top performers
  const top = getTopProducts(3);
  if (top.length > 0) {
    console.log(`\n  🏆 Top performers:`);
    top.forEach(p => console.log(`    - ${p.name}: $${p.totalRevenue} (${p.totalSales} sales)`));
  }

  // 3. Suggest new products based on what's selling
  const catalog = loadCatalog();
  const typePerformance = {};
  for (const product of catalog.products) {
    if (!typePerformance[product.type]) {
      typePerformance[product.type] = { revenue: 0, count: 0 };
    }
    typePerformance[product.type].revenue += product.totalRevenue || 0;
    typePerformance[product.type].count++;
  }

  const bestTypes = Object.entries(typePerformance)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3);

  if (bestTypes.length > 0) {
    console.log('\n  📈 Best performing product types:');
    bestTypes.forEach(([type, stats]) => {
      console.log(`    - ${ProductTypes[type]?.name || type}: $${stats.revenue} from ${stats.count} products`);
    });
    console.log('\n  💡 Recommendation: Build more of your top-performing types!');
  }

  // 4. Growth queue check
  const queue = getGrowthQueue();
  const pending = queue.filter(q => q.status === 'pending_approval');
  if (pending.length > 0) {
    console.log(`\n  📬 ${pending.length} marketing posts awaiting approval`);
  }

  return {
    stalledProducts: stalled.length,
    topProducts: top,
    bestTypes,
    pendingMarketing: pending.length,
  };
}
