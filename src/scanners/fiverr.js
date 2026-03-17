import * as cheerio from 'cheerio';
import chalk from 'chalk';

/**
 * Scan Fiverr buyer requests and relevant gig opportunities.
 * Fiverr doesn't have a public API for buyer requests, so we scrape
 * the search results to find demand signals (popular categories, trending searches).
 * Falls back to demo data when blocked.
 */
export async function scanFiverr(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 20;

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const query = encodeURIComponent(keyword);
      const url = `https://www.fiverr.com/search/gigs?query=${query}&source=main_banner&search_in=everywhere&search-autocomplete-original-term=${query}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        console.log(chalk.yellow(`  ⚠ Fiverr returned ${response.status} for "${keyword}" — using demo results`));
        jobs.push(...getDemoFiverrJobs(keyword));
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Fiverr buyer request patterns — look for "I need" / "looking for" in community
      // Also parse the demand signals from gig search results
      $('[class*="gig-card"], .gig-wrapper, article').each((i, el) => {
        const title = $(el).find('h3, [class*="title"], a[href*="/"]').first().text().trim();
        const sellerName = $(el).find('[class*="seller"], [class*="username"]').text().trim();
        const price = $(el).find('[class*="price"], .price').first().text().trim();
        const link = $(el).find('a[href*="/"]').first().attr('href');
        const rating = $(el).find('[class*="rating"]').text().trim();

        if (title && title.length > 10) {
          // Convert seller gig listings into demand signals
          // "I will build X" → "Need someone to build X"
          const demandTitle = title.replace(/^I will /i, 'Need: ').replace(/^I can /i, 'Demand for: ');

          jobs.push({
            id: `fiverr-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`,
            platform: 'fiverr',
            title: demandTitle,
            description: `Active demand on Fiverr for "${keyword}". Competing sellers charge ${price || 'varies'}. ${rating ? `Top sellers rated ${rating}.` : ''} This indicates buyer demand you can fulfill.`,
            budget: price || 'Varies by seller',
            skills: [keyword],
            url: link ? (link.startsWith('http') ? link : `https://www.fiverr.com${link}`) : `https://www.fiverr.com/search/gigs?query=${query}`,
            search_keyword: keyword,
            scraped_at: new Date().toISOString(),
            client_info: sellerName ? `Competing seller: ${sellerName}` : null,
            demand_signal: true,
          });
        }
      });

    } catch (err) {
      console.log(chalk.yellow(`  ⚠ Error scanning Fiverr for "${keyword}": ${err.message}`));
      jobs.push(...getDemoFiverrJobs(keyword));
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // If we got nothing from scraping, use demo data
  if (jobs.length === 0) {
    for (const keyword of keywords.slice(0, 3)) {
      jobs.push(...getDemoFiverrJobs(keyword));
    }
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

function getDemoFiverrJobs(keyword) {
  const demoJobs = [
    {
      title: 'Need: AI Chatbot for Website Customer Support',
      description: 'High demand on Fiverr for AI chatbot development. Buyers typically pay $200-$1,000 for custom chatbots. Top sellers have 500+ reviews. Great opportunity if you know LangChain, RAG, or Claude API.',
      budget: '$200 - $1,000',
      skills: ['AI Chatbot', 'LangChain', 'Python', 'NLP'],
    },
    {
      title: 'Need: Python Automation Scripts & Bots',
      description: 'Consistent buyer demand for Python automation. Includes web scrapers, data processors, API integrations, and workflow automation. Buyers pay $100-$500 per project.',
      budget: '$100 - $500',
      skills: ['Python', 'Automation', 'Web Scraping', 'API Integration'],
    },
    {
      title: 'Need: Full-Stack Web App Development',
      description: 'Strong demand for React + Node.js web applications. Buyers looking for SaaS dashboards, admin panels, and custom web tools. Budget ranges from $500 to $5,000.',
      budget: '$500 - $5,000',
      skills: ['React', 'Node.js', 'Full Stack', 'MongoDB', 'PostgreSQL'],
    },
    {
      title: 'Need: Data Analysis & Visualization Dashboard',
      description: 'Growing demand for data dashboards. Buyers want interactive visualizations using Python (Plotly/Streamlit) or JavaScript (D3.js/Chart.js). Typical project $300-$1,500.',
      budget: '$300 - $1,500',
      skills: ['Data Analysis', 'Python', 'Streamlit', 'D3.js', 'Dashboard'],
    },
    {
      title: 'Need: AI/ML Model Training & Deployment',
      description: 'Enterprise buyers seeking ML engineers for model training, fine-tuning, and deployment. Covers computer vision, NLP, recommendation systems. High-value projects $1,000-$10,000.',
      budget: '$1,000 - $10,000',
      skills: ['Machine Learning', 'TensorFlow', 'PyTorch', 'MLOps', 'AI'],
    },
    {
      title: 'Need: Telegram/Discord Bot Development',
      description: 'Steady demand for custom bots. Buyers want trading bots, community management bots, notification systems, and game bots. Average $150-$800 per project.',
      budget: '$150 - $800',
      skills: ['Telegram Bot', 'Discord Bot', 'Node.js', 'Python', 'API'],
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
  }));
}
