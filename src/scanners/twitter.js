import chalk from 'chalk';

/**
 * Scan Twitter/X for people asking for freelance help
 * 
 * Strategy: Search for patterns like:
 * - "looking for someone to" + keyword
 * - "anyone know a" + keyword  
 * - "need help with" + keyword
 * - "hiring" + keyword
 * - "OpenClaw setup" (direct demand signals)
 * 
 * Implementation options:
 * 1. Twitter API v2 ($100/month Basic tier)
 * 2. Apify Twitter scraper (free tier available)
 * 3. Nitter instances (free but unreliable)
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

  // Check if Twitter API key is configured
  const twitterToken = process.env.TWITTER_BEARER_TOKEN;

  if (twitterToken) {
    // Use real Twitter API
    for (const keyword of keywords.slice(0, 3)) {
      try {
        const queries = SEARCH_TEMPLATES.map(t => t.replace('{keyword}', keyword));
        const query = queries.join(' OR ');

        const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name,followers_count`;

        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${twitterToken}` }
        });

        if (response.ok) {
          const data = await response.json();
          const users = {};
          (data.includes?.users || []).forEach(u => { users[u.id] = u; });

          (data.data || []).forEach((tweet, i) => {
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
            });
          });
        }
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ Twitter API error for "${keyword}": ${err.message}`));
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // If no API or no results, use demo data based on real March 2026 patterns
  if (jobs.length === 0) {
    if (!twitterToken) {
      console.log(chalk.gray('  ℹ Set TWITTER_BEARER_TOKEN for live X/Twitter scanning'));
    }
    jobs.push(...getDemoTwitterJobs(keywords));
  }

  return jobs.slice(0, limit);
}

function getDemoTwitterJobs(keywords) {
  const demoTweets = [
    {
      username: 'startup_founder42',
      text: 'Anyone know someone who can set up OpenClaw on a Mac Mini for my startup? Will pay well. Need it configured with Telegram, custom skills, and running 24/7. DM me.',
      followers: 2340,
      keyword: 'OpenClaw',
    },
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
      username: 'tech_ceo_jenny',
      text: 'We need a data scientist who can build a real-time analytics dashboard. Python + SQL + some AI magic. Part-time contract, $100/hr. DM with portfolio.',
      followers: 12400,
      keyword: 'data scientist',
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
  }));
}
