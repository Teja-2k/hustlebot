import { log, warn } from '../utils/logger.js';

/**
 * Submit a proposal to a platform.
 * V1: Copy to clipboard + open URL for manual submission.
 * Future: Direct API submission for Upwork, Reddit, etc.
 */
export async function submitProposal(gigEntry) {
  const { gig, proposal } = gigEntry;
  const platform = gig.platform;

  log(`[SUBMIT] Submitting proposal for "${gig.title}" on ${platform}`);

  const result = { success: false, method: 'none' };

  try {
    switch (platform) {
      case 'upwork': {
        // Upwork: copy proposal + open job URL
        await copyToClipboard(proposal);
        if (gig.url && gig.url !== 'https://www.upwork.com/nx/search/jobs/') {
          await openUrl(gig.url);
        }
        result.success = true;
        result.method = 'Proposal copied to clipboard, job URL opened in browser';
        break;
      }

      case 'twitter': {
        // Twitter: copy a DM-ready message + open profile
        const dmMessage = `Hey! Saw your post about needing help. ${proposal.substring(0, 200)}...\n\nHappy to discuss further!`;
        await copyToClipboard(dmMessage);
        if (gig.url) await openUrl(gig.url);
        result.success = true;
        result.method = 'DM message copied to clipboard, profile URL opened';
        break;
      }

      case 'hackernews': {
        // HN: copy reply + open thread
        const hnReply = proposal.substring(0, 500);
        await copyToClipboard(hnReply);
        if (gig.url) await openUrl(gig.url);
        result.success = true;
        result.method = 'Reply copied to clipboard, thread URL opened';
        break;
      }

      default: {
        await copyToClipboard(proposal);
        if (gig.url) await openUrl(gig.url);
        result.success = true;
        result.method = `Proposal copied, URL opened for ${platform}`;
      }
    }
  } catch (err) {
    warn(`[SUBMIT] Error: ${err.message}`);
    result.error = err.message;
  }

  return result;
}

async function copyToClipboard(text) {
  const { execSync } = await import('child_process');
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execSync('pbcopy', { input: text });
    } else if (platform === 'linux') {
      execSync('xclip -selection clipboard', { input: text });
    } else if (platform === 'win32') {
      execSync('powershell.exe -command "Set-Clipboard -Value $input"', { input: text });
    }
  } catch {
    // Clipboard may fail in headless/daemon mode — that's OK
    warn('[SUBMIT] Clipboard copy failed (expected in daemon mode)');
  }
}

async function openUrl(url) {
  try {
    const open = (await import('open')).default;
    await open(url);
  } catch {
    warn(`[SUBMIT] Could not open URL: ${url}`);
  }
}
