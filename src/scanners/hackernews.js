import chalk from 'chalk';

/**
 * Scan HackerNews for FREELANCE opportunities only.
 *
 * Sources:
 * 1. Monthly "Freelancer? Seeking Freelancer?" threads (PRIMARY - actual freelance gigs)
 * 2. "Ask HN" posts where people need technical help
 * 3. "Who's Hiring" threads filtered to contract/freelance/remote ONLY
 *
 * HN free API: https://hacker-news.firebaseio.com/v0/
 * Algolia search: https://hn.algolia.com/api
 */

const FULL_TIME_SIGNALS = [
  'full-time', 'fulltime', 'full time',
  'salary', 'equity', 'benefits', 'w-2', 'w2',
  '401k', '401(k)', 'health insurance',
  'on-site only', 'onsite only',
  'visa sponsor', 'h1b',
  '$\\d+k/year', '$\\d+k-\\d+k',
  'stock options', 'pto',
];

const FREELANCE_SIGNALS = [
  'freelance', 'contract', 'contractor', 'consulting',
  'part-time', 'part time', 'parttime',
  'remote', 'project-based', 'project based',
  'hourly', '/hr', 'per hour',
  'short-term', 'short term', 'gig',
  'open to contractors', 'freelancers welcome',
  'contract-to-hire', 'c2h',
];

export async function scanHackerNews(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 15;

  try {
    // Strategy 1: "Freelancer? Seeking Freelancer?" threads (BEST source)
    const freelanceJobs = await scanFreelancerThreads(keywords);
    jobs.push(...freelanceJobs);

    // Strategy 2: "Ask HN" posts (people needing help)
    const askJobs = await scanAskHN(keywords);
    jobs.push(...askJobs);

    // Strategy 3: "Who's Hiring" filtered to freelance/contract ONLY
    const hiringJobs = await scanWhoIsHiring(keywords);
    jobs.push(...hiringJobs);

  } catch (err) {
    console.log(chalk.yellow(`  ⚠ HackerNews scan error: ${err.message}`));
  }

  if (jobs.length === 0) {
    jobs.push(...getDemoHNJobs(keywords));
  }

  // Sort: freelance signals first, then by recency
  jobs.sort((a, b) => {
    const aFreelance = a.is_freelance ? 1 : 0;
    const bFreelance = b.is_freelance ? 1 : 0;
    if (aFreelance !== bFreelance) return bFreelance - aFreelance;
    return new Date(b.scraped_at) - new Date(a.scraped_at);
  });

  return jobs.slice(0, limit);
}

/**
 * Scan "Freelancer? Seeking Freelancer?" monthly threads
 */
async function scanFreelancerThreads(keywords) {
  const jobs = [];

  try {
    const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent('freelancer seeking')}&tags=story&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 45}`;

    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    if (!searchResp.ok) return [];

    const searchData = await searchResp.json();

    const freelanceThreads = (searchData.hits || []).filter(h =>
      h.title?.toLowerCase().includes('freelancer') && h.title?.toLowerCase().includes('seeking')
    );

    for (const thread of freelanceThreads.slice(0, 2)) {
      const threadUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&hitsPerPage=200`;
      const threadResp = await fetch(threadUrl, { signal: AbortSignal.timeout(10000) });

      if (!threadResp.ok) continue;

      const threadData = await threadResp.json();

      for (const comment of (threadData.hits || [])) {
        const text = comment.comment_text || '';
        const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ' ').replace(/\s+/g, ' ').trim();
        const textLower = cleanText.toLowerCase();

        // Must match at least one keyword
        const matchedKeyword = keywords.find(kw => textLower.includes(kw.toLowerCase()));
        if (!matchedKeyword || cleanText.length < 50) continue;

        // Check if this is a "SEEKING FREELANCER" post (someone hiring) vs "FREELANCER" post (someone offering services)
        const isSeeking = textLower.includes('seeking freelancer') ||
          textLower.includes('looking for') ||
          textLower.includes('need help') ||
          textLower.includes('hiring') ||
          textLower.includes('project:');

        if (isSeeking) {
          jobs.push({
            id: `hn-freelance-${comment.objectID}`,
            platform: 'hackernews',
            title: `HN Freelance: ${cleanText.substring(0, 80)}...`,
            description: cleanText.substring(0, 500),
            budget: extractBudgetFromHN(cleanText),
            skills: extractSkillsFromHN(cleanText, keywords),
            url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
            search_keyword: matchedKeyword,
            scraped_at: new Date().toISOString(),
            client_info: `HN thread: ${thread.title}`,
            parent_thread: thread.title,
            is_freelance: true,
          });
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    // silently fail
  }

  return jobs;
}

/**
 * Scan "Ask HN" posts — people asking for technical help
 */
async function scanAskHN(keywords) {
  const jobs = [];

  for (const keyword of keywords.slice(0, 3)) {
    try {
      const askUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=ask_hn&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30}&hitsPerPage=5`;

      const askResp = await fetch(askUrl, { signal: AbortSignal.timeout(10000) });
      if (!askResp.ok) continue;

      const askData = await askResp.json();

      for (const post of (askData.hits || [])) {
        if (post.title && post.num_comments > 0) {
          const storyText = (post.story_text || '').replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ' ').trim();

          jobs.push({
            id: `hn-ask-${post.objectID}`,
            platform: 'hackernews',
            title: post.title,
            description: (storyText || post.title).substring(0, 500),
            budget: 'Engagement opportunity',
            skills: [keyword],
            url: `https://news.ycombinator.com/item?id=${post.objectID}`,
            search_keyword: keyword,
            scraped_at: new Date().toISOString(),
            client_info: `${post.num_comments} comments • ${post.points} points`,
            is_freelance: false,
          });
        }
      }
    } catch (e) { /* skip */ }

    await new Promise(r => setTimeout(r, 500));
  }

  return jobs;
}

/**
 * Scan "Who's Hiring" threads — ONLY freelance/contract/remote opportunities
 */
async function scanWhoIsHiring(keywords) {
  const jobs = [];

  try {
    const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent('who is hiring')}&tags=story&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 45}`;

    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    if (!searchResp.ok) return [];

    const searchData = await searchResp.json();

    const hiringThreads = (searchData.hits || []).filter(h =>
      h.title?.toLowerCase().includes('who is hiring')
    );

    for (const thread of hiringThreads.slice(0, 1)) {
      const threadUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&hitsPerPage=200`;
      const threadResp = await fetch(threadUrl, { signal: AbortSignal.timeout(10000) });

      if (!threadResp.ok) continue;

      const threadData = await threadResp.json();

      for (const comment of (threadData.hits || [])) {
        const text = comment.comment_text || '';
        const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ' ').replace(/\s+/g, ' ').trim();
        const textLower = cleanText.toLowerCase();

        // Must match at least one keyword
        const matchedKeyword = keywords.find(kw => textLower.includes(kw.toLowerCase()));
        if (!matchedKeyword || cleanText.length < 50) continue;

        // FILTER: Must have freelance signals AND must NOT be purely full-time
        const hasFreelanceSignal = FREELANCE_SIGNALS.some(s => textLower.includes(s));
        const hasFullTimeSignal = FULL_TIME_SIGNALS.some(s => textLower.includes(s));

        // Only include if it has freelance signals OR is contract-compatible
        if (!hasFreelanceSignal) continue;
        // Skip if it's heavily full-time focused with no freelance option
        if (hasFullTimeSignal && !textLower.includes('contract') && !textLower.includes('freelance')) continue;

        jobs.push({
          id: `hn-hiring-${comment.objectID}`,
          platform: 'hackernews',
          title: `HN Contract: ${cleanText.substring(0, 80)}...`,
          description: cleanText.substring(0, 500),
          budget: extractBudgetFromHN(cleanText),
          skills: extractSkillsFromHN(cleanText, keywords),
          url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
          search_keyword: matchedKeyword,
          scraped_at: new Date().toISOString(),
          client_info: `HN thread: ${thread.title}`,
          parent_thread: thread.title,
          is_freelance: hasFreelanceSignal,
        });
      }

      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    // silently fail
  }

  return jobs;
}

function extractBudgetFromHN(text) {
  // Match hourly rates first (most relevant for freelance)
  const hourlyMatch = text.match(/\$\s*[\d,]+(?:\s*[-–]\s*\$?\s*[\d,]+)?\s*\/\s*(?:hr|hour)/i);
  if (hourlyMatch) return hourlyMatch[0];

  // Match fixed budgets
  const fixedMatch = text.match(/\$\s*[\d,]+(?:k|K)?(?:\s*[-–]\s*\$?\s*[\d,]+(?:k|K)?)?/);
  if (fixedMatch) return fixedMatch[0];

  return 'Not specified';
}

function extractSkillsFromHN(text, keywords) {
  const commonSkills = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'PostgreSQL',
    'AWS', 'Docker', 'Kubernetes', 'AI', 'ML', 'LLM', 'Claude', 'GPT', 'OpenAI',
    'Anthropic', 'LangChain', 'RAG', 'OpenClaw', 'n8n', 'automation', 'data pipeline',
    'Rust', 'Go', 'Ruby', 'Rails', 'Django', 'FastAPI', 'Next.js', 'Supabase',
    'Claude Code', 'Codex', 'Cursor', 'Vercel', 'Stripe',
  ];

  const found = commonSkills.filter(skill =>
    text.toLowerCase().includes(skill.toLowerCase())
  );

  const matchedKeywords = keywords.filter(kw =>
    text.toLowerCase().includes(kw.toLowerCase())
  );

  return [...new Set([...found, ...matchedKeywords])].slice(0, 8);
}

function getDemoHNJobs(keywords) {
  return [
    {
      id: 'hn-demo-1',
      platform: 'hackernews',
      title: 'Ask HN: Best way to set up an AI agent for my small business?',
      description: 'I run a small e-commerce shop and keep hearing about AI agents that can handle customer support, inventory, and social media. Has anyone set this up? Would love to hire someone who knows OpenClaw or similar.',
      budget: 'Engagement opportunity',
      skills: ['AI agents', 'OpenClaw', 'automation'],
      url: 'https://news.ycombinator.com/',
      search_keyword: keywords[0] || 'AI',
      scraped_at: new Date().toISOString(),
      client_info: '47 comments • 89 points',
      is_demo: true,
      is_freelance: false,
    },
    {
      id: 'hn-demo-2',
      platform: 'hackernews',
      title: 'HN Freelance: AI/ML startup needs contract data engineer — Remote, $150-200/hr',
      description: 'Building AI-powered analytics for healthcare. Looking for a contract data engineer to build real-time pipelines. Python, SQL, Spark. Remote. Open to freelancers, 3-6 month engagement.',
      budget: '$150-200/hr',
      skills: ['Python', 'SQL', 'data pipeline', 'AI', 'healthcare'],
      url: 'https://news.ycombinator.com/',
      search_keyword: keywords[0] || 'data',
      scraped_at: new Date().toISOString(),
      client_info: 'HN Freelancer? Seeking Freelancer? March 2026',
      is_demo: true,
      is_freelance: true,
    },
  ];
}
