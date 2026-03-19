/**
 * Growth Engine — Automated marketing for products
 *
 * Posts to Twitter/X, Reddit, Product Hunt, and other channels
 * to drive traffic and sales to deployed products.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { updateProduct, loadCatalog } from './product-catalog.js';
import { getConfigDir } from '../utils/config.js';

const GROWTH_CONFIG_FILE = () => path.join(getConfigDir(), 'growth-config.json');

/**
 * Load growth engine configuration
 */
export function loadGrowthConfig() {
  const file = GROWTH_CONFIG_FILE();
  if (!fs.existsSync(file)) {
    return {
      twitter: { enabled: false, handle: null, approvalRequired: true },
      reddit: { enabled: false, accounts: [], approvalRequired: true },
      producthunt: { enabled: false, token: null },
      seo: { enabled: true },
    };
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveGrowthConfig(config) {
  const file = GROWTH_CONFIG_FILE();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

/**
 * Generate marketing copy for a product using Claude Code
 */
export async function generateMarketingCopy(product) {
  const prompt = `Generate marketing copy for this digital product. Return JSON only.

Product: ${product.name}
Type: ${product.type}
Price: $${product.price}
URL: ${product.deployUrl || 'TBD'}
Description: ${product.description || product.niche}

Generate the following in JSON format:
{
  "twitter_thread": ["tweet1 (max 280 chars)", "tweet2", "tweet3"],
  "twitter_single": "Single compelling tweet (max 280 chars) with the product URL",
  "reddit_title": "Reddit post title (compelling, not salesy)",
  "reddit_body": "Reddit post body (value-first, show don't tell, include link naturally)",
  "product_hunt_tagline": "One-line tagline (max 60 chars)",
  "product_hunt_description": "2-3 sentence description for Product Hunt",
  "seo_title": "SEO-optimized page title (max 60 chars)",
  "seo_description": "Meta description (max 160 chars)",
  "email_subject": "Email subject line for launch announcement",
  "email_body": "Short launch email (3-4 paragraphs)"
}

Rules:
- Be genuine, not salesy. People hate hard sells.
- Lead with the PROBLEM it solves, not features
- Use specific numbers where possible
- Include the URL naturally
- For Twitter, use relevant hashtags (max 2)
- For Reddit, provide genuine value — don't just promote`;

  return new Promise((resolve) => {
    const proc = spawn('claude', [
      '-p', prompt,
      '--output-format', 'text',
    ], {
      shell: true,
      timeout: 60000,
    });

    let output = '';
    proc.stdout?.on('data', (d) => { output += d.toString(); });
    proc.on('close', () => {
      try {
        // Extract JSON from output
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          resolve(JSON.parse(jsonMatch[0]));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });
}

/**
 * Post a tweet (requires Twitter API or browser automation)
 */
export async function postToTwitter(product, copy) {
  const config = loadGrowthConfig();
  if (!config.twitter.enabled) {
    return { success: false, error: 'Twitter not configured' };
  }

  const tweet = copy?.twitter_single || `Just launched: ${product.name} — ${product.deployUrl}`;

  // Use Puppeteer for Twitter posting (no API needed)
  // This is a simplified version — full implementation uses browser automation
  console.log(`  🐦 Twitter post queued:`);
  console.log(`     "${tweet}"`);

  if (config.twitter.approvalRequired) {
    console.log(`  ⏸ Awaiting approval (set approvalRequired: false to auto-post)`);

    // Save to pending queue
    const queueFile = path.join(getConfigDir(), 'growth-queue.json');
    const queue = fs.existsSync(queueFile) ? JSON.parse(fs.readFileSync(queueFile, 'utf-8')) : [];
    queue.push({
      platform: 'twitter',
      productId: product.id,
      content: tweet,
      createdAt: new Date().toISOString(),
      status: 'pending_approval',
    });
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

    return { success: true, status: 'pending_approval', content: tweet };
  }

  // Auto-post mode (when approval not required)
  // TODO: Implement actual Twitter posting via Puppeteer or API
  return { success: false, error: 'Auto-posting not yet implemented — use approval mode' };
}

/**
 * Post to Reddit
 */
export async function postToReddit(product, copy) {
  const config = loadGrowthConfig();
  if (!config.reddit.enabled) {
    return { success: false, error: 'Reddit not configured' };
  }

  const title = copy?.reddit_title || `I built ${product.name}`;
  const body = copy?.reddit_body || `Check it out: ${product.deployUrl}`;

  // Determine best subreddits based on product type
  const subredditMap = {
    web_tool: ['SideProject', 'webdev', 'indiehackers'],
    chrome_extension: ['SideProject', 'chrome', 'webdev'],
    starter_kit: ['SideProject', 'webdev', 'reactjs', 'nextjs'],
    ai_tool: ['SideProject', 'artificial', 'ClaudeAI'],
    pdf_guide: ['Entrepreneur', 'indiehackers'],
    notion_template: ['Notion', 'productivity'],
    website_template: ['webdev', 'SideProject'],
    api_service: ['webdev', 'programming', 'SideProject'],
    full_app: ['SideProject', 'indiehackers', 'startups'],
    prompt_library: ['ChatGPT', 'ClaudeAI', 'artificial'],
  };

  const targetSubs = subredditMap[product.type] || ['SideProject'];

  console.log(`  📮 Reddit posts queued for: ${targetSubs.join(', ')}`);
  console.log(`     Title: "${title}"`);

  // Queue for approval
  const queueFile = path.join(getConfigDir(), 'growth-queue.json');
  const queue = fs.existsSync(queueFile) ? JSON.parse(fs.readFileSync(queueFile, 'utf-8')) : [];

  for (const sub of targetSubs) {
    queue.push({
      platform: 'reddit',
      subreddit: sub,
      productId: product.id,
      title,
      body,
      createdAt: new Date().toISOString(),
      status: 'pending_approval',
    });
  }

  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

  return { success: true, status: 'pending_approval', subreddits: targetSubs };
}

/**
 * Generate SEO assets for a product (sitemap, meta tags, robots.txt)
 */
export function generateSEOAssets(product) {
  const productDir = product.buildDir;
  if (!productDir || !fs.existsSync(productDir)) return;

  // robots.txt
  const robotsPath = path.join(productDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) {
    fs.writeFileSync(robotsPath, `User-agent: *
Allow: /

Sitemap: ${product.deployUrl || ''}/sitemap.xml
`);
  }

  // sitemap.xml
  const sitemapPath = path.join(productDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    fs.writeFileSync(sitemapPath, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemato.org/schemas/sitemap/0.9">
  <url>
    <loc>${product.deployUrl || 'https://example.com'}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`);
  }

  console.log('  🔍 SEO assets generated (robots.txt, sitemap.xml)');
}

/**
 * Run full growth campaign for a product
 */
export async function launchGrowthCampaign(product) {
  console.log(`\n  📢 Launching growth campaign for: ${product.name}`);

  // Step 1: Generate marketing copy
  console.log('  ✏️ Generating marketing copy...');
  const copy = await generateMarketingCopy(product);

  if (!copy) {
    console.log('  ⚠ Could not generate marketing copy — using defaults');
  }

  // Step 2: Generate SEO assets
  generateSEOAssets(product);

  // Step 3: Queue social media posts
  const results = {};

  results.twitter = await postToTwitter(product, copy);
  results.reddit = await postToReddit(product, copy);

  // Step 4: Save marketing copy for reference
  if (copy) {
    const copyFile = path.join(product.buildDir, 'marketing-copy.json');
    fs.writeFileSync(copyFile, JSON.stringify(copy, null, 2));
    console.log('  💾 Marketing copy saved');
  }

  // Update product with marketing info
  updateProduct(product.id, {
    twitterPosts: [{ content: copy?.twitter_single, queuedAt: new Date().toISOString() }],
    redditPosts: results.reddit?.subreddits?.map(s => ({ subreddit: s, queuedAt: new Date().toISOString() })) || [],
  });

  return {
    copy,
    results,
    summary: `Growth campaign queued: Twitter ${results.twitter?.success ? '✓' : '✗'}, Reddit ${results.reddit?.success ? '✓' : '✗'}, SEO ✓`,
  };
}

/**
 * Get pending growth queue items
 */
export function getGrowthQueue() {
  const queueFile = path.join(getConfigDir(), 'growth-queue.json');
  if (!fs.existsSync(queueFile)) return [];
  return JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
}

/**
 * Approve a growth queue item
 */
export function approveQueueItem(index) {
  const queueFile = path.join(getConfigDir(), 'growth-queue.json');
  const queue = getGrowthQueue();
  if (index >= 0 && index < queue.length) {
    queue[index].status = 'approved';
    queue[index].approvedAt = new Date().toISOString();
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
    return queue[index];
  }
  return null;
}
