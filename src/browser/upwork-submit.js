import { launchBrowser, getPage, takeScreenshot, isLoggedIn, waitForLogin, closeBrowser } from './chrome.js';
import { log, error as logError } from '../utils/logger.js';
import { notify } from '../notifications/notify.js';

/**
 * Submit a proposal on Upwork for a given gig.
 * Returns { success, method, screenshotPath, error }
 */
export async function submitUpworkProposal(gig, proposalText, bidAmount) {
  let page = null;

  try {
    log(`[UPWORK] Submitting proposal for: ${gig.title}`);

    page = await getPage(null);

    // Check if logged into Upwork
    const loggedIn = await isLoggedIn(page, 'upwork');
    if (!loggedIn) {
      log('[UPWORK] Not logged in — need manual login first');
      return {
        success: false,
        method: 'needs_login',
        error: 'Not logged into Upwork. Run hustlebot auth upwork to log in.',
      };
    }

    // Navigate to the job page
    const jobUrl = gig.url || `https://www.upwork.com/jobs/${gig.id}`;
    log(`[UPWORK] Navigating to: ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    // Look for "Apply Now" or "Submit a Proposal" button
    const applyButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const apply = btns.find(b =>
        b.textContent.includes('Apply Now') ||
        b.textContent.includes('Submit a Proposal') ||
        b.textContent.includes('Submit Proposal')
      );
      if (apply) {
        apply.click();
        return true;
      }
      return false;
    });

    if (!applyButton) {
      // Try direct proposal URL
      const proposalUrl = jobUrl.replace('/jobs/', '/nx/proposals/job/') + '/apply';
      await page.goto(proposalUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
    }

    // Take screenshot of proposal form
    await takeScreenshot(page, 'upwork-proposal-form');

    // Fill in the cover letter
    const coverLetterFilled = await page.evaluate((text) => {
      // Try multiple possible selectors for the cover letter field
      const selectors = [
        'textarea[data-test="coverLetter"]',
        'textarea[name="coverLetter"]',
        'textarea.cover-letter',
        '#coverLetter',
        'textarea[placeholder*="cover letter"]',
        'textarea[placeholder*="proposal"]',
        '.up-textarea textarea',
        'textarea',
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && (el.offsetHeight > 50 || el.rows > 3)) {
          el.focus();
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return sel;
        }
      }
      return null;
    }, proposalText);

    if (!coverLetterFilled) {
      log('[UPWORK] Could not find cover letter field');
      const screenshot = await takeScreenshot(page, 'upwork-no-coverfield');
      return {
        success: false,
        method: 'browser',
        screenshotPath: screenshot,
        error: 'Could not locate cover letter textarea on proposal page',
      };
    }

    log(`[UPWORK] Cover letter filled (selector: ${coverLetterFilled})`);

    // Fill in bid amount if there's a field
    if (bidAmount) {
      await page.evaluate((amount) => {
        const bidSelectors = [
          'input[data-test="bid-amount"]',
          'input[name="amount"]',
          'input[name="rate"]',
          'input[aria-label*="bid"]',
          'input[aria-label*="rate"]',
          'input[placeholder*="$"]',
        ];
        for (const sel of bidSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            el.focus();
            el.value = '';
            el.value = String(amount);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      }, bidAmount);
    }

    // Take screenshot before submit
    const preSubmitScreenshot = await takeScreenshot(page, 'upwork-pre-submit');

    // Click submit button
    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submit = btns.find(b =>
        b.textContent.includes('Submit') &&
        !b.textContent.includes('Cancel') &&
        !b.disabled
      );
      if (submit) {
        submit.click();
        return true;
      }
      return false;
    });

    if (!submitted) {
      return {
        success: false,
        method: 'browser',
        screenshotPath: preSubmitScreenshot,
        error: 'Could not find/click submit button',
      };
    }

    // Wait for submission to process
    await new Promise(r => setTimeout(r, 3000));

    // Check for success indicators
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const isSuccess = pageText.includes('submitted') ||
                      pageText.includes('Proposal sent') ||
                      pageText.includes('applied') ||
                      pageText.includes('Thank you');

    const postScreenshot = await takeScreenshot(page, `upwork-${isSuccess ? 'success' : 'result'}`);

    if (isSuccess) {
      log(`[UPWORK] Proposal submitted successfully for: ${gig.title}`);
      await notify('PROPOSAL_SUBMITTED', {
        gigTitle: gig.title,
        platform: 'upwork',
        method: 'Browser automation',
      });
    }

    await page.close();

    return {
      success: isSuccess,
      method: 'browser',
      screenshotPath: postScreenshot,
      error: isSuccess ? null : 'Submission may have failed — check screenshot',
    };

  } catch (err) {
    logError(`[UPWORK] Submission error: ${err.message}`);
    if (page) {
      try {
        const errorScreenshot = await takeScreenshot(page, 'upwork-error');
        await page.close();
        return { success: false, method: 'browser', screenshotPath: errorScreenshot, error: err.message };
      } catch {}
    }
    return { success: false, method: 'browser', error: err.message };
  }
}

/**
 * Interactive login flow — opens visible Chrome for user to log in manually.
 * Saves session cookies for future headless use.
 */
export async function setupUpworkSession() {
  log('[UPWORK] Starting login session setup...');

  // Launch in visible mode
  const page = await getPage(null);
  const browser = page.browser();

  // Check if already logged in
  const loggedIn = await isLoggedIn(page, 'upwork');
  if (loggedIn) {
    log('[UPWORK] Already logged in!');
    await page.close();
    return { success: true, message: 'Already logged into Upwork' };
  }

  // Navigate to login and wait for user
  await waitForLogin(page, 'upwork');
  await page.close();

  return { success: true, message: 'Upwork session saved' };
}
