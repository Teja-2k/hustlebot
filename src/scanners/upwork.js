import * as cheerio from 'cheerio';
import chalk from 'chalk';

const UPWORK_SEARCH_URL = 'https://www.upwork.com/nx/search/jobs/';

/**
 * Scrape Upwork job listings by keyword
 * Uses web scraping since Upwork killed RSS in Aug 2024
 * 
 * NOTE: For production use, consider Apify actors or Upwork API key.
 * This scraper works for demo/personal use.
 */
export async function scanUpwork(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 20;

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const query = encodeURIComponent(keyword);
      const url = `${UPWORK_SEARCH_URL}?q=${query}&sort=recency&per_page=10`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        // Upwork may block scraping — fall back to demo data in that case
        console.log(chalk.yellow(`  ⚠ Upwork returned ${response.status} for "${keyword}" — using cached/demo results`));
        jobs.push(...getDemoUpworkJobs(keyword));
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Parse job cards — Upwork's DOM changes frequently, so we try multiple selectors
      $('article, [data-test="job-tile-list"] > div, .job-tile').each((i, el) => {
        const title = $(el).find('h2 a, .job-tile-title a, [data-test="job-tile-title-link"]').text().trim();
        const description = $(el).find('.job-description, [data-test="job-description-text"], .text-body-sm').text().trim();
        const budget = $(el).find('.budget, [data-test="budget"], .text-light').text().trim();
        const link = $(el).find('h2 a, .job-tile-title a').attr('href');
        const skillTags = [];
        $(el).find('.skill-tag, [data-test="skill"], .air3-token').each((_, tag) => {
          skillTags.push($(tag).text().trim());
        });

        if (title) {
          jobs.push({
            id: `upwork-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
            platform: 'upwork',
            title,
            description: description.substring(0, 500),
            budget: budget || 'Not specified',
            skills: skillTags,
            url: link ? `https://www.upwork.com${link}` : null,
            search_keyword: keyword,
            scraped_at: new Date().toISOString(),
            client_info: null,
          });
        }
      });

    } catch (err) {
      console.log(chalk.yellow(`  ⚠ Error scanning Upwork for "${keyword}": ${err.message}`));
      jobs.push(...getDemoUpworkJobs(keyword));
    }

    // Rate limiting - be nice to Upwork
    await new Promise(r => setTimeout(r, 2000));
  }

  // Dedupe by title
  const seen = new Set();
  const unique = jobs.filter(j => {
    const key = j.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, limit);
}

/**
 * Demo/fallback jobs when scraping is blocked
 * These are based on REAL job patterns seen on Upwork in March 2026
 */
function getDemoUpworkJobs(keyword) {
  const demoJobs = [
    {
      title: `OpenClaw AI Agent Setup & Configuration on Mac Mini`,
      description: `Looking for someone experienced with OpenClaw to set up a fully configured instance on a Mac Mini. Need Telegram integration, custom skills, and a nightly consolidation cron job. Docker preferred. Must have real OpenClaw experience.`,
      budget: '$300 - $800 Fixed',
      skills: ['OpenClaw', 'Docker', 'AI Agents', 'Telegram API', 'Linux'],
    },
    {
      title: `Claude Code Expert — Build AI-Powered Dashboard`,
      description: `Need a developer who knows Claude Code well to build a React dashboard that uses the Anthropic API for real-time data analysis. Must deploy to Vercel. Looking for someone who can work autonomously.`,
      budget: '$50-75/hr',
      skills: ['Claude Code', 'React', 'Anthropic API', 'Vercel', 'TypeScript'],
    },
    {
      title: `AI Automation Specialist — n8n + LLM Integration`,
      description: `We need someone to build AI-powered automation workflows using n8n. The workflows should process incoming customer emails, categorize them using an LLM, and auto-generate draft responses. Must integrate with Gmail and Slack.`,
      budget: '$1,000 - $2,500 Fixed',
      skills: ['n8n', 'AI Automation', 'LLM', 'Gmail API', 'Slack API'],
    },
    {
      title: `Data Pipeline Engineer — Python/SQL Real-time Analytics`,
      description: `Building a real-time analytics pipeline for an e-commerce platform. Need someone with strong Python and SQL skills. Data sources include Shopify, Google Analytics, and Stripe. Output to a Metabase dashboard.`,
      budget: '$75-100/hr',
      skills: ['Python', 'SQL', 'Data Pipeline', 'Shopify API', 'ETL'],
    },
    {
      title: `Build Custom AI Chatbot for Customer Support`,
      description: `We run a SaaS product and need a custom AI chatbot trained on our documentation. Should use RAG with our knowledge base. Must integrate with Intercom. Prefer Claude or GPT-4 as the base model.`,
      budget: '$2,000 - $5,000 Fixed',
      skills: ['AI Chatbot', 'RAG', 'LangChain', 'Anthropic', 'Intercom'],
    },
    {
      title: `OpenClaw Voice + SMS Automation for Lead Qualification`,
      description: `Need an OpenClaw specialist to set up voice and SMS automation for qualifying inbound leads. Must integrate with GoHighLevel CRM. Fast response time is critical.`,
      budget: '$500 - $1,500 Fixed',
      skills: ['OpenClaw', 'Voice AI', 'SMS API', 'CRM Integration', 'Automation'],
    },
  ];

  // Filter to keyword relevance
  const kw = keyword.toLowerCase();
  const relevant = demoJobs.filter(j =>
    j.title.toLowerCase().includes(kw) ||
    j.description.toLowerCase().includes(kw) ||
    j.skills.some(s => s.toLowerCase().includes(kw))
  );

  // If no matches, return first 2 as general results
  const results = relevant.length > 0 ? relevant : demoJobs.slice(0, 2);

  return results.map((j, i) => ({
    ...j,
    id: `upwork-demo-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
    platform: 'upwork',
    url: 'https://www.upwork.com/nx/search/jobs/',
    search_keyword: keyword,
    scraped_at: new Date().toISOString(),
    client_info: 'Demo data — connect Apify or Upwork API for live results',
    is_demo: true,
  }));
}
