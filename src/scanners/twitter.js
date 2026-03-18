import chalk from 'chalk';

/**
 * Scan Twitter/X for people asking for freelance help.
 *
 * Strategy:
 * 1. Twitter API v2 (if TWITTER_BEARER_TOKEN set — $100/month Basic)
 * 2. Nitter RSS feeds (free, sometimes unreliable)
 * 3. Demo fallback with clear warning
 */

const SEARCH_TEMPLATES = [
  'looking for someone {keyword}',
  'need help with {keyword}',
  'anyone know {keyword} expert',
  'hiring {keyword} freelancer',
  'need a {keyword} developer',
  '{keyword} setup help',
  'who can help me {keyword}',
];

export async function scanTwitter(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 10;

  const twitterToken = process.env.TWITTER_BEARER_TOKEN;

  if (twitterToken) {
    // Strategy 1: Real Twitter API
    const apiJobs = await scanWithTwitterAPI(keywords, twitterToken);
    jobs.push(...apiJobs);
  }

  if (jobs.length === 0) {
    // Strategy 2: Try Nitter RSS (free alternative)
    const nitterJobs = await scanWithNitter(keywords);
    jobs.push(...nitterJobs);
  }

  if (jobs.length === 0) {
    // Strategy 3: Demo fallback
    if (!twitterToken) {
      console.log(chalk.yellow('  ⚠ No TWITTER_BEARER_TOKEN — using demo data. Get API key at developer.x.com'));
    }
    jobs.push(...getDemoTwitterJobs(keywords));
  }

  return jobs.slice(0, limit);
}

/**
 * Scan using Twitter API v2
 */
async function scanWithTwitterAPI(keywords, token) {
  const jobs = [];

  for (const keyword of keywords.slice(0, 3)) {
    try {
      const queries = SEARCH_TEMPLATES.map(t => t.replace('{keyword}', keyword));
      const query = queries.slice(0, 3).join(' OR ');

      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name,followers_count`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const users = {};
        (data.includes?.users || []).forEach(u => { users[u.id] = u; });

        (data.data || []).forEach((tweet) => {
          const author = users[tweet.author_id] || {};
          jobs.push({
            id: `twitter-${tweet.id}`,
            platform: 'twitter',
            title: `@${author.username || 'unknown'}: ${tweet.text.substring(0, 80)}...`,
            description: tweet.text,
            budget: 'DM to discuss',
            skills: [keyword],
            url: `https://x.com/${author.username}/status/${tweet.id}`,
            search_keyword: keyword,
            scraped_at: new Date().toISOString(),
            client_info: `@${author.username} • ${author.followers_count || 0} followers`,
            metrics: tweet.public_metrics,
            source: 'api',
          });
        });
      } else if (response.status === 401 || response.status === 403) {
        console.log(chalk.yellow('  ⚠ Twitter API key invalid or expired. Renew at developer.x.com'));
        break;
      }
    } catch (err) {
      console.log(chalk.yellow(`  ⚠ Twitter API error for "${keyword}": ${err.message}`));
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return jobs;
}

/**
 * Try Nitter RSS feeds as free alternative
 */
async function scanWithNitter(keywords) {
  const jobs = [];
  const nitterInstances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.net',
  ];

  for (const keyword of keywords.slice(0, 2)) {
    for (const instance of nitterInstances) {
      try {
        const query = encodeURIComponent(`hiring ${keyword} freelancer`);
        const url = `${instance}/search/rss?f=tweets&q=${query}`;

        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (!response.ok) continue;

        const xml = await response.text();
        if (!xml.includes('<item>')) continue;

        const items = xml.split('<item>').slice(1, 6);

        for (const item of items) {
          const title = extractTag(item, 'title');
          const link = extractTag(item, 'link');
          const desc = extractTag(item, 'description')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&[#\w]+;/g, ' ')
            .trim();

          const usernameMatch = link.match(/\/([^\/]+)\/status/);
          const username = usernameMatch ? usernameMatch[1] : 'unknown';

          if (title && title.length > 20) {
            jobs.push({
              id: `twitter-nitter-${Date.now()}-${Math.random().toString(36).substring(5)}`,
              platform: 'twitter',
              title: `@${username}: ${title.substring(0, 80)}...`,
              description: desc.substring(0, 500),
              budget: 'DM to discuss',
              skills: [keyword],
              url: link.replace(instance, 'https://x.com'),
              search_keyword: keyword,
              scraped_at: new Date().toISOString(),
              client_info: `@${username}`,
              source: 'nitter',
            });
          }
        }

        if (jobs.length > 0) break; // Found results, stop trying instances
      } catch (e) {
        continue; // Try next instance
      }
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return jobs;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return match ? match[1].trim() : '';
}

function getDemoTwitterJobs(keywords) {
  const demoTweets = [
    {
      username: 'saas_builder',
      text: 'Looking for a Claude Code expert to help me build a full SaaS app. I have the idea and design, need someone to pair-program with Claude Code to ship it in a week. Budget: $3-5K.',
      followers: 8900,
      keyword: 'Claude Code',
    },
    {
      username: 'ecom_agency',
      text: 'Need help building an AI automation pipeline for our e-commerce clients. n8n + LLM integration. If you have experience with this, let\'s talk. Remote, ongoing work.',
      followers: 5600,
      keyword: 'AI automation',
    },
    {
      username: 'indie_maker_dev',
      text: 'Just got funding and need to ship FAST. Looking for someone who can use Claude Code or Cursor to build our MVP in 2 weeks. React + Supabase + Stripe. Who\'s available?',
      followers: 3200,
      keyword: 'Claude Code',
    },
    {
      username: 'agency_ops',
      text: 'Our clients keep asking for AI chatbots. Need a freelancer who can build RAG-powered customer support bots. We\'ll handle client mgmt, you handle the tech. $2-4K per bot.',
      followers: 1800,
      keyword: 'AI chatbot',
    },
    {
      username: 'startup_cto',
      text: 'Hiring a data pipeline contractor ASAP. Need real-time ETL from Shopify+Stripe into our analytics DB. Python + SQL. $80-120/hr, 2-3 week engagement. DM me.',
      followers: 4500,
      keyword: 'data pipeline',
    },
  ];

  const kw = keywords.map(k => k.toLowerCase());
  const relevant = demoTweets.filter(t =>
    kw.some(k => t.text.toLowerCase().includes(k) || t.keyword.toLowerCase().includes(k))
  );

  const results = relevant.length > 0 ? relevant : demoTweets.slice(0, 3);

  return results.map((t, i) => ({
    id: `twitter-demo-${Date.now()}-${i}`,
    platform: 'twitter',
    title: `@${t.username}: ${t.text.substring(0, 80)}...`,
    description: t.text,
    budget: 'DM to discuss',
    skills: [t.keyword],
    url: `https://x.com/${t.username}`,
    search_keyword: t.keyword,
    scraped_at: new Date().toISOString(),
    client_info: `@${t.username} • ${t.followers} followers`,
    is_demo: true,
    source: 'demo',
  }));
}
