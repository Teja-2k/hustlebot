import * as cheerio from 'cheerio';
import chalk from 'chalk';

const FREELANCER_API_URL = 'https://www.freelancer.com/api/projects/0.1/projects/active/';

/**
 * Scan Freelancer.com for jobs matching keywords.
 * Uses their public projects API (no auth needed for basic listing).
 * Falls back to demo data if blocked.
 */
export async function scanFreelancer(keywords, options = {}) {
  const jobs = [];
  const limit = options.limit || 20;

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const query = encodeURIComponent(keyword);
      const url = `${FREELANCER_API_URL}?query=${query}&compact=true&job_details=true&limit=10&sort_field=time_submitted&project_types[]=fixed&project_types[]=hourly`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        console.log(chalk.yellow(`  ⚠ Freelancer returned ${response.status} for "${keyword}" — using demo results`));
        jobs.push(...getDemoFreelancerJobs(keyword));
        continue;
      }

      const data = await response.json();
      const projects = data?.result?.projects || [];

      for (const proj of projects) {
        const budget = proj.budget
          ? (proj.budget.minimum && proj.budget.maximum
              ? `$${proj.budget.minimum} - $${proj.budget.maximum} ${proj.type === 'hourly' ? '/hr' : 'Fixed'}`
              : `$${proj.budget.minimum || proj.budget.maximum || '?'}`)
          : 'Not specified';

        const skills = (proj.jobs || []).map(j => j.name).filter(Boolean);

        jobs.push({
          id: `freelancer-${proj.id || Date.now()}-${Math.random().toString(36).substring(7)}`,
          platform: 'freelancer',
          title: proj.title || 'Untitled Project',
          description: (proj.preview_description || proj.description || '').substring(0, 500),
          budget,
          skills,
          url: proj.seo_url ? `https://www.freelancer.com/projects/${proj.seo_url}` : `https://www.freelancer.com/projects/${proj.id}`,
          search_keyword: keyword,
          scraped_at: new Date().toISOString(),
          client_info: proj.owner ? `${proj.owner.username} (${proj.owner.reputation?.entire_history?.overall || '?'}★)` : null,
          bid_count: proj.bid_stats?.bid_count || 0,
          time_submitted: proj.time_submitted ? new Date(proj.time_submitted * 1000).toISOString() : null,
        });
      }

    } catch (err) {
      console.log(chalk.yellow(`  ⚠ Error scanning Freelancer for "${keyword}": ${err.message}`));
      jobs.push(...getDemoFreelancerJobs(keyword));
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 1500));
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
 * Demo/fallback jobs when API is blocked
 */
function getDemoFreelancerJobs(keyword) {
  const demoJobs = [
    {
      title: 'Build AI-Powered Document Processing Pipeline',
      description: 'Need a developer to build an automated document processing system using AI/ML. Should extract text from PDFs, classify documents, and route them to appropriate workflows. Python preferred, with experience in OCR and NLP.',
      budget: '$1,500 - $3,000 Fixed',
      skills: ['Python', 'Machine Learning', 'OCR', 'NLP', 'Document Processing'],
      bid_count: 12,
    },
    {
      title: 'Full-Stack Developer for SaaS Dashboard',
      description: 'We are building a SaaS analytics dashboard and need a full-stack developer. React frontend with Node.js backend. Must integrate with Stripe for billing and have experience with real-time data visualization using charts.',
      budget: '$50-80/hr',
      skills: ['React', 'Node.js', 'Stripe API', 'D3.js', 'PostgreSQL'],
      bid_count: 23,
    },
    {
      title: 'AI Chatbot Development with RAG Architecture',
      description: 'Looking for an AI specialist to build a customer support chatbot using RAG. Must use vector databases for knowledge retrieval and support multi-turn conversations. Integration with our existing Zendesk system required.',
      budget: '$2,000 - $5,000 Fixed',
      skills: ['AI', 'RAG', 'LangChain', 'Vector Database', 'Zendesk API'],
      bid_count: 8,
    },
    {
      title: 'DevOps Engineer — Kubernetes + CI/CD Pipeline',
      description: 'Set up production Kubernetes cluster on AWS EKS with full CI/CD pipeline. Need Helm charts, ArgoCD deployment, monitoring with Prometheus/Grafana, and automated scaling policies.',
      budget: '$3,000 - $6,000 Fixed',
      skills: ['Kubernetes', 'AWS', 'DevOps', 'Helm', 'ArgoCD'],
      bid_count: 15,
    },
    {
      title: 'Telegram Bot for E-commerce Order Management',
      description: 'Build a Telegram bot that integrates with Shopify for order management. Features: order status lookup, inventory alerts, automated customer notifications, and admin dashboard commands.',
      budget: '$800 - $1,500 Fixed',
      skills: ['Telegram Bot', 'Shopify API', 'Node.js', 'E-commerce', 'Automation'],
      bid_count: 19,
    },
    {
      title: 'Web Scraping + Data Pipeline for Market Research',
      description: 'Need a web scraping expert to build automated data collection pipelines for market research. Multiple sources including LinkedIn, Glassdoor, and industry-specific sites. Must handle anti-bot measures and deliver clean structured data.',
      budget: '$40-60/hr',
      skills: ['Web Scraping', 'Python', 'Selenium', 'Data Pipeline', 'Proxy Management'],
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
    client_info: 'Demo data — connect Freelancer API for live results',
    is_demo: true,
    time_submitted: new Date().toISOString(),
  }));
}
