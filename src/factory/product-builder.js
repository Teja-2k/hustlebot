/**
 * Product Builder — The core engine that builds products using Claude Code
 *
 * Takes a product idea, creates a PRD, spawns Claude Code to build it,
 * runs quality checks, and packages it for deployment.
 *
 * This is the MONEY PRINTER. It turns ideas into sellable products.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { updateProduct, ProductState, ProductTypes } from './product-catalog.js';
import { getConfigDir } from '../utils/config.js';

const PRODUCTS_DIR = () => path.join(getConfigDir(), 'products');

/**
 * Generate a Product Requirements Document (PRD) for Claude Code
 */
function generatePRD(product) {
  const typeInfo = ProductTypes[product.type] || {};

  return `# Product Requirements Document

## Product: ${product.name}
## Type: ${typeInfo.name || product.type}
## Target Audience: ${product.targetAudience || 'General'}
## Price Point: $${product.price}

---

## What To Build

${product.description || product.name}

Niche: ${product.niche}

## Requirements

### Core Requirements
1. This must be a COMPLETE, POLISHED, PRODUCTION-READY product
2. It must look professional — no placeholder text, no "Lorem ipsum"
3. It must solve a real problem for the target audience
4. It must be worth the asking price of $${product.price}

### Technical Requirements
${getTypeRequirements(product.type)}

### Quality Standards
- Clean, modern design (use Tailwind CSS for web projects)
- Mobile responsive (if web-based)
- Fast loading (<3 seconds)
- No bugs, no console errors
- Proper error handling
- SEO optimized (meta tags, Open Graph, sitemap)
- Accessibility basics (alt text, semantic HTML, keyboard nav)

### Sales Page Requirements
Every product MUST include a landing/sales page with:
- Compelling headline that speaks to the pain point
- Clear value proposition (what they get, why it's worth $${product.price})
- Feature list with benefits (not just features)
- Social proof section (even if placeholder initially)
- Clear CTA button linking to payment
- FAQ section (3-5 common questions)
- Mobile responsive design
- Professional typography and spacing

### Delivery
- All files should be in the project directory
- Include a README.md with setup instructions
- Include a package.json (for web projects)
- The product should work immediately when deployed

---

## Context
This product is being built by an autonomous AI Product Factory.
The goal is to create something people will PAY for.
Quality and polish matter more than quantity of features.
Build LESS but make it PERFECT.
`;
}

/**
 * Get type-specific build requirements
 */
function getTypeRequirements(type) {
  const requirements = {
    pdf_guide: `
- Generate a comprehensive, well-structured PDF guide (use HTML → PDF conversion)
- Minimum 20 pages of high-quality, actionable content
- Include a table of contents
- Professional formatting with headings, code blocks, diagrams (ASCII)
- Create a sales page (index.html) for the guide
- Include a "preview" page showing the first 3 pages
`,
    notion_template: `
- Create a Notion-compatible template (exported as .md files with structure)
- Include detailed setup instructions
- Create screenshots/previews of the template
- Build a sales page (index.html) showcasing the template
- Include a demo/preview that shows value before purchase
`,
    website_template: `
- Build with HTML + Tailwind CSS (or Next.js if complex)
- Include multiple page templates (home, about, pricing, blog, contact)
- Dark mode support
- Customizable color scheme
- Create a demo site AND a sales page
- Include all assets (icons, placeholder images via Unsplash URLs)
`,
    web_tool: `
- Build as a standalone web app (Next.js or vanilla HTML/CSS/JS)
- Must be functional — users should get value immediately
- Include user-facing features that justify the price
- Responsive design for mobile/tablet/desktop
- Fast, no unnecessary dependencies
- Include payment integration placeholder (Lemon Squeezy button)
`,
    chrome_extension: `
- Create a complete Chrome extension (manifest.json v3)
- Include popup UI, content scripts, and background service worker as needed
- Professional popup design with branding
- Include extension store assets (icon 128x128, screenshots, description)
- Build a landing page for the extension
`,
    api_service: `
- Build as a serverless API (Vercel Functions or similar)
- Include API documentation page (interactive if possible)
- Rate limiting and authentication
- Example requests and responses
- Client libraries or code examples in 3+ languages
- Pricing page with different tiers
`,
    starter_kit: `
- Complete project boilerplate that developers can clone and build on
- Well-organized directory structure
- Authentication built in (if applicable)
- Payment integration (Stripe/Lemon Squeezy if applicable)
- Documentation (README + inline comments)
- Example pages/components showing common patterns
- Build a landing/sales page separate from the kit itself
`,
    full_app: `
- Complete, deployable web application
- Modern stack (Next.js + Tailwind recommended)
- Database integration (SQLite or Supabase for simplicity)
- User authentication (if applicable)
- Admin dashboard (if applicable)
- Landing page with pricing
- Mobile responsive
`,
    prompt_library: `
- Create a well-organized collection of prompts
- Group by category/use case
- Include expected output examples for each prompt
- Build as a searchable web page (HTML + JS)
- Include copy-to-clipboard for each prompt
- Sales page with preview of 10-15 prompts, full library behind paywall
`,
    ai_tool: `
- Build a web app that leverages AI APIs
- Must provide clear, immediate value to users
- Include a free tier/demo mode so users can try before buying
- Clean UI that makes the AI capabilities accessible
- Handle errors gracefully (API failures, rate limits)
- Landing page with live demo if possible
`,
  };

  return requirements[type] || `
- Build a complete, polished product
- Include a landing/sales page
- Make it production-ready
`;
}

/**
 * Build a product using Claude Code (headless mode)
 */
export async function buildProduct(product) {
  const productDir = path.join(PRODUCTS_DIR(), product.id);

  // Create product directory
  if (!fs.existsSync(productDir)) {
    fs.mkdirSync(productDir, { recursive: true });
  }

  // Generate PRD
  const prd = generatePRD(product);
  const prdPath = path.join(productDir, 'PRD.md');
  fs.writeFileSync(prdPath, prd);

  // Update state
  updateProduct(product.id, { state: ProductState.BUILDING, buildDir: productDir, prd });

  console.log(`\n  🏭 Building: ${product.name}`);
  console.log(`  📁 Directory: ${productDir}`);
  console.log(`  📋 PRD saved to: ${prdPath}\n`);

  // Build the master prompt for Claude Code
  const masterPrompt = `You are building a commercial digital product that will be SOLD for real money.

Read the PRD at ${prdPath} and build the COMPLETE product in the directory ${productDir}.

CRITICAL RULES:
1. Build EVERYTHING in ${productDir} — do not create files outside this directory
2. This product will be sold for $${product.price} — it must be worth that price
3. Make it BEAUTIFUL — first impressions matter for sales
4. Make it FUNCTIONAL — it must actually work, not just look good
5. Include a landing/sales page (index.html) with a "Buy Now" button
6. Use Tailwind CSS via CDN for styling (no build step needed for quick deploy)
7. No placeholder content — everything should be real, useful content
8. Test your work — make sure everything renders correctly

START BUILDING NOW. Read the PRD, then create every file needed.`;

  // Spawn Claude Code in headless mode
  const timeout = getTimeout(product.type);
  console.log(`  ⏱ Timeout: ${timeout / 60000} minutes`);

  return new Promise((resolve) => {
    const args = [
      '-p', masterPrompt,
      '--allowedTools', 'Read,Write,Edit,Bash(npm install:*),Bash(npx:*),Bash(node:*),Bash(mkdir:*),Bash(ls:*),Bash(cat:*),Glob,Grep',
      '--output-format', 'text',
    ];

    const proc = spawn('claude', args, {
      cwd: productDir,
      shell: true,
      timeout,
      env: { ...process.env },
    });

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Show progress dots
      if (text.includes('Write') || text.includes('Edit') || text.includes('Created')) {
        process.stdout.write('.');
      }
    });

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      console.log('\n');

      if (code === 0 || output.length > 100) {
        // Check what was built
        const files = listFiles(productDir);
        const hasIndex = files.some(f => f.endsWith('index.html'));
        const hasPackageJson = files.some(f => f.endsWith('package.json'));

        console.log(`  ✅ Build complete: ${files.length} files created`);
        if (hasIndex) console.log('  🌐 Landing page: index.html found');
        if (hasPackageJson) console.log('  📦 Package: package.json found');

        updateProduct(product.id, {
          state: ProductState.TESTING,
        });

        resolve({
          success: true,
          files,
          hasIndex,
          hasPackageJson,
          output: output.slice(-2000),
        });
      } else {
        console.log(`  ❌ Build failed (exit code: ${code})`);
        if (errorOutput) console.log(`  Error: ${errorOutput.slice(0, 500)}`);

        updateProduct(product.id, { state: ProductState.PLANNED });

        resolve({
          success: false,
          error: errorOutput || `Process exited with code ${code}`,
          output: output.slice(-2000),
        });
      }
    });

    proc.on('error', (err) => {
      console.log(`  ❌ Failed to spawn Claude Code: ${err.message}`);
      updateProduct(product.id, { state: ProductState.PLANNED });
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Run quality checks on a built product
 */
export async function runProductQuality(product) {
  const productDir = product.buildDir;
  if (!productDir || !fs.existsSync(productDir)) {
    return { passed: false, reason: 'Build directory not found' };
  }

  const checks = [];
  const files = listFiles(productDir);

  // Check 1: Files exist
  checks.push({
    name: 'Has files',
    passed: files.length > 2,
    detail: `${files.length} files found`,
  });

  // Check 2: Has landing page
  const hasLanding = files.some(f => f.endsWith('index.html') || f.endsWith('page.tsx') || f.endsWith('page.jsx'));
  checks.push({
    name: 'Has landing page',
    passed: hasLanding,
    detail: hasLanding ? 'Landing page found' : 'No index.html or page file found',
  });

  // Check 3: No empty files
  const emptyFiles = files.filter(f => {
    try {
      return fs.statSync(path.join(productDir, f)).size === 0;
    } catch { return false; }
  });
  checks.push({
    name: 'No empty files',
    passed: emptyFiles.length === 0,
    detail: emptyFiles.length === 0 ? 'All files have content' : `${emptyFiles.length} empty files`,
  });

  // Check 4: No secrets in code
  const secretPatterns = [/sk-[a-zA-Z0-9]{20,}/, /AKIA[A-Z0-9]{16}/, /password\s*=\s*["'][^"']+["']/];
  let hasSecrets = false;
  for (const f of files.filter(f => /\.(js|ts|html|json|env)$/.test(f))) {
    try {
      const content = fs.readFileSync(path.join(productDir, f), 'utf-8');
      if (secretPatterns.some(p => p.test(content))) {
        hasSecrets = true;
        break;
      }
    } catch { /* skip */ }
  }
  checks.push({
    name: 'No hardcoded secrets',
    passed: !hasSecrets,
    detail: hasSecrets ? 'Found potential secrets in code!' : 'Clean',
  });

  // Check 5: README exists
  const hasReadme = files.some(f => /readme\.md/i.test(f));
  checks.push({
    name: 'Has README',
    passed: hasReadme,
    detail: hasReadme ? 'README.md found' : 'No README',
  });

  // Check 6: Reasonable file sizes
  const oversized = files.filter(f => {
    try {
      return fs.statSync(path.join(productDir, f)).size > 5 * 1024 * 1024; // 5MB
    } catch { return false; }
  });
  checks.push({
    name: 'File sizes reasonable',
    passed: oversized.length === 0,
    detail: oversized.length === 0 ? 'All files under 5MB' : `${oversized.length} oversized files`,
  });

  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const allPassed = passed === total;

  if (allPassed) {
    updateProduct(product.id, { state: ProductState.READY });
  }

  return {
    passed: allPassed,
    score: Math.round((passed / total) * 100),
    checks,
    summary: `${passed}/${total} checks passed`,
  };
}

/**
 * Get build timeout based on product type
 */
function getTimeout(type) {
  const timeouts = {
    pdf_guide: 20 * 60 * 1000,       // 20 min
    notion_template: 15 * 60 * 1000,  // 15 min
    website_template: 30 * 60 * 1000,  // 30 min
    web_tool: 45 * 60 * 1000,          // 45 min
    chrome_extension: 30 * 60 * 1000,  // 30 min
    api_service: 30 * 60 * 1000,       // 30 min
    starter_kit: 60 * 60 * 1000,       // 1 hour
    full_app: 90 * 60 * 1000,          // 1.5 hours
    prompt_library: 20 * 60 * 1000,    // 20 min
    ai_tool: 60 * 60 * 1000,           // 1 hour
  };
  return timeouts[type] || 30 * 60 * 1000;
}

/**
 * List all files in a directory recursively
 */
function listFiles(dir, prefix = '') {
  const results = [];
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (['node_modules', '.git', '.next', 'PRD.md'].includes(entry)) continue;
      const fullPath = path.join(dir, entry);
      const relativePath = prefix ? `${prefix}/${entry}` : entry;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...listFiles(fullPath, relativePath));
        } else {
          results.push(relativePath);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return results;
}
