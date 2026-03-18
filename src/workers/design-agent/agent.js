import { BaseAgent } from '../base-agent.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkFileTypes } from '../quality-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * DesignAgent — Generates thumbnails, banners, logos, social media graphics.
 * Uses AI image generation APIs (DALL-E, Flux) + HTML/CSS for layout-based designs.
 */
export default class DesignAgent extends BaseAgent {
  constructor() {
    super({
      name: 'DesignAgent',
      type: 'design',
      emoji: '🎨',
      description: 'Thumbnails, banners, logos, social media graphics, UI mockups',
      supportedGigTypes: ['thumbnail', 'banner', 'logo', 'graphic design', 'social media', 'image', 'icon'],
      allowedTools: [
        'Edit', 'Write', 'Read', 'Glob', 'Grep',
        'Bash(npm*)', 'Bash(npx*)', 'Bash(node*)',
        'Bash(python*)', 'Bash(pip*)',
        'Bash(git*)', 'Bash(mkdir*)', 'Bash(ls*)',
        'Bash(cat*)', 'Bash(echo*)', 'Bash(cp*)',
        'Bash(curl*)',
      ],
      timeout: 15 * 60 * 1000,
      agentDir: __dirname,
    });
  }

  async scaffoldProject(deliveryDir, gig, plan) {
    fs.mkdirSync(deliveryDir, { recursive: true });

    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Detect design type
    let designType = 'graphic';
    if (text.includes('thumbnail')) designType = 'thumbnail';
    else if (text.includes('banner')) designType = 'banner';
    else if (text.includes('logo')) designType = 'logo';
    else if (text.includes('social media') || text.includes('instagram') || text.includes('twitter post')) designType = 'social';
    else if (text.includes('icon')) designType = 'icon';
    else if (text.includes('ui') || text.includes('mockup') || text.includes('wireframe')) designType = 'ui';

    fs.writeFileSync(path.join(deliveryDir, '.design-type'), designType);

    // Standard dimensions for common design types
    const dimensions = {
      thumbnail: { width: 1280, height: 720, desc: 'YouTube Thumbnail' },
      banner: { width: 1920, height: 1080, desc: 'Web Banner' },
      logo: { width: 1024, height: 1024, desc: 'Logo (square)' },
      social: { width: 1080, height: 1080, desc: 'Social Media Post' },
      icon: { width: 512, height: 512, desc: 'Icon' },
      ui: { width: 1440, height: 900, desc: 'UI Mockup' },
      graphic: { width: 1920, height: 1080, desc: 'General Graphic' },
    };

    const dim = dimensions[designType] || dimensions.graphic;
    fs.writeFileSync(path.join(deliveryDir, '.dimensions'),
      JSON.stringify(dim, null, 2));

    // Create output directories
    fs.mkdirSync(path.join(deliveryDir, 'output'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'src'), { recursive: true });

    // Scaffold as Node project — uses canvas/sharp for image manipulation
    // or HTML/CSS + Puppeteer for rendering
    const packageJson = {
      name: plan?.project_name || 'design-project',
      version: '1.0.0',
      type: 'module',
      main: 'src/generate.js',
      scripts: {
        generate: 'node src/generate.js',
        start: 'node src/generate.js',
      },
      dependencies: {
        'dotenv': '^16.3.1',
      },
    };

    // Add deps based on approach
    if (text.includes('svg') || text.includes('vector')) {
      // SVG-based approach (no heavy deps needed)
    } else {
      // HTML-to-image approach (most versatile)
      packageJson.dependencies['puppeteer'] = '^21.6.0';
    }

    fs.writeFileSync(path.join(deliveryDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    fs.writeFileSync(path.join(deliveryDir, '.env.example'),
      `# Design Configuration\n# OPENAI_API_KEY=sk-... (for DALL-E image generation, optional)\n# BRAND_COLOR=#FF6B00\n# BRAND_FONT=Inter\n`);
  }

  async runQualityChecks(projectDir, gig, plan) {
    const checks = [
      checkFileTypes(['.js', '.html', '.css', '.svg']),
    ];

    // Design-specific: output files exist
    checks.push({
      name: 'Design output exists',
      run: async (dir) => {
        const outputDir = path.join(dir, 'output');
        if (!fs.existsSync(outputDir)) return { passed: false, message: 'No output directory' };

        const files = fs.readdirSync(outputDir);
        const imageFiles = files.filter(f =>
          /\.(png|jpg|jpeg|svg|webp|gif|pdf)$/i.test(f)
        );
        const htmlFiles = files.filter(f => f.endsWith('.html'));

        const hasOutput = imageFiles.length > 0 || htmlFiles.length > 0;
        return {
          passed: hasOutput,
          message: hasOutput
            ? `${imageFiles.length} images, ${htmlFiles.length} HTML files in output/`
            : 'No design output files found in output/',
        };
      },
    });

    // Design-specific: generation script exists
    checks.push({
      name: 'Generation script exists',
      run: async (dir) => {
        const hasScript = fs.existsSync(path.join(dir, 'src', 'generate.js')) ||
                         fs.existsSync(path.join(dir, 'generate.py')) ||
                         fs.existsSync(path.join(dir, 'src', 'index.js'));
        return {
          passed: hasScript,
          message: hasScript ? 'Generation script found' : 'Missing generation script',
        };
      },
    });

    const { runQualityChecks: runChecks } = await import('../quality-runner.js');
    return await runChecks(projectDir, checks);
  }
}
