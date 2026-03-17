import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { log, error as logError } from '../utils/logger.js';

const HUSTLEBOT_DIR = join(homedir(), '.hustlebot');
const SESSIONS_DIR = join(HUSTLEBOT_DIR, 'sessions');
const SCREENSHOTS_DIR = join(HUSTLEBOT_DIR, 'screenshots');

// Ensure dirs exist
for (const dir of [SESSIONS_DIR, SCREENSHOTS_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// Find Chrome on Windows
function findChrome() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

let browser = null;

export async function launchBrowser(headless = true) {
  if (browser) return browser;

  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome not found. Install Google Chrome to use browser automation.');
  }

  log(`[BROWSER] Launching Chrome (headless: ${headless})`);

  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: headless ? 'new' : false,
    userDataDir: join(SESSIONS_DIR, 'chrome-profile'),
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,800',
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function getPage(url) {
  const b = await launchBrowser();
  const page = await b.newPage();

  // Set realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  if (url) await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  return page;
}

export async function takeScreenshot(page, name) {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  log(`[BROWSER] Screenshot saved: ${filepath}`);
  return filepath;
}

export async function isLoggedIn(page, platform) {
  const checks = {
    upwork: async () => {
      await page.goto('https://www.upwork.com/nx/find-work/best-matches', { waitUntil: 'networkidle2', timeout: 15000 });
      const url = page.url();
      return !url.includes('/login') && !url.includes('/ab/account-security/login');
    },
    freelancer: async () => {
      await page.goto('https://www.freelancer.com/dashboard', { waitUntil: 'networkidle2', timeout: 15000 });
      const url = page.url();
      return !url.includes('/login');
    },
  };

  try {
    return await checks[platform]();
  } catch {
    return false;
  }
}

export async function waitForLogin(page, platform) {
  log(`[BROWSER] Waiting for manual ${platform} login...`);

  const loginUrls = {
    upwork: 'https://www.upwork.com/ab/account-security/login',
    freelancer: 'https://www.freelancer.com/login',
  };

  await page.goto(loginUrls[platform], { waitUntil: 'networkidle2' });

  // Wait up to 5 minutes for user to log in
  const successUrls = {
    upwork: url => !url.includes('/login') && !url.includes('account-security'),
    freelancer: url => !url.includes('/login'),
  };

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const url = page.url();
    if (successUrls[platform](url)) {
      log(`[BROWSER] ${platform} login successful`);
      return true;
    }
  }

  throw new Error(`${platform} login timed out after 5 minutes`);
}

export { SESSIONS_DIR, SCREENSHOTS_DIR };
