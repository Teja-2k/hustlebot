import { BaseAgent } from '../base-agent.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkHTMLValid, checkJSSyntax, checkNpmInstall, checkFileTypes } from '../quality-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * WebAgent — Builds websites, landing pages, portfolios, dashboards, web apps.
 * Highest demand category on freelance platforms.
 */
export default class WebAgent extends BaseAgent {
  constructor() {
    super({
      name: 'WebAgent',
      type: 'web',
      emoji: '🌐',
      description: 'Websites, landing pages, portfolios, dashboards, React/Next.js apps',
      supportedGigTypes: ['website', 'landing page', 'portfolio', 'dashboard', 'web app', 'frontend'],
      allowedTools: [
        'Edit', 'Write', 'Read', 'Glob', 'Grep',
        'Bash(npm*)', 'Bash(npx*)', 'Bash(node*)',
        'Bash(git*)', 'Bash(mkdir*)', 'Bash(ls*)',
        'Bash(cat*)', 'Bash(echo*)', 'Bash(cp*)',
      ],
      timeout: 20 * 60 * 1000, // 20 minutes (web projects can be complex)
      agentDir: __dirname,
    });
  }

  async scaffoldProject(deliveryDir, gig, plan) {
    fs.mkdirSync(deliveryDir, { recursive: true });

    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Determine project type from gig description
    if (text.includes('react') || text.includes('next.js') || text.includes('nextjs') || text.includes('dashboard') || text.includes('saas')) {
      // React/Next.js project — let Claude Code set it up via npm
      fs.writeFileSync(path.join(deliveryDir, '.project-type'), 'react');
    } else {
      // Static HTML site — scaffold basic structure
      fs.mkdirSync(path.join(deliveryDir, 'css'), { recursive: true });
      fs.mkdirSync(path.join(deliveryDir, 'js'), { recursive: true });
      fs.mkdirSync(path.join(deliveryDir, 'images'), { recursive: true });
      fs.writeFileSync(path.join(deliveryDir, '.project-type'), 'static');
    }
  }

  async runQualityChecks(projectDir, gig, plan) {
    const checks = [
      checkHTMLValid(),
      checkJSSyntax(),
      checkFileTypes(['.html', '.css']),
    ];

    // If it's a React project, also check npm
    if (fs.existsSync(path.join(projectDir, 'package.json'))) {
      checks.push(checkNpmInstall());
    }

    const { runQualityChecks: runChecks } = await import('../quality-runner.js');
    return await runChecks(projectDir, checks);
  }
}
