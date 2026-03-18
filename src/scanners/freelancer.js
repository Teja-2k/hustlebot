import chalk from 'chalk';

const FREELANCER_API_URL = 'https://www.freelancer.com/api/projects/0.1/projects/active/';

/**
 * Scan Freelancer.com for jobs matching keywords.
 * Uses their public projects API (no auth needed).
 *
 * IMPROVED: Adds relevance filtering, quality scoring, and deduplication.
 */
export async function scanFreelancer(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 20;
  const minBudget = options.minBudget || 50; // Filter out spam/tiny jobs

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const query = encodeURIComponent(keyword);
      const url = `${FREELANCER_API_URL}?query=${query}&compact=true&job_details=true&limit=15&sort_field=time_submitted&project_types[]=fixed&project_types[]=hourly&full_description=true`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.log(chalk.yellow(`  ⚠ Freelancer returned ${response.status} for "${keyword}" — using demo results`));
        jobs.push(...getDemoFreelancerJobs(keyword));
        continue;
      }

      const data = await response.json();
      const projects = data?.result?.projects || [];

      for (const proj of projects) {
        // QUALITY FILTERS
        const description = proj.preview_description || proj.description || '';

        // Skip if description is too short (likely spam)
        if (description.length < 30) continue;

        // Skip if budget is below minimum
        const budgetMin = proj.budget?.minimum || 0;
        const budgetMax = proj.budget?.maximum || 0;
        const maxBudgetVal = Math.max(budgetMin, budgetMax);
        if (maxBudgetVal > 0 && maxBudgetVal < minBudget && proj.type !== 'hourly') continue;

        // Skip if too old (> 14 days)
        if (proj.time_submitted) {
          const age = Date.now() - (proj.time_submitted * 1000);
          if (age > 14 * 24 * 60 * 60 * 1000) continue;
        }

        // RELEVANCE CHECK: Does the project actually match the keyword?
        const searchText = `${proj.title || ''} ${description}`.toLowerCase();
        const kwLower = keyword.toLowerCase();
        const kwWords = kwLower.split(/\s+/);
        const matchCount = kwWords.filter(w => searchText.includes(w)).length;

        // Must match at least half the keyword words
        if (matchCount < Math.ceil(kwWords.length / 2)) continue;

        const budget = proj.budget
          ? (proj.budget.minimum && proj.budget.maximum
              ? `$${proj.budget.minimum} - $${proj.budget.maximum} ${proj.type === 'hourly' ? '/hr' : 'Fixed'}`
              : `$${proj.budget.minimum || proj.budget.maximum || '?'} ${proj.type === 'hourly' ? '/hr' : 'Fixed'}`)
          : 'Not specified';

        const skills = (proj.jobs || []).map(j => j.name).filter(Boolean);

        // Calculate a relevance quality score
        const qualityScore = calculateQuality(proj, keyword, skills);

        jobs.push({
          id: `freelancer-${proj.id || Date.now()}-${Math.random().toString(36).substring(7)}`,
          platform: 'freelancer',
          title: proj.title || 'Untitled Project',
          description: description.substring(0, 500),
          budget,
          skills,
          url: proj.seo_url
            ? `https://www.freelancer.com/projects/${proj.seo_url}`
            : `https://www.freelancer.com/projects/${proj.id}`,
          search_keyword: keyword,
          scraped_at: new Date().toISOString(),
          client_info: proj.owner
            ? `${proj.owner.username} (${proj.owner.reputation?.entire_history?.overall || '?'}★)`
            : null,
          bid_count: proj.bid_stats?.bid_count || 0,
          time_submitted: proj.time_submitted ? new Date(proj.time_submitted * 1000).toISOString() : null,
          quality_score: qualityScore,
          source: 'api',
        });
      }

    } catch (err) {
      console.log(chalk.yellow(`  ⚠ Error scanning Freelancer for "${keyword}": ${err.message}`));
      jobs.push(...getDemoFreelancerJobs(keyword));
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  // Dedupe by title similarity
  const seen = new Set();
  const unique = jobs.filter(j => {
    const key = j.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by quality score (highest first)
  unique.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));

  return unique.slice(0, limit);
}

/**
 * Calculate a quality/relevance score for a Freelancer project
 */
function calculateQuality(proj, keyword, skills) {
  let score = 0;

  // Budget quality (higher budget = better)
  const maxBudget = Math.max(proj.budget?.minimum || 0, proj.budget?.maximum || 0);
  if (maxBudget >= 1000) score += 20;
  else if (maxBudget >= 500) score += 15;
  else if (maxBudget >= 100) score += 10;
  else score += 5;

  // Competition (fewer bids = better opportunity)
  const bidCount = proj.bid_stats?.bid_count || 0;
  if (bidCount < 5) score += 15;
  else if (bidCount < 15) score += 10;
  else if (bidCount < 30) score += 5;

  // Client reputation
  const clientRating = proj.owner?.reputation?.entire_history?.overall || 0;
  if (clientRating >= 4.5) score += 10;
  else if (clientRating >= 4.0) score += 5;

  // Freshness
  if (proj.time_submitted) {
    const ageHours = (Date.now() - (proj.time_submitted * 1000)) / (1000 * 60 * 60);
    if (ageHours < 6) score += 15;
    else if (ageHours < 24) score += 10;
    else if (ageHours < 72) score += 5;
  }

  // Description quality
  const descLen = (proj.preview_description || proj.description || '').length;
  if (descLen > 200) score += 10;
  else if (descLen > 100) score += 5;

  // Skill relevance
  const kwLower = keyword.toLowerCase();
  if (skills.some(s => s.toLowerCase().includes(kwLower))) score += 10;

  return score;
}

/**
 * Demo fallback
 */
function getDemoFreelancerJobs(keyword) {
  const demoJobs = [
    {
      title: 'Build AI-Powered Document Processing Pipeline',
      description: 'Need a developer to build an automated document processing system using AI/ML. Extract text from PDFs, classify documents, route to workflows. Python preferred.',
      budget: '$1,500 - $3,000 Fixed',
      skills: ['Python', 'Machine Learning', 'OCR', 'NLP', 'Document Processing'],
      bid_count: 12,
    },
    {
      title: 'Full-Stack Developer for SaaS Dashboard',
      description: 'Building a SaaS analytics dashboard. React frontend with Node.js backend. Stripe billing. Real-time data visualization.',
      budget: '$50-80/hr',
      skills: ['React', 'Node.js', 'Stripe API', 'D3.js', 'PostgreSQL'],
      bid_count: 23,
    },
    {
      title: 'AI Chatbot Development with RAG Architecture',
      description: 'Build customer support chatbot using RAG with vector databases. Multi-turn conversations. Zendesk integration.',
      budget: '$2,000 - $5,000 Fixed',
      skills: ['AI', 'RAG', 'LangChain', 'Vector Database', 'Zendesk API'],
      bid_count: 8,
    },
    {
      title: 'Telegram Bot for E-commerce Order Management',
      description: 'Telegram bot integrating with Shopify. Order status, inventory alerts, customer notifications, admin commands.',
      budget: '$800 - $1,500 Fixed',
      skills: ['Telegram Bot', 'Shopify API', 'Node.js', 'Automation'],
      bid_count: 19,
    },
    {
      title: 'Web Scraping + Data Pipeline for Market Research',
      description: 'Automated data collection from multiple sources including LinkedIn, Glassdoor. Must handle anti-bot measures.',
      budget: '$40-60/hr',
      skills: ['Web Scraping', 'Python', 'Selenium', 'Data Pipeline'],
      bid_count: 31,
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
    id: `freelancer-demo-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
    platform: 'freelancer',
    url: 'https://www.freelancer.com/jobs/',
    search_keyword: keyword,
    scraped_at: new Date().toISOString(),
    client_info: 'Demo data',
    is_demo: true,
    time_submitted: new Date().toISOString(),
    source: 'demo',
  }));
}
