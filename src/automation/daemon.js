import schedule from 'node-schedule';
import { scanUpwork } from '../scanners/upwork.js';
import { scanTwitter } from '../scanners/twitter.js';
import { scanHackerNews } from '../scanners/hackernews.js';
import { scanFreelancer } from '../scanners/freelancer.js';
import { scanFiverr } from '../scanners/fiverr.js';
import { scoreGigMatch, generateProposal, classifyGigType, assessDeliverability } from '../engines/ai.js';
import { getConfig, getApiKey, saveGigs } from '../utils/config.js';
import { filterNewGigs } from './dedup.js';
import { addGigToPipeline, advanceGig, getGigsByState, getTodayProposalCount, States } from './pipeline.js';
import { submitProposal } from './submitter.js';
import { runDelivery } from './delivery-runner.js';
import { notify, setNotifyConfig } from '../notifications/notify.js';
import { log, warn, error as logError } from '../utils/logger.js';
import { loadAutopilotConfig } from './autopilot-config.js';

let isRunning = false;

export async function startDaemon() {
  const autopilotConfig = loadAutopilotConfig();
  setNotifyConfig(autopilotConfig);

  log('========================================');
  log('[DAEMON] HustleBot Autopilot starting...');
  log(`[DAEMON] Autonomy level: ${autopilotConfig.autonomy_level}`);
  log(`[DAEMON] Scan interval: ${autopilotConfig.scan_interval_hours}h`);
  log('========================================');

  // Run initial cycle immediately
  await runScanCycle(autopilotConfig);

  // Schedule recurring jobs
  const scanCron = `0 */${autopilotConfig.scan_interval_hours || 2} * * *`;

  schedule.scheduleJob('scan', scanCron, () => runScanCycle(autopilotConfig));
  schedule.scheduleJob('propose', '*/30 * * * *', () => runProposeCycle(autopilotConfig));
  schedule.scheduleJob('deliver', '*/15 * * * *', () => runDeliveryCycle(autopilotConfig));
  schedule.scheduleJob('messages', '*/10 * * * *', () => runMessageCycle(autopilotConfig));

  log('[DAEMON] Scheduler started. Jobs:');
  log(`  - Scan: ${scanCron}`);
  log(`  - Propose: every 30 min`);
  log(`  - Deliver: every 15 min`);
  log(`  - Messages: every 10 min`);

  await notify('CYCLE_SUMMARY', { scanned: 0, newGigs: 0, proposed: 0 });

  // Keep alive
  process.on('SIGINT', () => {
    log('[DAEMON] Shutting down...');
    schedule.gracefulShutdown().then(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    log('[DAEMON] Terminated.');
    schedule.gracefulShutdown().then(() => process.exit(0));
  });
}

async function runScanCycle(autopilotConfig) {
  if (isRunning) { log('[SCAN] Cycle already in progress, skipping.'); return; }
  isRunning = true;

  try {
    const config = getConfig();
    if (!config.profile) { warn('[SCAN] No profile found. Skipping.'); return; }

    const keywords = config.profile.search_keywords || [];
    const platforms = config.profile.platforms || ['upwork', 'twitter', 'hackernews'];

    log(`[SCAN] Starting scan cycle. Keywords: ${keywords.join(', ')}`);

    let allGigs = [];

    for (const platform of platforms) {
      try {
        let gigs = [];
        switch (platform) {
          case 'upwork': gigs = await scanUpwork(keywords, { limit: 20 }); break;
          case 'twitter': gigs = await scanTwitter(keywords, { limit: 10 }); break;
          case 'hackernews': gigs = await scanHackerNews(keywords, { limit: 10 }); break;
          case 'freelancer': gigs = await scanFreelancer(keywords, { limit: 15 }); break;
          case 'fiverr': gigs = await scanFiverr(keywords, { limit: 10 }); break;
        }
        log(`[SCAN] ${platform}: ${gigs.length} gigs`);
        allGigs.push(...gigs);
      } catch (err) {
        warn(`[SCAN] ${platform} error: ${err.message}`);
      }
    }

    // Dedup against previously seen gigs
    const newGigs = filterNewGigs(allGigs);
    log(`[SCAN] ${allGigs.length} total, ${newGigs.length} new after dedup`);

    if (newGigs.length === 0) { isRunning = false; return; }

    // Score new gigs with AI
    const apiKey = getApiKey();
    for (const gig of newGigs) {
      const entry = addGigToPipeline(gig);

      if (apiKey) {
        try {
          const result = await scoreGigMatch(gig, config.profile);
          gig.match_score = result.score;
          gig.match_reason = result.reason;
          gig.estimated_hours = result.estimated_hours;
          gig.suggested_rate = result.suggested_rate;
          advanceGig(gig.id, States.SCORED, { score: result.score });
        } catch {
          gig.match_score = 50;
          advanceGig(gig.id, States.SCORED, { score: 50 });
        }
        await new Promise(r => setTimeout(r, 300));
      } else {
        gig.match_score = 50;
        advanceGig(gig.id, States.SCORED, { score: 50 });
      }
    }

    // Save gigs for the CLI `propose` command too
    const existingGigs = config.gigs || [];
    saveGigs([...newGigs, ...existingGigs].slice(0, 200));

    // Notify about new finds
    const highScoreGigs = newGigs.filter(g => g.match_score >= (autopilotConfig.min_score_propose || 70));
    if (highScoreGigs.length > 0) {
      await notify('NEW_GIGS_FOUND', {
        count: highScoreGigs.length,
        summary: `Found ${highScoreGigs.length} gigs scoring ${autopilotConfig.min_score_propose}%+`,
        topGigs: highScoreGigs.slice(0, 5),
      });
    }

    log(`[SCAN] Cycle complete. ${newGigs.length} new, ${highScoreGigs.length} high-score.`);
  } catch (err) {
    logError(`[SCAN] Cycle error: ${err.message}`);
    await notify('ERROR', { message: `Scan cycle failed: ${err.message}` });
  } finally {
    isRunning = false;
  }
}

async function runProposeCycle(autopilotConfig) {
  try {
    const config = getConfig();
    if (!config.profile || !getApiKey()) return;

    const scoredGigs = getGigsByState(States.SCORED);
    const minScore = autopilotConfig.min_score_propose || 70;
    const maxPerDay = autopilotConfig.max_proposals_per_day || 10;
    const todayCount = getTodayProposalCount();

    if (todayCount >= maxPerDay) {
      log(`[PROPOSE] Daily limit reached (${todayCount}/${maxPerDay}). Skipping.`);
      return;
    }

    const eligible = scoredGigs.filter(e => (e.score || 0) >= minScore);
    log(`[PROPOSE] ${eligible.length} gigs eligible for proposals (${todayCount}/${maxPerDay} today)`);

    for (const entry of eligible.slice(0, maxPerDay - todayCount)) {
      try {
        // Generate proposal
        const proposal = await generateProposal(entry.gig, config.profile, {
          tone: 'professional',
          length: 'medium',
        });

        advanceGig(entry.id, States.PROPOSAL_DRAFT, { proposal });

        const autoSubmitThreshold = autopilotConfig.min_score_auto_submit || 85;
        const autonomy = autopilotConfig.autonomy_level || 1;

        const shouldAutoSubmit =
          (autonomy === 3 && entry.score >= minScore) ||
          (autonomy === 2 && entry.score >= autoSubmitThreshold);

        if (shouldAutoSubmit) {
          // Auto-submit
          advanceGig(entry.id, States.PROPOSAL_REVIEW);
          const result = await submitProposal(entry);
          advanceGig(entry.id, States.SUBMITTED);

          await notify('PROPOSAL_SUBMITTED', {
            gigTitle: entry.gig.title,
            platform: entry.gig.platform,
            method: result.method,
          });
        } else {
          // Needs review
          advanceGig(entry.id, States.PROPOSAL_REVIEW);
          await notify('PROPOSAL_DRAFTED', {
            gigTitle: entry.gig.title,
            score: entry.score,
            platform: entry.gig.platform,
            needsReview: true,
            proposalPreview: proposal.substring(0, 300),
          });
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        warn(`[PROPOSE] Error for "${entry.gig.title}": ${err.message}`);
      }
    }
  } catch (err) {
    logError(`[PROPOSE] Cycle error: ${err.message}`);
  }
}

async function runDeliveryCycle(autopilotConfig) {
  try {
    const config = getConfig();
    if (!config.profile) return;

    const autonomy = autopilotConfig.autonomy_level || 1;
    if (autonomy < 3) return; // Only full-auto delivers automatically

    const wonGigs = getGigsByState(States.WON);
    const maxConcurrent = autopilotConfig.max_concurrent_deliveries || 2;
    const delivering = getGigsByState(States.DELIVERING);

    if (delivering.length >= maxConcurrent) {
      log(`[DELIVER] Max concurrent deliveries (${maxConcurrent}) reached.`);
      return;
    }

    for (const entry of wonGigs.slice(0, maxConcurrent - delivering.length)) {
      try {
        // Check if this gig type is auto-deliverable
        const classification = await classifyGigType(entry.gig);
        const autoTypes = autopilotConfig.auto_deliver_types || ['code', 'data', 'writing'];

        if (!autoTypes.includes(classification.type)) {
          log(`[DELIVER] Skipping "${entry.gig.title}" — type "${classification.type}" not auto-deliverable`);
          continue;
        }

        const assessment = await assessDeliverability(entry.gig, config.profile);
        if (!assessment.canAutoDeliver || assessment.confidence < 70) {
          log(`[DELIVER] Skipping "${entry.gig.title}" — confidence ${assessment.confidence}%: ${assessment.reason}`);
          continue;
        }

        await runDelivery(entry, config.profile);
      } catch (err) {
        logError(`[DELIVER] Error for "${entry.gig.title}": ${err.message}`);
      }
    }
  } catch (err) {
    logError(`[DELIVER] Cycle error: ${err.message}`);
  }
}

async function runMessageCycle(autopilotConfig) {
  try {
    const autonomy = autopilotConfig.autonomy_level || 1;
    if (autonomy < 2) return; // Only semi-auto and full-auto monitor messages

    const { checkUpworkMessages } = await import('../browser/message-monitor.js');
    const messages = await checkUpworkMessages();

    if (messages.length === 0) return;

    log(`[MESSAGES] ${messages.length} new messages`);

    // For full-auto, classify and auto-reply to simple messages
    if (autonomy >= 3) {
      const { classifyMessage, generateClientReply } = await import('../engines/client-ai.js');
      const config = getConfig();

      for (const msg of messages) {
        const classification = await classifyMessage(msg, null);

        if (classification.autoReplyOk && !classification.escalate) {
          const reply = await generateClientReply(msg, null, config.profile);
          log(`[MESSAGES] Auto-reply to ${msg.from}: ${reply.substring(0, 100)}`);
          await notify('CLIENT_REPLY_SENT', {
            clientName: msg.from,
            replyPreview: reply,
          });
        } else if (classification.escalate || classification.urgency === 'high') {
          await notify('NEW_MESSAGES', {
            count: 1,
            messages: `URGENT from ${msg.from}: ${msg.preview}`,
          });
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (err) {
    warn(`[MESSAGES] Cycle error: ${err.message}`);
  }
}

// If run directly as daemon process
if (process.argv[1]?.endsWith('daemon.js')) {
  startDaemon();
}
