import { getPage, takeScreenshot, isLoggedIn } from './chrome.js';
import { log, error as logError } from '../utils/logger.js';
import { notify } from '../notifications/notify.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const MESSAGES_PATH = join(homedir(), '.hustlebot', 'messages.json');

function loadMessages() {
  if (!existsSync(MESSAGES_PATH)) return [];
  try { return JSON.parse(readFileSync(MESSAGES_PATH, 'utf-8')); } catch { return []; }
}

function saveMessages(msgs) {
  writeFileSync(MESSAGES_PATH, JSON.stringify(msgs, null, 2));
}

/**
 * Check Upwork messages for new client communications.
 * Returns array of { from, subject, preview, url, timestamp, isNew }
 */
export async function checkUpworkMessages() {
  let page = null;
  try {
    page = await getPage(null);
    const loggedIn = await isLoggedIn(page, 'upwork');
    if (!loggedIn) return [];

    await page.goto('https://www.upwork.com/ab/messages', { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));

    // Extract message threads
    const messages = await page.evaluate(() => {
      const threads = document.querySelectorAll('[data-test="message-thread"], .thread-list-item, .room-list-item');
      const results = [];

      threads.forEach(thread => {
        const nameEl = thread.querySelector('.user-name, .thread-name, h4, .name');
        const previewEl = thread.querySelector('.last-message, .thread-preview, .message-preview, p');
        const timeEl = thread.querySelector('.time, .timestamp, time, .date');
        const unread = thread.classList.contains('unread') ||
                       thread.querySelector('.unread, .badge, .dot') !== null;

        if (nameEl) {
          results.push({
            from: nameEl.textContent.trim(),
            preview: previewEl?.textContent?.trim()?.substring(0, 200) || '',
            timestamp: timeEl?.textContent?.trim() || new Date().toISOString(),
            isNew: unread,
            platform: 'upwork',
          });
        }
      });

      return results.slice(0, 20);
    });

    await page.close();

    // Check for truly new messages
    const existing = loadMessages();
    const existingKeys = new Set(existing.map(m => `${m.from}:${m.preview?.substring(0, 50)}`));
    const newMessages = messages.filter(m => m.isNew && !existingKeys.has(`${m.from}:${m.preview?.substring(0, 50)}`));

    if (newMessages.length > 0) {
      log(`[MESSAGES] ${newMessages.length} new Upwork messages`);

      // Save and notify
      const all = [...existing, ...newMessages.map(m => ({ ...m, readAt: null, respondedAt: null }))];
      saveMessages(all.slice(-100));

      await notify('NEW_MESSAGES', {
        count: newMessages.length,
        messages: newMessages.map(m => `${m.from}: ${m.preview?.substring(0, 80)}`).join('\n'),
      });
    }

    return newMessages;

  } catch (err) {
    logError(`[MESSAGES] Error checking Upwork messages: ${err.message}`);
    if (page) try { await page.close(); } catch {}
    return [];
  }
}

/**
 * Send a reply to a specific Upwork message thread.
 */
export async function replyUpworkMessage(threadUrl, replyText) {
  let page = null;
  try {
    page = await getPage(threadUrl);
    await new Promise(r => setTimeout(r, 2000));

    // Find message input
    const sent = await page.evaluate((text) => {
      const inputs = document.querySelectorAll('textarea, [contenteditable="true"], .ql-editor');
      for (const el of inputs) {
        if (el.offsetHeight > 30) {
          el.focus();
          if (el.tagName === 'TEXTAREA') {
            el.value = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            el.innerHTML = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Find and click send button
          setTimeout(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              if (b.textContent.includes('Send') || b.getAttribute('aria-label')?.includes('Send')) {
                b.click();
                break;
              }
            }
          }, 500);

          return true;
        }
      }
      return false;
    }, replyText);

    await new Promise(r => setTimeout(r, 2000));
    const screenshot = await takeScreenshot(page, 'upwork-reply');
    await page.close();

    return { success: sent, screenshotPath: screenshot };

  } catch (err) {
    logError(`[MESSAGES] Reply error: ${err.message}`);
    if (page) try { await page.close(); } catch {}
    return { success: false, error: err.message };
  }
}
