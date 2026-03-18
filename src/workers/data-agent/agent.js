import { BaseAgent } from '../base-agent.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkJSSyntax, checkPythonSyntax, checkNpmInstall, checkFileTypes } from '../quality-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * DataAgent — Builds scrapers, ETL pipelines, data analysis, dashboards.
 * High-value category — data work commands premium rates.
 */
export default class DataAgent extends BaseAgent {
  constructor() {
    super({
      name: 'DataAgent',
      type: 'data',
      emoji: '📊',
      description: 'Web scrapers, data pipelines, ETL, analysis, Streamlit dashboards',
      supportedGigTypes: ['scraper', 'data pipeline', 'etl', 'data analysis', 'dashboard', 'database', 'sql'],
      allowedTools: [
        'Edit', 'Write', 'Read', 'Glob', 'Grep',
        'Bash(npm*)', 'Bash(npx*)', 'Bash(node*)',
        'Bash(python*)', 'Bash(pip*)',
        'Bash(git*)', 'Bash(mkdir*)', 'Bash(ls*)',
        'Bash(cat*)', 'Bash(echo*)', 'Bash(cp*)',
      ],
      timeout: 20 * 60 * 1000, // 20 min — data projects can be complex
      agentDir: __dirname,
    });
  }

  async scaffoldProject(deliveryDir, gig, plan) {
    fs.mkdirSync(deliveryDir, { recursive: true });

    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Detect sub-type
    let dataType = 'scraper';
    if (text.includes('pipeline') || text.includes('etl') || text.includes('transform')) dataType = 'pipeline';
    else if (text.includes('dashboard') || text.includes('streamlit') || text.includes('visualization')) dataType = 'dashboard';
    else if (text.includes('analysis') || text.includes('analyze') || text.includes('report')) dataType = 'analysis';
    else if (text.includes('sql') || text.includes('database') || text.includes('postgres') || text.includes('mysql')) dataType = 'database';

    fs.writeFileSync(path.join(deliveryDir, '.data-type'), dataType);

    // Detect language — data projects lean Python
    const useNode = text.includes('node') || text.includes('javascript') || text.includes('cheerio');
    const lang = useNode ? 'node' : 'python';
    fs.writeFileSync(path.join(deliveryDir, '.script-lang'), lang);

    // Create directories
    fs.mkdirSync(path.join(deliveryDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'output'), { recursive: true });

    if (lang === 'python') {
      const reqs = ['python-dotenv>=1.0.0'];
      if (text.includes('scrape') || text.includes('crawl') || text.includes('spider')) {
        reqs.push('requests>=2.31.0', 'beautifulsoup4>=4.12.0', 'lxml>=4.9.0');
      }
      if (text.includes('selenium') || text.includes('browser') || text.includes('dynamic')) {
        reqs.push('selenium>=4.15.0', 'webdriver-manager>=4.0.0');
      }
      if (text.includes('pandas') || text.includes('data') || text.includes('csv') || text.includes('analysis')) {
        reqs.push('pandas>=2.1.0', 'openpyxl>=3.1.0');
      }
      if (text.includes('dashboard') || text.includes('streamlit')) {
        reqs.push('streamlit>=1.28.0', 'plotly>=5.18.0', 'pandas>=2.1.0');
      }
      if (text.includes('sql') || text.includes('postgres')) {
        reqs.push('sqlalchemy>=2.0.0', 'psycopg2-binary>=2.9.0');
      }
      if (text.includes('mysql')) {
        reqs.push('sqlalchemy>=2.0.0', 'pymysql>=1.1.0');
      }

      fs.writeFileSync(path.join(deliveryDir, 'requirements.txt'), [...new Set(reqs)].join('\n') + '\n');
    } else {
      const packageJson = {
        name: plan?.project_name || 'data-project',
        version: '1.0.0',
        type: 'module',
        main: 'index.js',
        scripts: { start: 'node index.js' },
        dependencies: {
          'dotenv': '^16.3.1',
          'cheerio': '^1.0.0-rc.12',
          'axios': '^1.6.2',
        },
      };
      fs.writeFileSync(path.join(deliveryDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    }

    fs.writeFileSync(path.join(deliveryDir, '.env.example'),
      '# Configuration\n# TARGET_URL=https://example.com\n# OUTPUT_FORMAT=csv\n# API_KEY=your_key_here\n');

    // Add .gitignore for data files
    fs.writeFileSync(path.join(deliveryDir, '.gitignore'),
      'node_modules/\n.env\noutput/*.csv\noutput/*.json\ndata/*.tmp\n__pycache__/\n*.pyc\n');
  }

  async runQualityChecks(projectDir, gig, plan) {
    const checks = [];
    const langFile = path.join(projectDir, '.script-lang');
    const lang = fs.existsSync(langFile) ? fs.readFileSync(langFile, 'utf-8').trim() : 'python';

    if (lang === 'python') {
      checks.push(checkPythonSyntax());
      checks.push(checkFileTypes(['.py']));
    } else {
      checks.push(checkJSSyntax());
      checks.push(checkFileTypes(['.js']));
      if (fs.existsSync(path.join(projectDir, 'package.json'))) {
        checks.push(checkNpmInstall());
      }
    }

    // Data-specific: output directory exists
    checks.push({
      name: 'Output directory ready',
      run: async (dir) => {
        const hasOutput = fs.existsSync(path.join(dir, 'output')) || fs.existsSync(path.join(dir, 'data'));
        return {
          passed: hasOutput,
          message: hasOutput ? 'Output directory exists' : 'Missing output directory',
        };
      },
    });

    const { runQualityChecks: runChecks } = await import('../quality-runner.js');
    return await runChecks(projectDir, checks);
  }
}
