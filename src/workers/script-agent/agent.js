import { BaseAgent } from '../base-agent.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkJSSyntax, checkPythonSyntax, checkNpmInstall, checkFileTypes } from '../quality-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * ScriptAgent — Builds automation scripts, API integrations, CLI tools, cron jobs.
 * Consistent demand — businesses always need custom automation.
 */
export default class ScriptAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ScriptAgent',
      type: 'script',
      emoji: '⚡',
      description: 'Automation scripts, API integrations, CLI tools, cron jobs, n8n flows',
      supportedGigTypes: ['script', 'automation', 'api integration', 'cli tool', 'cron job', 'n8n', 'zapier'],
      allowedTools: [
        'Edit', 'Write', 'Read', 'Glob', 'Grep',
        'Bash(npm*)', 'Bash(npx*)', 'Bash(node*)',
        'Bash(python*)', 'Bash(pip*)',
        'Bash(git*)', 'Bash(mkdir*)', 'Bash(ls*)',
        'Bash(cat*)', 'Bash(echo*)', 'Bash(cp*)',
        'Bash(chmod*)',
      ],
      timeout: 15 * 60 * 1000,
      agentDir: __dirname,
    });
  }

  async scaffoldProject(deliveryDir, gig, plan) {
    fs.mkdirSync(deliveryDir, { recursive: true });

    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Detect language preference
    let lang = 'node'; // default
    if (text.includes('python') || text.includes('pandas') || text.includes('selenium') || text.includes('beautifulsoup')) {
      lang = 'python';
    } else if (text.includes('bash') || text.includes('shell') || text.includes('cron')) {
      lang = 'bash';
    }

    fs.writeFileSync(path.join(deliveryDir, '.script-lang'), lang);

    if (lang === 'node') {
      const packageJson = {
        name: plan?.project_name || 'automation-script',
        version: '1.0.0',
        type: 'module',
        main: 'index.js',
        scripts: {
          start: 'node index.js',
          dev: 'node --watch index.js',
        },
        dependencies: {
          'dotenv': '^16.3.1',
        },
      };

      // Add common automation deps based on gig description
      if (text.includes('api') || text.includes('fetch') || text.includes('http')) {
        packageJson.dependencies['axios'] = '^1.6.2';
      }
      if (text.includes('schedule') || text.includes('cron')) {
        packageJson.dependencies['node-cron'] = '^3.0.3';
      }
      if (text.includes('csv') || text.includes('excel')) {
        packageJson.dependencies['csv-parser'] = '^3.0.0';
        packageJson.dependencies['json2csv'] = '^6.0.0-alpha.2';
      }
      if (text.includes('email') || text.includes('smtp') || text.includes('mail')) {
        packageJson.dependencies['nodemailer'] = '^6.9.7';
      }

      fs.writeFileSync(
        path.join(deliveryDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    } else if (lang === 'python') {
      // Create requirements.txt with common deps
      const reqs = ['python-dotenv>=1.0.0'];
      if (text.includes('api') || text.includes('http')) reqs.push('requests>=2.31.0');
      if (text.includes('scrape') || text.includes('beautifulsoup')) reqs.push('beautifulsoup4>=4.12.0', 'requests>=2.31.0');
      if (text.includes('selenium')) reqs.push('selenium>=4.15.0');
      if (text.includes('csv') || text.includes('data') || text.includes('excel')) reqs.push('pandas>=2.1.0');
      if (text.includes('schedule') || text.includes('cron')) reqs.push('schedule>=1.2.0');

      fs.writeFileSync(path.join(deliveryDir, 'requirements.txt'), reqs.join('\n') + '\n');
    }

    // Create .env.example
    fs.writeFileSync(
      path.join(deliveryDir, '.env.example'),
      '# Add your API keys and configuration here\n# API_KEY=your_api_key_here\n# BASE_URL=https://api.example.com\n'
    );

    // Create src directory for larger projects
    fs.mkdirSync(path.join(deliveryDir, 'src'), { recursive: true });
  }

  async runQualityChecks(projectDir, gig, plan) {
    const checks = [];
    const langFile = path.join(projectDir, '.script-lang');
    const lang = fs.existsSync(langFile) ? fs.readFileSync(langFile, 'utf-8').trim() : 'node';

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

    // Script-specific: entry point exists
    checks.push({
      name: 'Script entry point exists',
      run: async (dir) => {
        const hasEntry = fs.existsSync(path.join(dir, 'index.js')) ||
                        fs.existsSync(path.join(dir, 'main.py')) ||
                        fs.existsSync(path.join(dir, 'script.py')) ||
                        fs.existsSync(path.join(dir, 'src', 'index.js')) ||
                        fs.existsSync(path.join(dir, 'src', 'main.py')) ||
                        fs.existsSync(path.join(dir, 'run.sh'));
        return {
          passed: hasEntry,
          message: hasEntry ? 'Entry point found' : 'Missing entry point (index.js, main.py, or run.sh)',
        };
      },
    });

    // Script-specific: .env.example exists
    checks.push({
      name: 'Config documented',
      run: async (dir) => {
        const hasEnv = fs.existsSync(path.join(dir, '.env.example'));
        const hasConfig = fs.existsSync(path.join(dir, 'config.json')) ||
                         fs.existsSync(path.join(dir, 'config.yaml'));
        return {
          passed: hasEnv || hasConfig,
          message: (hasEnv || hasConfig) ? 'Configuration documented' : 'Missing .env.example or config file',
        };
      },
    });

    const { runQualityChecks: runChecks } = await import('../quality-runner.js');
    return await runChecks(projectDir, checks);
  }
}
