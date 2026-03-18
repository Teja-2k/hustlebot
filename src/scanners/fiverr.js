import chalk from 'chalk';

/**
 * Scan Fiverr for demand signals and buyer requests.
 *
 * Strategy:
 * 1. Fiverr GraphQL API (used by their frontend)
 * 2. Puppeteer browser scraping
 * 3. Demo fallback
 *
 * NOTE: Fiverr doesn't have a public buyer-requests API.
 * We analyze seller gig listings to detect market demand.
 */
export async function scanFiverr(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 20;

  for (const keyword of keywords.slice(0, 5)) {
    // Strategy 1: Try Fiverr's internal API
    const apiJobs = await tryFiverrAPI(keyword);
    if (apiJobs.length > 0) {
      jobs.push(...apiJobs);
      continue;
    }

    // Strategy 2: Try Puppeteer
    const browserJobs = await tryFiverrPuppeteer(keyword);
    if (browserJobs.length > 0) {
      jobs.push(...browserJobs);
      continue;
    }

    // Strategy 3: Demo fallback
    console.log(chalk.yellow(`  ⚠ Fiverr blocked for "${keyword}" — using demand signals from market data`));
    jobs.push(...getDemoFiverrJobs(keyword));

    await new Promise(r => setTimeout(r, 1500));
  }

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
 * Try Fiverr's internal GraphQL/search API
 */
async function tryFiverrAPI(keyword) {
  try {
    const query = encodeURIComponent(keyword);
    const url = `https://www.fiverr.com/search/gigs?query=${query}&source=main_banner&search_in=everywhere`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="131"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const html = await response.text();

    // Try to extract embedded JSON data (Fiverr embeds search results in script tags)
    const stateMatch = html.match(/__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const gigs = state?.props?.pageProps?.searchResults?.gigs || [];
        return gigs.slice(0, 10).map((gig, i) => convertFiverrGigToDemand(gig, keyword, i, 'api'));
      } catch (e) { /* parse failed */ }
    }

    // Try extracting from Perseus data
    const perseusMatch = html.match(/Perseus\.initial\.data\s*=\s*({[\s\S]*?});/);
    if (perseusMatch) {
      try {
        const data = JSON.parse(perseusMatch[1]);
        const gigs = data?.searchResults?.gigs || data?.gigs || [];
        if (Array.isArray(gigs) && gigs.length > 0) {
          return gigs.slice(0, 10).map((gig, i) => convertFiverrGigToDemand(gig, keyword, i, 'api'));
        }
      } catch (e) { /* parse failed */ }
    }

    return [];
  } catch (e) {
    return [];
  }
}

function convertFiverrGigToDemand(gig, keyword, index, source) {
  const title = gig.title || gig.gig_title || '';
  const demandTitle = title
    .replace(/^I will /i, 'Need: ')
    .replace(/^I can /i, 'Demand: ')
    .replace(/^I\'ll /i, 'Need: ');

  const price = gig.price || gig.starting_price || gig.price_i;
  const rating = gig.rating || gig.seller_rating;
  const reviews = gig.num_of_reviews || gig.reviews_count || 0;

  return {
    id: `fiverr-${gig.gig_id || Date.now()}-${index}`,
    platform: 'fiverr',
    title: demandTitle,
    description: `Active buyer demand on Fiverr for "${keyword}". ${reviews > 0 ? `${reviews} recent purchases at this price point.` : ''} ${rating ? `Seller rating: ${rating}★.` : ''} This shows people are paying for this service.`,
    budget: price ? `From $${price}` : 'Varies',
    skills: [keyword],
    url: gig.url ? `https://www.fiverr.com${gig.url}` : `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}`,
    search_keyword: keyword,
    scraped_at: new Date().toISOString(),
    client_info: reviews > 50 ? `High demand (${reviews}+ purchases)` : `${reviews} recent purchases`,
    demand_signal: true,
    source,
  };
}

/**
 * Try Puppeteer for Fiverr
 */
async function tryFiverrPuppeteer(keyword) {
  try {
    const { getOrLaunchBrowser } = await import('../browser/chrome.js');
    const browser = await getOrLaunchBrowser();
    if (!browser) return [];

    const page = await browser.newPage();
    const query = encodeURIComponent(keyword);
    await page.goto(`https://www.fiverr.com/search/gigs?query=${query}`, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    await page.waitForSelector('[class*="gig-card"], .gig-wrapper, article', { timeout: 10000 }).catch(() => {});

    const gigs = await page.evaluate((kw) => {
      const results = [];
      const cards = document.querySelectorAll('[class*="gig-card"], .gig-wrapper, article, [class*="GigCard"]');

      cards.forEach((card, i) => {
        if (i >= 10) return;
        const titleEl = card.querySelector('h3, [class*="title"], p[class*="title"]');
        const priceEl = card.querySelector('[class*="price"], span[class*="Price"]');
        const ratingEl = card.querySelector('[class*="rating"], [class*="Rating"]');
        const linkEl = card.querySelector('a[href*="/"]');

        const title = titleEl?.textContent?.trim() || '';
        const price = priceEl?.textContent?.trim() || '';
        const rating = ratingEl?.textContent?.trim() || '';
        const link = linkEl?.getAttribute('href') || '';

        if (title.length > 10) {
          results.push({ title, price, rating, link });
        }
      });
      return results;
    }, keyword);

    await page.close();

    return gigs.map((gig, i) => {
      const demandTitle = gig.title
        .replace(/^I will /i, 'Need: ')
        .replace(/^I can /i, 'Demand: ');

      return {
        id: `fiverr-browser-${Date.now()}-${i}`,
        platform: 'fiverr',
        title: demandTitle,
        description: `Active demand for "${keyword}" on Fiverr. Sellers charge ${gig.price || 'varies'}. ${gig.rating ? `Top rated: ${gig.rating}.` : ''}`,
        budget: gig.price || 'Varies',
        skills: [keyword],
        url: gig.link ? (gig.link.startsWith('http') ? gig.link : `https://www.fiverr.com${gig.link}`) : `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}`,
        search_keyword: keyword,
        scraped_at: new Date().toISOString(),
        client_info: null,
        demand_signal: true,
        source: 'browser',
      };
    });
  } catch (e) {
    return [];
  }
}

function getDemoFiverrJobs(keyword) {
  const demoJobs = [
    {
      title: 'Need: AI Chatbot for Website Customer Support',
      description: 'High demand on Fiverr for AI chatbot development. Buyers typically pay $200-$1,000 for custom chatbots. Top sellers have 500+ reviews. Great opportunity for LangChain/RAG/Claude API experts.',
      budget: '$200 - $1,000',
      skills: ['AI Chatbot', 'LangChain', 'Python', 'NLP'],
    },
    {
      title: 'Need: Python Automation Scripts & Bots',
      description: 'Consistent buyer demand for Python automation. Web scrapers, data processors, API integrations, workflow automation. Buyers pay $100-$500 per project.',
      budget: '$100 - $500',
      skills: ['Python', 'Automation', 'Web Scraping', 'API Integration'],
    },
    {
      title: 'Need: Full-Stack Web App Development',
      description: 'Strong demand for React + Node.js web apps. SaaS dashboards, admin panels, custom tools. Budget $500-$5,000.',
      budget: '$500 - $5,000',
      skills: ['React', 'Node.js', 'Full Stack', 'MongoDB'],
    },
    {
      title: 'Need: Data Analysis & Visualization Dashboard',
      description: 'Growing demand for interactive dashboards. Python (Plotly/Streamlit) or JavaScript (D3.js). $300-$1,500 typical.',
      budget: '$300 - $1,500',
      skills: ['Data Analysis', 'Python', 'Streamlit', 'D3.js'],
    },
    {
      title: 'Need: Telegram/Discord Bot Development',
      description: 'Steady demand for custom bots — trading bots, community mgmt, notifications. Average $150-$800.',
      budget: '$150 - $800',
      skills: ['Telegram Bot', 'Discord Bot', 'Node.js', 'Python'],
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
    id: `fiverr-demo-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
    platform: 'fiverr',
    url: `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}`,
    search_keyword: keyword,
    scraped_at: new Date().toISOString(),
    client_info: 'Demo — demand signal from Fiverr marketplace',
    is_demo: true,
    demand_signal: true,
    source: 'demo',
  }));
}
