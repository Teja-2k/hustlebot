/**
 * Heartbeat System — Proactive checks every 30 minutes
 *
 * Like Felix's heartbeat, this makes HustleBot PROACTIVE instead of reactive.
 * It continuously monitors products, checks for opportunities, and takes action.
 */

import schedule from 'node-schedule';
import fs from 'fs';
import path from 'path';
import { getProductsByState, ProductState, getStalledProducts, loadCatalog } from './product-catalog.js';
import { runMarketResearch } from './market-research.js';
import { buildProduct, runProductQuality } from './product-builder.js';
import { nightlyConsolidation } from './factory.js';
import { getGrowthQueue } from './growth-engine.js';
import { getConfigDir } from '../utils/config.js';
import { sendNotification } from '../notifications/notify.js';

const HEARTBEAT_LOG = () => path.join(getConfigDir(), 'heartbeat.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(`  💓 ${message}`);
  try {
    fs.appendFileSync(HEARTBEAT_LOG(), line + '\n');
  } catch { /* ignore */ }
}

/**
 * The heartbeat check — runs every 30 minutes
 */
async function heartbeatCheck() {
  log('Heartbeat running...');

  const catalog = loadCatalog();
  const products = catalog.products;

  // ── Check 1: Any products stuck in BUILDING state? ──
  const building = products.filter(p => p.state === ProductState.BUILDING);
  if (building.length > 0) {
    for (const p of building) {
      const buildStart = new Date(p.updatedAt);
      const hoursElapsed = (Date.now() - buildStart.getTime()) / (1000 * 60 * 60);

      if (hoursElapsed > 2) {
        log(`⚠ Product "${p.name}" stuck in BUILDING for ${hoursElapsed.toFixed(1)}h — marking as PLANNED for retry`);
        // Reset to planned so next cycle can retry
        const { updateProduct } = await import('./product-catalog.js');
        updateProduct(p.id, { state: ProductState.PLANNED });
      }
    }
  }

  // ── Check 2: Any products ready but not deployed? ──
  const ready = products.filter(p => p.state === ProductState.READY);
  if (ready.length > 0) {
    log(`📦 ${ready.length} products ready for deployment`);
    await sendNotification('FACTORY_UPDATE', {
      message: `${ready.length} products ready to deploy. Run: hustlebot factory deploy`,
    }).catch(() => {});
  }

  // ── Check 3: Growth queue items pending? ──
  const queue = getGrowthQueue();
  const pending = queue.filter(q => q.status === 'pending_approval');
  if (pending.length > 0) {
    log(`📬 ${pending.length} marketing posts awaiting approval`);
  }

  // ── Check 4: Stalled products (no sales in 7 days) ──
  const stalled = getStalledProducts();
  if (stalled.length > 0) {
    log(`⚠ ${stalled.length} live products with no sales in 7 days`);
    for (const p of stalled) {
      log(`  → ${p.name} (deployed ${p.deployedAt})`);
    }
  }

  // ── Check 5: Should we build more products? ──
  const liveCount = products.filter(p => p.state === ProductState.LIVE).length;
  const buildingCount = building.length;
  const ideas = products.filter(p => p.state === ProductState.IDEA).length;

  if (liveCount < 5 && buildingCount === 0) {
    log(`💡 Only ${liveCount} live products and nothing building — consider running factory launch`);
    if (ideas > 0) {
      log(`  → ${ideas} product ideas waiting to be built`);
    }
  }

  // ── Check 6: Revenue summary ──
  const totalRevenue = catalog.stats?.totalRevenue || 0;
  const liveProducts = products.filter(p => p.state === ProductState.LIVE);
  log(`💰 Revenue: $${totalRevenue} | Live: ${liveProducts.length} | Ideas: ${ideas} | Building: ${buildingCount}`);

  log('Heartbeat complete.');
}

/**
 * Start the heartbeat scheduler
 */
export function startHeartbeat(intervalMinutes = 30) {
  log(`Starting heartbeat (every ${intervalMinutes} minutes)`);

  // Run immediately
  heartbeatCheck().catch(e => log(`Heartbeat error: ${e.message}`));

  // Schedule recurring
  const rule = new schedule.RecurrenceRule();
  rule.minute = new schedule.Range(0, 59, intervalMinutes);

  const job = schedule.scheduleJob('heartbeat', rule, async () => {
    try {
      await heartbeatCheck();
    } catch (e) {
      log(`Heartbeat error: ${e.message}`);
    }
  });

  // Schedule nightly consolidation at 2 AM
  const nightlyRule = new schedule.RecurrenceRule();
  nightlyRule.hour = 2;
  nightlyRule.minute = 0;

  schedule.scheduleJob('nightly-consolidation', nightlyRule, async () => {
    try {
      log('Running nightly consolidation...');
      await nightlyConsolidation();
      log('Nightly consolidation complete.');
    } catch (e) {
      log(`Nightly consolidation error: ${e.message}`);
    }
  });

  log('Heartbeat started. Nightly consolidation scheduled for 2:00 AM.');
  return job;
}

/**
 * Stop the heartbeat
 */
export function stopHeartbeat() {
  schedule.cancelJob('heartbeat');
  schedule.cancelJob('nightly-consolidation');
  log('Heartbeat stopped.');
}

/**
 * Get heartbeat logs
 */
export function getHeartbeatLogs(lines = 50) {
  const logFile = HEARTBEAT_LOG();
  if (!fs.existsSync(logFile)) return [];
  const content = fs.readFileSync(logFile, 'utf-8');
  return content.split('\n').filter(Boolean).slice(-lines);
}
