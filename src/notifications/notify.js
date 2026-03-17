import { sendDiscordEmbed } from './discord.js';
import { log } from '../utils/logger.js';

let autopilotConfig = null;

export function setNotifyConfig(config) {
  autopilotConfig = config;
}

export async function notify(event, data = {}) {
  const webhookUrl = autopilotConfig?.discord_webhook;

  log(`[NOTIFY] ${event}: ${JSON.stringify(data).substring(0, 200)}`);

  const templates = {
    NEW_GIGS_FOUND: {
      title: `🔍 ${data.count || 0} New Gigs Found`,
      description: data.summary || 'New matching gigs discovered.',
      color: 0x3498DB,
      fields: (data.topGigs || []).slice(0, 5).map(g => ({
        name: `${g.match_score || '?'}% — ${g.platform}`,
        value: `**${g.title?.substring(0, 80)}**\n${g.budget || 'Budget TBD'}`,
      })),
    },
    PROPOSAL_DRAFTED: {
      title: `✍️ Proposal Drafted`,
      description: `**${data.gigTitle}**\nScore: ${data.score}% | Platform: ${data.platform}`,
      color: 0xF39C12,
      fields: [
        { name: 'Action Required', value: data.needsReview ? '⏳ Waiting for your approval' : '✅ Auto-submitting' },
        { name: 'Proposal Preview', value: (data.proposalPreview || '').substring(0, 500) + '...' },
      ],
    },
    PROPOSAL_SUBMITTED: {
      title: `📨 Proposal Submitted`,
      description: `**${data.gigTitle}**\nPlatform: ${data.platform}`,
      color: 0x2ECC71,
      fields: [{ name: 'Method', value: data.method || 'Copied to clipboard + URL opened' }],
    },
    GIG_WON: {
      title: `🏆 GIG WON!`,
      description: `**${data.gigTitle}**\nBudget: ${data.budget}`,
      color: 0xFFD700,
    },
    DELIVERY_STARTED: {
      title: `🚀 Delivery Started`,
      description: `Project: **${data.projectName}**\nPhase: ${data.phase}`,
      color: 0x9B59B6,
    },
    DELIVERY_PHASE_COMPLETE: {
      title: `✅ Phase Complete`,
      description: `Project: **${data.projectName}**\nCompleted: Phase ${data.phaseNum}/${data.totalPhases}`,
      color: 0x2ECC71,
    },
    DELIVERY_DONE: {
      title: `🎉 Delivery Complete — Ready for Review`,
      description: `Project: **${data.projectName}**\nDirectory: ${data.projectDir}`,
      color: 0xFFD700,
    },
    CYCLE_SUMMARY: {
      title: `📊 Autopilot Cycle Summary`,
      description: `Scanned: ${data.scanned || 0} | New: ${data.newGigs || 0} | Proposed: ${data.proposed || 0}`,
      color: 0x95A5A6,
    },
    ERROR: {
      title: `⚠️ Autopilot Error`,
      description: data.message || 'An error occurred',
      color: 0xE74C3C,
    },
  };

  const template = templates[event];
  if (!template) return;

  if (webhookUrl) {
    await sendDiscordEmbed(webhookUrl, template);
  }
}
