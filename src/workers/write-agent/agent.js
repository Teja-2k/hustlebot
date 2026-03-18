import { BaseAgent } from '../base-agent.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * WriteAgent — Creates documentation, blog content, SEO articles, emails, copywriting.
 * Low-effort, high-volume category — great for passive income.
 */
export default class WriteAgent extends BaseAgent {
  constructor() {
    super({
      name: 'WriteAgent',
      type: 'writing',
      emoji: '📝',
      description: 'Blog posts, documentation, SEO content, emails, copywriting, technical writing',
      supportedGigTypes: ['blog', 'article', 'documentation', 'content writing', 'seo', 'copywriting', 'email', 'technical writing'],
      allowedTools: [
        'Edit', 'Write', 'Read', 'Glob', 'Grep',
        'Bash(mkdir*)', 'Bash(ls*)', 'Bash(cat*)',
        'Bash(echo*)', 'Bash(cp*)',
        'Bash(node*)', 'Bash(npx*)',
      ],
      timeout: 10 * 60 * 1000, // 10 min — writing is faster
      agentDir: __dirname,
    });
  }

  async scaffoldProject(deliveryDir, gig, plan) {
    fs.mkdirSync(deliveryDir, { recursive: true });

    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Detect content type
    let contentType = 'article';
    if (text.includes('blog')) contentType = 'blog';
    else if (text.includes('documentation') || text.includes('docs') || text.includes('technical')) contentType = 'docs';
    else if (text.includes('seo')) contentType = 'seo';
    else if (text.includes('email') || text.includes('newsletter')) contentType = 'email';
    else if (text.includes('copy') || text.includes('landing page copy') || text.includes('ad copy')) contentType = 'copy';

    fs.writeFileSync(path.join(deliveryDir, '.content-type'), contentType);

    // Create directories
    fs.mkdirSync(path.join(deliveryDir, 'content'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'images'), { recursive: true });
  }

  async runQualityChecks(projectDir, gig, plan) {
    const checks = [];

    // Writing-specific: content files exist
    checks.push({
      name: 'Content files exist',
      run: async (dir) => {
        const contentDir = path.join(dir, 'content');
        const rootFiles = fs.readdirSync(dir).filter(f =>
          /\.(md|txt|html|doc)$/i.test(f)
        );
        let contentFiles = [];
        if (fs.existsSync(contentDir)) {
          contentFiles = fs.readdirSync(contentDir).filter(f =>
            /\.(md|txt|html|doc)$/i.test(f)
          );
        }
        const total = rootFiles.length + contentFiles.length;
        return {
          passed: total > 0,
          message: total > 0 ? `${total} content files found` : 'No content files (.md, .txt, .html) found',
        };
      },
    });

    // Writing-specific: word count check
    checks.push({
      name: 'Sufficient content length',
      run: async (dir) => {
        let totalWords = 0;
        const walkAndCount = (d) => {
          try {
            const entries = fs.readdirSync(d, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && entry.name !== 'node_modules') {
                walkAndCount(path.join(d, entry.name));
              } else if (/\.(md|txt|html)$/i.test(entry.name)) {
                const content = fs.readFileSync(path.join(d, entry.name), 'utf-8');
                // Strip HTML tags and count words
                const plainText = content.replace(/<[^>]*>/g, ' ').replace(/[#*_`\[\]()]/g, ' ');
                totalWords += plainText.split(/\s+/).filter(w => w.length > 0).length;
              }
            }
          } catch {}
        };
        walkAndCount(dir);

        const passed = totalWords >= 200; // minimum reasonable content
        return {
          passed,
          message: passed ? `${totalWords} total words` : `Only ${totalWords} words — may be too short`,
        };
      },
    });

    // Writing-specific: no placeholder text
    checks.push({
      name: 'No placeholder text',
      run: async (dir) => {
        const placeholders = ['lorem ipsum', 'todo:', 'placeholder', '[insert', 'tbd', 'coming soon'];
        let found = [];

        const walkAndCheck = (d) => {
          try {
            const entries = fs.readdirSync(d, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && entry.name !== 'node_modules') {
                walkAndCheck(path.join(d, entry.name));
              } else if (/\.(md|txt|html)$/i.test(entry.name)) {
                const content = fs.readFileSync(path.join(d, entry.name), 'utf-8').toLowerCase();
                for (const ph of placeholders) {
                  if (content.includes(ph)) {
                    found.push(`${entry.name}: "${ph}"`);
                  }
                }
              }
            }
          } catch {}
        };
        walkAndCheck(dir);

        return {
          passed: found.length === 0,
          message: found.length === 0 ? 'No placeholder text found' : `Placeholders found: ${found.join(', ')}`,
        };
      },
    });

    const { runQualityChecks: runChecks } = await import('../quality-runner.js');
    return await runChecks(projectDir, checks);
  }
}
