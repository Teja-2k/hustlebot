import chalk from 'chalk';

/**
 * Scan HackerNews for freelance/hiring opportunities
 * 
 * Sources:
 * 1. Monthly "Who's Hiring" threads
 * 2. Monthly "Freelancer? Seeking Freelancer?" threads
 * 3. "Ask HN" posts where people need technical help
 * 
 * HN has a free API: https://hacker-news.firebaseio.com/v0/
 */

const HN_API = 'https://hacker-news.firebaseio.com/v0';

export async function scanHackerNews(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 10;

  try {
    // Strategy 1: Search recent "Who's Hiring" and "Freelancer" threads
    // These are monthly posts by whoishiring
    const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent('who is hiring')}&tags=story&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 45}`;

    const searchResp = await fetch(searchUrl);
    if (searchResp.ok) {
      const searchData = await searchResp.json();

      // Find the latest hiring thread
      const hiringThreads = (searchData.hits || []).filter(h =>
        h.title?.toLowerCase().includes('who is hiring') ||
        h.title?.toLowerCase().includes('freelancer? seeking')
      );

      for (const thread of hiringThreads.slice(0, 2)) {
        // Get comments from the thread
        const threadUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&hitsPerPage=100`;
        const threadResp = await fetch(threadUrl);

        if (threadResp.ok) {
          const threadData = await threadResp.json();

          for (const comment of (threadData.hits || [])) {
            const text = comment.comment_text || '';
            const textLower = text.toLowerCase();

            // Check if any keyword matches
            const matchedKeyword = keywords.find(kw =>
              textLower.includes(kw.toLowerCase())
            );

            if (matchedKeyword && text.length > 50) {
              // Strip HTML tags for clean display
              const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

              jobs.push({
                id: `hn-${comment.objectID}`,
                platform: 'hackernews',
                title: `HN Hiring: ${cleanText.substring(0, 80)}...`,
                description: cleanText.substring(0, 500),
                budget: extractBudgetFromHN(cleanText),
                skills: extractSkillsFromHN(cleanText, keywords),
                url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
                search_keyword: matchedKeyword,
                scraped_at: new Date().toISOString(),
                client_info: `HN thread: ${thread.title}`,
                parent_thread: thread.title,
              });
            }
          }
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Strategy 2: Search "Ask HN" for people needing help
    for (const keyword of keywords.slice(0, 3)) {
      const askUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=ask_hn&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30}&hitsPerPage=5`;

      const askResp = await fetch(askUrl);
      if (askResp.ok) {
        const askData = await askResp.json();

        for (const post of (askData.hits || [])) {
          if (post.title && post.num_comments > 0) {
            jobs.push({
              id: `hn-ask-${post.objectID}`,
              platform: 'hackernews',
              title: post.title,
              description: (post.story_text || post.title).replace(/<[^>]*>/g, ' ').substring(0, 500),
              budget: 'Engagement opportunity',
              skills: [keyword],
              url: `https://news.ycombinator.com/item?id=${post.objectID}`,
              search_keyword: keyword,
              scraped_at: new Date().toISOString(),
              client_info: `${post.num_comments} comments • ${post.points} points`,
            });
          }
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

  } catch (err) {
    console.log(chalk.yellow(`  ⚠ HackerNews scan error: ${err.message}`));
    jobs.push(...getDemoHNJobs(keywords));
  }

  if (jobs.length === 0) {
    jobs.push(...getDemoHNJobs(keywords));
  }

  return jobs.slice(0, limit);
}

function extractBudgetFromHN(text) {
  const budgetMatch = text.match(/\$[\d,]+(?:k|K)?(?:\s*[-–]\s*\$?[\d,]+(?:k|K)?)?(?:\s*\/\s*(?:hr|hour|year|yr|month|mo))?/);
  return budgetMatch ? budgetMatch[0] : 'Not specified';
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
      id: `hn-demo-1`,
      platform: 'hackernews',
      title: 'Ask HN: Best way to set up an AI agent for my small business?',
      description: 'I run a small e-commerce shop and keep hearing about AI agents that can handle customer support, inventory tracking, and social media. Has anyone actually set this up? Would love to hire someone who knows OpenClaw or similar.',
      budget: 'Engagement opportunity',
      skills: ['AI agents', 'OpenClaw', 'automation'],
      url: 'https://news.ycombinator.com/',
      search_keyword: keywords[0] || 'AI',
      scraped_at: new Date().toISOString(),
      client_info: '47 comments • 89 points',
      is_demo: true,
    },
    {
      id: `hn-demo-2`,
      platform: 'hackernews',
      title: 'HN Hiring: AI/ML startup — Senior Data Engineer (Remote, $150-200K or Contract)',
      description: 'We are building AI-powered analytics for healthcare. Looking for a senior data engineer who can build real-time data pipelines. Python, SQL, Spark. Remote-first. Open to contract work.',
      budget: '$150-200/hr contract',
      skills: ['Python', 'SQL', 'data pipeline', 'AI', 'healthcare'],
      url: 'https://news.ycombinator.com/',
      search_keyword: keywords[0] || 'data',
      scraped_at: new Date().toISOString(),
      client_info: 'HN Who\'s Hiring March 2026',
      is_demo: true,
    },
  ];
}
