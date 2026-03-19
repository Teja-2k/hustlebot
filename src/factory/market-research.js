/**
 * Market Research Engine — Finds profitable product opportunities
 *
 * Scans trending topics, identifies gaps, scores demand, and generates
 * product ideas that Claude Code can build.
 */

import fetch from 'node-fetch';
import { ProductTypes, addProduct } from './product-catalog.js';

// High-demand niches where AI products sell well (2025-2026)
const HOT_NICHES = [
  // AI & Automation
  { niche: 'AI agents', audience: 'developers', demand: 95 },
  { niche: 'Claude Code automation', audience: 'developers', demand: 90 },
  { niche: 'AI prompt engineering', audience: 'marketers', demand: 88 },
  { niche: 'ChatGPT alternatives', audience: 'businesses', demand: 85 },
  { niche: 'AI workflow automation', audience: 'businesses', demand: 92 },
  { niche: 'LLM fine-tuning', audience: 'ML engineers', demand: 80 },
  { niche: 'RAG applications', audience: 'developers', demand: 87 },
  { niche: 'AI coding assistants', audience: 'developers', demand: 93 },

  // SaaS & Tools
  { niche: 'micro-SaaS starter kits', audience: 'indie hackers', demand: 90 },
  { niche: 'landing page builders', audience: 'startups', demand: 85 },
  { niche: 'email automation', audience: 'marketers', demand: 82 },
  { niche: 'SEO tools', audience: 'content creators', demand: 88 },
  { niche: 'social media schedulers', audience: 'marketers', demand: 80 },
  { niche: 'invoice generators', audience: 'freelancers', demand: 78 },
  { niche: 'project management', audience: 'teams', demand: 75 },

  // Content & Templates
  { niche: 'Notion templates', audience: 'productivity enthusiasts', demand: 90 },
  { niche: 'resume builders', audience: 'job seekers', demand: 85 },
  { niche: 'pitch deck templates', audience: 'founders', demand: 82 },
  { niche: 'business plan templates', audience: 'entrepreneurs', demand: 78 },
  { niche: 'email templates', audience: 'sales teams', demand: 80 },

  // Developer Tools
  { niche: 'Next.js boilerplates', audience: 'developers', demand: 92 },
  { niche: 'Tailwind CSS components', audience: 'frontend devs', demand: 88 },
  { niche: 'API starter kits', audience: 'backend devs', demand: 85 },
  { niche: 'Chrome extensions', audience: 'general users', demand: 90 },
  { niche: 'VS Code extensions', audience: 'developers', demand: 80 },
  { niche: 'CLI tools', audience: 'developers', demand: 75 },

  // Business & Finance
  { niche: 'financial dashboards', audience: 'business owners', demand: 82 },
  { niche: 'expense trackers', audience: 'freelancers', demand: 78 },
  { niche: 'CRM tools', audience: 'sales teams', demand: 85 },
  { niche: 'lead generation', audience: 'marketers', demand: 90 },

  // Trending 2026
  { niche: 'MCP servers', audience: 'AI developers', demand: 95 },
  { niche: 'AI agent frameworks', audience: 'developers', demand: 93 },
  { niche: 'OpenClaw skills', audience: 'AI enthusiasts', demand: 88 },
  { niche: 'vibe coding tools', audience: 'non-technical creators', demand: 85 },
];

/**
 * Scan Product Hunt for trending products and gaps
 */
async function scanProductHunt() {
  const ideas = [];
  try {
    // Product Hunt's homepage shows trending products
    const res = await fetch('https://www.producthunt.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (res.ok) {
      const html = await res.text();
      // Extract trending categories and product names
      const trendMatches = html.match(/data-test="post-name"[^>]*>([^<]+)/g) || [];
      for (const match of trendMatches.slice(0, 10)) {
        const name = match.replace(/data-test="post-name"[^>]*>/, '').trim();
        ideas.push({
          source: 'producthunt',
          trend: name,
          signal: 'trending_product',
        });
      }
    }
  } catch (e) {
    // Product Hunt may block, that's fine
  }
  return ideas;
}

/**
 * Scan Reddit for what people are asking for / paying for
 */
async function scanRedditDemand() {
  const ideas = [];
  const subreddits = [
    'SideProject', 'indiehackers', 'SaaS', 'Entrepreneur',
    'webdev', 'reactjs', 'nextjs', 'artificial',
    'ChatGPT', 'ClaudeAI', 'MachineLearning',
  ];

  for (const sub of subreddits.slice(0, 5)) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
        headers: { 'User-Agent': 'HustleBot/3.0' },
      });
      if (res.ok) {
        const data = await res.json();
        const posts = data?.data?.children || [];
        for (const post of posts) {
          const title = post.data?.title || '';
          const score = post.data?.score || 0;

          // Look for demand signals
          const demandSignals = [
            /looking for|need a|wish there was|anyone built|does .* exist/i,
            /built|launched|made \$|revenue|sold|paying customers/i,
            /tool|app|template|extension|plugin|api|saas/i,
          ];

          if (demandSignals.some(s => s.test(title)) && score > 10) {
            ideas.push({
              source: `reddit:${sub}`,
              trend: title,
              signal: score > 100 ? 'high_demand' : 'moderate_demand',
              score,
            });
          }
        }
      }
    } catch (e) {
      // Rate limited, skip
    }
  }
  return ideas;
}

/**
 * Scan Hacker News for demand signals
 */
async function scanHackerNews() {
  const ideas = [];
  try {
    // Check "Show HN" and "Ask HN" for what people are building/wanting
    const res = await fetch('https://hacker-news.firebaseio.com/v0/showstories.json');
    if (res.ok) {
      const storyIds = await res.json();
      // Check top 15 stories
      for (const id of storyIds.slice(0, 15)) {
        try {
          const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (storyRes.ok) {
            const story = await storyRes.json();
            if (story?.title && story?.score > 20) {
              ideas.push({
                source: 'hackernews:show',
                trend: story.title,
                signal: story.score > 100 ? 'viral' : 'trending',
                score: story.score,
                url: story.url,
              });
            }
          }
        } catch (e) { /* skip */ }
      }
    }
  } catch (e) {
    // HN API failed
  }
  return ideas;
}

/**
 * Scan GitHub trending for popular project types
 */
async function scanGitHubTrending() {
  const ideas = [];
  try {
    const res = await fetch('https://api.github.com/search/repositories?q=stars:>100+created:>2026-01-01&sort=stars&order=desc&per_page=20', {
      headers: { 'User-Agent': 'HustleBot/3.0' },
    });
    if (res.ok) {
      const data = await res.json();
      for (const repo of (data.items || []).slice(0, 15)) {
        ideas.push({
          source: 'github:trending',
          trend: `${repo.name}: ${repo.description || 'Popular repo'}`,
          signal: repo.stargazers_count > 1000 ? 'viral' : 'trending',
          score: repo.stargazers_count,
          language: repo.language,
          topics: repo.topics,
        });
      }
    }
  } catch (e) { /* skip */ }
  return ideas;
}

/**
 * Generate product ideas from market signals
 */
function generateIdeasFromSignals(signals) {
  const ideas = [];

  for (const signal of signals) {
    const trend = signal.trend.toLowerCase();

    // Match signals to product types we can build
    for (const [typeKey, typeInfo] of Object.entries(ProductTypes)) {
      let relevance = 0;

      // Score relevance based on signal content
      if (/template|notion|obsidian/.test(trend)) {
        if (typeKey === 'notion_template') relevance += 40;
      }
      if (/chrome|extension|browser/.test(trend)) {
        if (typeKey === 'chrome_extension') relevance += 40;
      }
      if (/saas|app|tool|dashboard/.test(trend)) {
        if (['web_tool', 'full_app'].includes(typeKey)) relevance += 35;
      }
      if (/api|endpoint|backend/.test(trend)) {
        if (typeKey === 'api_service') relevance += 35;
      }
      if (/ai|claude|gpt|llm|agent/.test(trend)) {
        if (['ai_tool', 'prompt_library'].includes(typeKey)) relevance += 40;
      }
      if (/guide|tutorial|course|learn/.test(trend)) {
        if (typeKey === 'pdf_guide') relevance += 35;
      }
      if (/starter|boilerplate|template|kit/.test(trend)) {
        if (['starter_kit', 'website_template'].includes(typeKey)) relevance += 35;
      }

      // Boost based on signal strength
      if (signal.signal === 'viral') relevance += 20;
      else if (signal.signal === 'high_demand') relevance += 15;
      else if (signal.signal === 'trending') relevance += 10;

      if (relevance >= 40) {
        ideas.push({
          name: `${typeInfo.name} inspired by: ${signal.trend.slice(0, 80)}`,
          type: typeKey,
          niche: signal.trend.slice(0, 100),
          source: signal.source,
          demandScore: Math.min(100, relevance + (signal.score ? Math.min(30, signal.score / 10) : 0)),
          targetAudience: signal.audience || 'general',
        });
      }
    }
  }

  // Deduplicate by type+niche similarity
  const seen = new Set();
  return ideas.filter(idea => {
    const key = `${idea.type}:${idea.niche.slice(0, 30)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.demandScore - a.demandScore);
}

/**
 * Get curated product ideas from hot niches (always available, no API needed)
 */
export function getCuratedIdeas(count = 10) {
  const ideas = [];

  // Pair niches with product types for maximum fit
  const highValueCombos = [
    // IMMEDIATE REVENUE — Things we can build and sell TODAY
    { niche: 'AI agents', type: 'starter_kit', name: 'AI Agent Starter Kit — Build Your Own Claude Agent', price: 49, demand: 95 },
    { niche: 'Claude Code automation', type: 'pdf_guide', name: 'The Claude Code Masterclass — From Zero to Full Automation', price: 29, demand: 92 },
    { niche: 'Next.js boilerplates', type: 'starter_kit', name: 'ShipFast Next.js — Auth + Payments + Dashboard in 5 Minutes', price: 79, demand: 93 },
    { niche: 'Notion templates', type: 'notion_template', name: 'The Solopreneur OS — Complete Notion Business System', price: 19, demand: 90 },
    { niche: 'AI prompt engineering', type: 'prompt_library', name: '500+ Battle-Tested AI Prompts for Developers', price: 19, demand: 88 },
    { niche: 'MCP servers', type: 'starter_kit', name: 'MCP Server Builder Kit — Create Custom Claude Tools', price: 39, demand: 95 },
    { niche: 'landing page builders', type: 'website_template', name: 'LaunchPage — Beautiful Landing Page Templates (10 Pack)', price: 29, demand: 85 },
    { niche: 'SEO tools', type: 'web_tool', name: 'SEO Analyzer — Instant Website Audit & Recommendations', price: 19, demand: 88 },
    { niche: 'resume builders', type: 'web_tool', name: 'AI Resume Builder — ATS-Optimized Resumes in 60 Seconds', price: 9, demand: 85 },
    { niche: 'Chrome extensions', type: 'chrome_extension', name: 'PageGist — AI Summary of Any Web Page', price: 5, demand: 90 },
    { niche: 'email automation', type: 'web_tool', name: 'ColdMail AI — Personalized Cold Emails at Scale', price: 29, demand: 82 },
    { niche: 'financial dashboards', type: 'web_tool', name: 'BurnRate — Startup Financial Dashboard', price: 39, demand: 82 },
    { niche: 'lead generation', type: 'ai_tool', name: 'LeadMagnet AI — Generate Lead Magnets in 2 Minutes', price: 19, demand: 88 },
    { niche: 'pitch deck templates', type: 'pdf_guide', name: 'The $10M Pitch Deck — Templates That Actually Raise Money', price: 29, demand: 82 },
    { niche: 'OpenClaw skills', type: 'starter_kit', name: 'OpenClaw Skill Builder — Create & Sell AI Skills', price: 39, demand: 88 },
    { niche: 'AI workflow automation', type: 'ai_tool', name: 'WorkflowGPT — Turn English into n8n/Make Automations', price: 29, demand: 92 },
    { niche: 'micro-SaaS starter kits', type: 'starter_kit', name: 'SaaSKit — Complete Micro-SaaS Boilerplate (Auth+Billing+Dashboard)', price: 99, demand: 90 },
    { niche: 'vibe coding tools', type: 'web_tool', name: 'VibeCode — Describe Your App, Get Working Code', price: 19, demand: 85 },
    { niche: 'Tailwind CSS components', type: 'website_template', name: 'TailwindUI Pro — 200+ Beautiful Component Blocks', price: 39, demand: 88 },
    { niche: 'AI coding assistants', type: 'chrome_extension', name: 'CodeReview AI — Instant PR Reviews in Your Browser', price: 9, demand: 90 },
  ];

  return highValueCombos
    .sort((a, b) => b.demand - a.demand)
    .slice(0, count)
    .map(combo => ({
      name: combo.name,
      type: combo.type,
      description: ProductTypes[combo.type]?.description || '',
      niche: combo.niche,
      targetAudience: HOT_NICHES.find(n => n.niche === combo.niche)?.audience || 'general',
      demandScore: combo.demand,
      price: combo.price,
      tags: [combo.niche, combo.type],
    }));
}

/**
 * Full market research scan — combines all sources
 */
export async function runMarketResearch() {
  console.log('  🔍 Scanning market for opportunities...\n');

  // Run all scans in parallel
  const [phIdeas, redditIdeas, hnIdeas, ghIdeas] = await Promise.allSettled([
    scanProductHunt(),
    scanRedditDemand(),
    scanHackerNews(),
    scanGitHubTrending(),
  ]);

  const allSignals = [
    ...(phIdeas.status === 'fulfilled' ? phIdeas.value : []),
    ...(redditIdeas.status === 'fulfilled' ? redditIdeas.value : []),
    ...(hnIdeas.status === 'fulfilled' ? hnIdeas.value : []),
    ...(ghIdeas.status === 'fulfilled' ? ghIdeas.value : []),
  ];

  console.log(`  📡 Found ${allSignals.length} market signals`);

  // Generate ideas from live signals
  const liveIdeas = generateIdeasFromSignals(allSignals);
  console.log(`  💡 Generated ${liveIdeas.length} product ideas from live data`);

  // Always include curated high-value ideas
  const curatedIdeas = getCuratedIdeas(10);
  console.log(`  ⭐ ${curatedIdeas.length} curated high-demand product ideas`);

  // Merge and deduplicate
  const allIdeas = [...liveIdeas, ...curatedIdeas]
    .sort((a, b) => b.demandScore - a.demandScore)
    .slice(0, 20);

  return {
    signals: allSignals,
    ideas: allIdeas,
    scannedAt: new Date().toISOString(),
    sources: {
      productHunt: phIdeas.status === 'fulfilled' ? phIdeas.value.length : 0,
      reddit: redditIdeas.status === 'fulfilled' ? redditIdeas.value.length : 0,
      hackerNews: hnIdeas.status === 'fulfilled' ? hnIdeas.value.length : 0,
      github: ghIdeas.status === 'fulfilled' ? ghIdeas.value.length : 0,
      curated: curatedIdeas.length,
    },
  };
}
