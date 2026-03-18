import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Worker Router — classifies gigs and routes them to the right specialized agent.
 *
 * Classification: gig → type → agent
 * Routing: gig + profile → agent.execute(gig, profile) → deliverables
 */

// Agent registry
const AGENTS = {
  web: {
    name: 'WebAgent',
    emoji: '🌐',
    description: 'Websites, landing pages, portfolios, dashboards, React/Next.js apps',
    keywords: ['website', 'landing page', 'portfolio', 'dashboard', 'web app', 'frontend', 'react', 'next.js', 'html', 'css', 'tailwind', 'wordpress theme', 'shopify theme', 'responsive', 'ui/ux', 'saas'],
    module: './web-agent/agent.js',
  },
  bot: {
    name: 'BotAgent',
    emoji: '🤖',
    description: 'Telegram, Discord, Slack, WhatsApp bots and chatbots',
    keywords: ['telegram bot', 'discord bot', 'slack bot', 'whatsapp bot', 'chatbot', 'chat bot', 'ai chatbot', 'customer support bot', 'trading bot', 'notification bot'],
    module: './bot-agent/agent.js',
  },
  data: {
    name: 'DataAgent',
    emoji: '📊',
    description: 'Web scraping, data pipelines, analysis, ETL, dashboards',
    keywords: ['scraper', 'scraping', 'data pipeline', 'etl', 'data analysis', 'analytics', 'csv', 'database', 'sql', 'pandas', 'streamlit', 'metabase', 'data visualization', 'reporting'],
    module: './data-agent/agent.js',
  },
  design: {
    name: 'DesignAgent',
    emoji: '🎨',
    description: 'Thumbnails, banners, social media graphics, logos via AI image APIs',
    keywords: ['thumbnail', 'banner', 'logo', 'social media', 'graphic design', 'image', 'poster', 'flyer', 'brochure', 'infographic', 'icon', 'illustration'],
    module: './design-agent/agent.js',
  },
  script: {
    name: 'ScriptAgent',
    emoji: '⚡',
    description: 'Automation scripts, API integrations, CLI tools, cron jobs',
    keywords: ['automation', 'script', 'api integration', 'webhook', 'cron', 'cli tool', 'n8n', 'zapier', 'workflow', 'email automation', 'pdf', 'excel', 'google sheets', 'stripe integration'],
    module: './script-agent/agent.js',
  },
  writing: {
    name: 'WriteAgent',
    emoji: '📝',
    description: 'Blog posts, documentation, technical writing, SEO content, emails',
    keywords: ['blog', 'article', 'content writing', 'copywriting', 'seo', 'documentation', 'technical writing', 'email template', 'newsletter', 'product description', 'readme'],
    module: './write-agent/agent.js',
  },
  fix: {
    name: 'FixAgent',
    emoji: '🔧',
    description: 'Bug fixes, WordPress issues, debugging, code review, migrations',
    keywords: ['bug fix', 'debug', 'wordpress', 'shopify fix', 'error', 'fix issue', 'migration', 'upgrade', 'refactor', 'code review', 'performance', 'security fix'],
    module: './fix-agent/agent.js',
  },
};

/**
 * Classify a gig into an agent type using keyword matching
 * Returns: { type, agent, confidence, reason }
 */
export function classifyGig(gig) {
  const text = `${gig.title} ${gig.description || ''} ${(gig.skills || []).join(' ')}`.toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const [type, agent] of Object.entries(AGENTS)) {
    let score = 0;
    const matchedKeywords = [];

    for (const kw of agent.keywords) {
      if (text.includes(kw.toLowerCase())) {
        // Longer keywords are more specific, give them more weight
        score += kw.split(' ').length * 10;
        matchedKeywords.push(kw);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { type, ...agent, matchedKeywords, score };
    }
  }

  if (!bestMatch || bestScore < 10) {
    return {
      type: 'script', // default to script agent (most flexible)
      agent: AGENTS.script,
      confidence: 30,
      reason: 'No strong match — defaulting to ScriptAgent',
    };
  }

  const confidence = Math.min(95, 40 + bestScore);

  return {
    type: bestMatch.type,
    agent: bestMatch,
    confidence,
    reason: `Matched: ${bestMatch.matchedKeywords.slice(0, 3).join(', ')}`,
  };
}

/**
 * Get the right worker agent instance for a gig type
 */
export async function getAgent(type) {
  const agentInfo = AGENTS[type];
  if (!agentInfo) {
    throw new Error(`Unknown agent type: ${type}. Available: ${Object.keys(AGENTS).join(', ')}`);
  }

  try {
    const modulePath = path.join(__dirname, agentInfo.module);
    const { default: AgentClass } = await import(modulePath);
    return new AgentClass();
  } catch (e) {
    // Agent not yet implemented — use base agent with type-specific config
    const { BaseAgent } = await import('./base-agent.js');
    return new BaseAgent({
      name: agentInfo.name,
      type,
      emoji: agentInfo.emoji,
      description: agentInfo.description,
      supportedGigTypes: agentInfo.keywords,
      agentDir: path.join(__dirname, `${type}-agent`),
    });
  }
}

/**
 * Route a gig to the right agent and execute it
 * Returns the execution result
 */
export async function routeAndExecute(gig, profile, options = {}) {
  // Step 1: Classify
  const classification = classifyGig(gig);
  console.log(chalk.hex('#FF6B00')(`  ${classification.agent.emoji} Classified as: ${classification.agent.name} (${classification.confidence}% confidence)`));
  console.log(chalk.gray(`  Reason: ${classification.reason}`));

  // Step 2: Confidence check
  if (classification.confidence < 40 && !options.force) {
    console.log(chalk.yellow(`  ⚠ Low confidence (${classification.confidence}%) — needs human review`));
    return {
      success: false,
      needsReview: true,
      classification,
      error: 'Low confidence classification — human review needed',
    };
  }

  // Step 3: Get agent
  const agent = await getAgent(classification.type);

  // Step 4: Execute
  const result = await agent.execute(gig, profile, options);
  result.classification = classification;

  return result;
}

/**
 * List all available agents and their status
 */
export function listAgents() {
  return Object.entries(AGENTS).map(([type, agent]) => ({
    type,
    name: agent.name,
    emoji: agent.emoji,
    description: agent.description,
    keywordCount: agent.keywords.length,
  }));
}

/**
 * Get the emoji for a gig type (used in scan output)
 */
export function getAgentEmoji(type) {
  return AGENTS[type]?.emoji || '❓';
}

export { AGENTS };
