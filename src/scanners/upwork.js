import chalk from 'chalk';

const UPWORK_SEARCH_URL = 'https://www.upwork.com/nx/search/jobs/';
const UPWORK_RSS_URL = 'https://www.upwork.com/ab/feed/jobs/rss';

/**
 * Scan Upwork job listings by keyword.
 *
 * Strategy (in order of preference):
 * 1. Upwork RSS feed (may still work for some queries)
 * 2. Upwork API with fetch + rotating headers
 * 3. Puppeteer browser scraping (headless Chrome)
 * 4. Demo fallback with clearly marked results
 */
export async function scanUpwork(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 20;

  for (const keyword of keywords.slice(0, 5)) {
    // Strategy 1: Try the RSS feed first (lightweight)
    const rssJobs = await tryUpworkRSS(keyword);
    if (rssJobs.length > 0) {
      jobs.push(...rssJobs);
      continue;
    }

    // Strategy 2: Try API-style fetch with better headers
    const apiJobs = await tryUpworkFetch(keyword);
    if (apiJobs.length > 0) {
      jobs.push(...apiJobs);
      continue;
    }

    // Strategy 3: Try Puppeteer (real browser)
    const browserJobs = await tryUpworkPuppeteer(keyword);
    if (browserJobs.length > 0) {
      jobs.push(...browserJobs);
      continue;
    }

    // Strategy 4: Demo fallback
    console.log(chalk.yellow(`  ⚠ Upwork blocked for "${keyword}" — using demo results. Auth with 'hustlebot auth upwork' for live data.`));
    jobs.push(...getDemoUpworkJobs(keyword));

    await new Promise(r => setTimeout(r, 1500));
  }

  // Dedupe by title
  const seen = new Set();
  const unique = jobs.filter(j => {
    const key = j.title.toLowerCase().substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, limit);
}

/**
 * Try Upwork RSS feed
 */
async function tryUpworkRSS(keyword) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `${UPWORK_RSS_URL}?q=${query}&sort=recency&paging=0%3B10`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    if (!xml.includes('<item>')) return [];

    // Parse RSS items manually (avoid cheerio XML mode issues)
    const items = xml.split('<item>').slice(1);
    const jobs = [];

    for (const item of items.slice(0, 10)) {
      const title = extractTag(item, 'title');
      const link = extractTag(item, 'link');
      const description = extractTag(item, 'description')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      if (title && title.length > 5) {
        // Extract budget from description
        const budgetMatch = description.match(/Budget:\s*\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*\/\s*(?:hr|hour))?/i);
        const budget = budgetMatch ? budgetMatch[0].replace('Budget:', '').trim() : 'Not specified';

        // Extract skills
        const skillsMatch = description.match(/Skills?:\s*([^.]+)/i);
        const skills = skillsMatch
          ? skillsMatch[1].split(',').map(s => s.trim()).filter(Boolean).slice(0, 8)
          : [keyword];

        jobs.push({
          id: `upwork-rss-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          platform: 'upwork',
          title: title.replace(/ - Upwork$/i, ''),
          description: description.substring(0, 500),
          budget,
          skills,
          url: link || `${UPWORK_SEARCH_URL}?q=${encodeURIComponent(keyword)}`,
          search_keyword: keyword,
          scraped_at: new Date().toISOString(),
          client_info: null,
          source: 'rss',
        });
      }
    }

    return jobs;
  } catch (e) {
    return [];
  }
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return match ? match[1].trim() : '';
}

/**
 * Try Upwork with enhanced fetch headers
 */
async function tryUpworkFetch(keyword) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `${UPWORK_SEARCH_URL}?q=${query}&sort=recency&per_page=10`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const html = await response.text();

    // Try to find JSON data embedded in the page (Upwork sometimes embeds job data in script tags)
    const scriptMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
    if (scriptMatch) {
      try {
        const state = JSON.parse(scriptMatch[1]);
        const searchResults = state?.search?.jobs || state?.jobs || [];
        if (Array.isArray(searchResults) && searchResults.length > 0) {
          return searchResults.slice(0, 10).map((job, i) => ({
            id: `upwork-${job.id || job.uid || Date.now()}-${i}`,
            platform: 'upwork',
            title: job.title || 'Untitled',
            description: (job.description || job.snippet || '').substring(0, 500),
            budget: job.budget?.amount ? `$${job.budget.amount} ${job.type || 'Fixed'}` : (job.hourlyBudget ? `$${job.hourlyBudget.min}-${job.hourlyBudget.max}/hr` : 'Not specified'),
            skills: (job.skills || job.attrs?.skills || []).map(s => typeof s === 'string' ? s : s.name).slice(0, 8),
            url: job.ciphertext ? `https://www.upwork.com/jobs/${job.ciphertext}` : `${UPWORK_SEARCH_URL}?q=${query}`,
            search_keyword: keyword,
            scraped_at: new Date().toISOString(),
            client_info: job.client?.paymentVerificationStatus === 'verified' ? '✓ Payment verified' : null,
            source: 'fetch',
          }));
        }
      } catch (e) { /* JSON parse failed */ }
    }

    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Try Puppeteer browser automation for Upwork
 */
async function tryUpworkPuppeteer(keyword) {
  try {
    const { getOrLaunchBrowser } = await import('../browser/chrome.js');
    const browser = await getOrLaunchBrowser();
    if (!browser) return [];

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const query = encodeURIComponent(keyword);
    await page.goto(`${UPWORK_SEARCH_URL}?q=${query}&sort=recency`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    // Wait for job tiles to load
    await page.waitForSelector('article, [data-test="job-tile-list"], .job-tile', { timeout: 10000 }).catch(() => {});

    const jobs = await page.evaluate((kw) => {
      const results = [];
      const tiles = document.querySelectorAll('article, [data-test="job-tile-list"] > div, .job-tile, section[data-v-job]');

      tiles.forEach((tile, i) => {
        if (i >= 10) return;
        const titleEl = tile.querySelector('h2 a, .job-tile-title a, [data-test="job-tile-title-link"], a[data-test="UpLink"]');
        const descEl = tile.querySelector('.job-description, [data-test="job-description-text"], .text-body-sm, p');
        const budgetEl = tile.querySelector('.budget, [data-test="budget"], [data-test="is-fixed-price"], [data-test="hourly-rate"]');
        const linkEl = tile.querySelector('a[href*="/jobs/"], a[href*="/nx/"]');

        const title = titleEl?.textContent?.trim();
        const description = descEl?.textContent?.trim();
        const budget = budgetEl?.textContent?.trim();
        const link = linkEl?.getAttribute('href');

        const skillEls = tile.querySelectorAll('.skill-tag, [data-test="skill"], .air3-token, [data-test="attr-item"]');
        const skills = Array.from(skillEls).map(s => s.textContent.trim()).filter(Boolean);

        if (title && title.length > 5) {
          results.push({
            title,
            description: (description || '').substring(0, 500),
            budget: budget || 'Not specified',
            skills: skills.slice(0, 8),
            link: link ? (link.startsWith('http') ? link : `https://www.upwork.com${link}`) : null,
          });
        }
      });
      return results;
    }, keyword);

    await page.close();

    return jobs.map((job, i) => ({
      id: `upwork-browser-${Date.now()}-${i}`,
      platform: 'upwork',
      title: job.title,
      description: job.description,
      budget: job.budget,
      skills: job.skills.length > 0 ? job.skills : [keyword],
      url: job.link || `${UPWORK_SEARCH_URL}?q=${encodeURIComponent(keyword)}`,
      search_keyword: keyword,
      scraped_at: new Date().toISOString(),
      client_info: null,
      source: 'browser',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Demo/fallback jobs when all strategies fail
 */
function getDemoUpworkJobs(keyword) {
  const demoJobs = [
    {
      title: 'OpenClaw AI Agent Setup & Configuration on Mac Mini',
      description: 'Looking for someone experienced with OpenClaw to set up a fully configured instance on a Mac Mini. Need Telegram integration, custom skills, and a nightly consolidation cron job. Docker preferred. Must have real OpenClaw experience.',
      budget: '$300 - $800 Fixed',
      skills: ['OpenClaw', 'Docker', 'AI Agents', 'Telegram API', 'Linux'],
    },
    {
      title: 'Claude Code Expert — Build AI-Powered Dashboard',
      description: 'Need a developer who knows Claude Code well to build a React dashboard that uses the Anthropic API for real-time data analysis. Must deploy to Vercel. Looking for someone who can work autonomously.',
      budget: '$50-75/hr',
      skills: ['Claude Code', 'React', 'Anthropic API', 'Vercel', 'TypeScript'],
    },
    {
      title: 'AI Automation Specialist — n8n + LLM Integration',
      description: 'We need someone to build AI-powered automation workflows using n8n. Process incoming customer emails, categorize with LLM, auto-generate draft responses. Must integrate with Gmail and Slack.',
      budget: '$1,000 - $2,500 Fixed',
      skills: ['n8n', 'AI Automation', 'LLM', 'Gmail API', 'Slack API'],
    },
    {
      title: 'Data Pipeline Engineer — Python/SQL Real-time Analytics',
      description: 'Building a real-time analytics pipeline for e-commerce. Need strong Python and SQL skills. Data sources: Shopify, Google Analytics, Stripe. Output to Metabase dashboard.',
      budget: '$75-100/hr',
      skills: ['Python', 'SQL', 'Data Pipeline', 'Shopify API', 'ETL'],
    },
    {
      title: 'Build Custom AI Chatbot for Customer Support',
      description: 'SaaS product needs custom AI chatbot trained on our docs. Should use RAG with our knowledge base. Must integrate with Intercom. Prefer Claude or GPT-4 as the base model.',
      budget: '$2,000 - $5,000 Fixed',
      skills: ['AI Chatbot', 'RAG', 'LangChain', 'Anthropic', 'Intercom'],
    },
  ];

  const kw = keyword.toLowerCase();
  const relevant = demoJobs.filter(j =>
    j.title.toLowerCase().includes(kw) ||
    j.description.toLowerCase().includes(kw) ||
    j.skills.some(s => s.toLowerCase().includes(kw))
  );

  const results = relevant.length > 0 ? relevant : demoJobs.slice(0, 2);

  return results.map((j, i) => ({
    ...j,
    id: `upwork-demo-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
    platform: 'upwork',
    url: `${UPWORK_SEARCH_URL}?q=${encodeURIComponent(keyword)}`,
    search_keyword: keyword,
    scraped_at: new Date().toISOString(),
    client_info: 'Demo data — run hustlebot auth upwork for live results',
    is_demo: true,
    source: 'demo',
  }));
}
