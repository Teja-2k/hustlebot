/**
 * Deployer — Auto-deploys products to Vercel, GitHub, and marketplaces
 *
 * Takes a built product and pushes it live so people can buy it.
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { updateProduct, ProductState } from './product-catalog.js';
import { getConfigDir } from '../utils/config.js';

const DEPLOY_CONFIG_FILE = () => path.join(getConfigDir(), 'deploy-config.json');

/**
 * Load deployment configuration (Vercel token, GitHub token, etc.)
 */
export function loadDeployConfig() {
  const file = DEPLOY_CONFIG_FILE();
  if (!fs.existsSync(file)) {
    return {
      vercel: { token: null, teamId: null },
      github: { token: null, org: null },
      lemonsqueezy: { apiKey: null, storeId: null },
      domain: null,
    };
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * Save deployment configuration
 */
export function saveDeployConfig(config) {
  const file = DEPLOY_CONFIG_FILE();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

/**
 * Deploy a product to Vercel
 */
export async function deployToVercel(product) {
  const config = loadDeployConfig();
  const productDir = product.buildDir;

  if (!productDir || !fs.existsSync(productDir)) {
    return { success: false, error: 'Build directory not found' };
  }

  console.log(`  🚀 Deploying ${product.name} to Vercel...`);

  updateProduct(product.id, { state: ProductState.DEPLOYING });

  try {
    // Check if Vercel CLI is installed
    try {
      execSync('vercel --version', { stdio: 'pipe' });
    } catch {
      console.log('  📦 Installing Vercel CLI...');
      execSync('npm install -g vercel', { stdio: 'pipe' });
    }

    // Create vercel.json if not exists
    const vercelConfig = path.join(productDir, 'vercel.json');
    if (!fs.existsSync(vercelConfig)) {
      // Check if it's a Next.js project
      const packageJson = path.join(productDir, 'package.json');
      const isNextJs = fs.existsSync(packageJson) &&
        fs.readFileSync(packageJson, 'utf-8').includes('next');

      if (!isNextJs) {
        // Static site config
        fs.writeFileSync(vercelConfig, JSON.stringify({
          version: 2,
          builds: [{ src: './**', use: '@vercel/static' }],
          routes: [
            { src: '/(.*)', dest: '/$1' },
          ],
        }, null, 2));
      }
    }

    // Deploy using Vercel CLI
    const args = ['--yes', '--prod'];
    if (config.vercel?.token) {
      args.push('--token', config.vercel.token);
    }

    const result = await runCommand('vercel', args, { cwd: productDir });

    if (result.success) {
      // Extract URL from output
      const urlMatch = result.output.match(/https:\/\/[^\s]+\.vercel\.app/);
      const deployUrl = urlMatch ? urlMatch[0] : null;

      console.log(`  ✅ Deployed: ${deployUrl || 'URL not captured'}`);

      updateProduct(product.id, {
        state: ProductState.LIVE,
        deployUrl,
        deployedAt: new Date().toISOString(),
      });

      return { success: true, url: deployUrl };
    } else {
      console.log(`  ❌ Deploy failed: ${result.error.slice(0, 200)}`);
      updateProduct(product.id, { state: ProductState.READY });
      return { success: false, error: result.error };
    }
  } catch (err) {
    console.log(`  ❌ Deploy error: ${err.message}`);
    updateProduct(product.id, { state: ProductState.READY });
    return { success: false, error: err.message };
  }
}

/**
 * Push product code to GitHub
 */
export async function pushToGitHub(product) {
  const config = loadDeployConfig();
  const productDir = product.buildDir;

  if (!productDir || !fs.existsSync(productDir)) {
    return { success: false, error: 'Build directory not found' };
  }

  console.log(`  📤 Pushing ${product.name} to GitHub...`);

  try {
    // Check if gh CLI is available
    try {
      execSync('gh --version', { stdio: 'pipe' });
    } catch {
      return { success: false, error: 'GitHub CLI (gh) not installed. Run: winget install GitHub.cli' };
    }

    // Generate a clean repo name from product name
    const repoName = product.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    // Initialize git repo if needed
    if (!fs.existsSync(path.join(productDir, '.git'))) {
      execSync('git init', { cwd: productDir, stdio: 'pipe' });
      execSync('git add -A', { cwd: productDir, stdio: 'pipe' });
      execSync('git commit -m "Initial product build"', { cwd: productDir, stdio: 'pipe' });
    }

    // Create GitHub repo
    const result = await runCommand('gh', [
      'repo', 'create', repoName,
      '--public',
      '--source', productDir,
      '--push',
      '--description', product.description || product.name,
    ], { cwd: productDir });

    if (result.success) {
      const repoUrl = `https://github.com/${config.github?.org || 'hustlebot'}/${repoName}`;
      console.log(`  ✅ Pushed to: ${repoUrl}`);

      updateProduct(product.id, { repoUrl });
      return { success: true, url: repoUrl };
    }

    return { success: false, error: result.error };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Create a Lemon Squeezy product listing
 */
export async function createLemonSqueezyProduct(product) {
  const config = loadDeployConfig();

  if (!config.lemonsqueezy?.apiKey) {
    console.log('  ⚠ Lemon Squeezy API key not configured');
    return { success: false, error: 'Lemon Squeezy API key not configured. Run: hustlebot factory config' };
  }

  console.log(`  🍋 Creating Lemon Squeezy listing for ${product.name}...`);

  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch('https://api.lemonsqueezy.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.lemonsqueezy.apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'products',
          attributes: {
            name: product.name,
            description: product.description || `${product.name} — Built by AI, loved by humans.`,
            price: product.price * 100, // cents
            status: 'published',
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: config.lemonsqueezy.storeId,
              },
            },
          },
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const paymentUrl = data.data?.attributes?.buy_now_url;
      console.log(`  ✅ Lemon Squeezy product created: ${paymentUrl}`);

      updateProduct(product.id, { paymentUrl });
      return { success: true, url: paymentUrl };
    } else {
      const error = await response.text();
      return { success: false, error: `API error: ${error.slice(0, 200)}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Full deployment pipeline: GitHub → Vercel → Payment
 */
export async function fullDeploy(product) {
  const results = {};

  // Step 1: Push to GitHub
  results.github = await pushToGitHub(product);
  if (results.github.success) {
    console.log(`  ✓ GitHub: ${results.github.url}`);
  }

  // Step 2: Deploy to Vercel
  results.vercel = await deployToVercel(product);
  if (results.vercel.success) {
    console.log(`  ✓ Vercel: ${results.vercel.url}`);
  }

  // Step 3: Create payment link
  results.payment = await createLemonSqueezyProduct(product);
  if (results.payment.success) {
    console.log(`  ✓ Payment: ${results.payment.url}`);
  }

  const allSuccess = results.vercel?.success && results.payment?.success;

  return {
    success: allSuccess,
    results,
    summary: allSuccess
      ? `🎉 Product LIVE at ${results.vercel.url} — Buy: ${results.payment.url}`
      : `Partial deploy: ${Object.entries(results).map(([k, v]) => `${k}: ${v.success ? '✓' : '✗'}`).join(', ')}`,
  };
}

/**
 * Run a shell command and capture output
 */
function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      shell: true,
      timeout: 120000,
      ...options,
    });

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (d) => { output += d.toString(); });
    proc.stderr?.on('data', (d) => { errorOutput += d.toString(); });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output,
        error: errorOutput,
      });
    });

    proc.on('error', (err) => {
      resolve({ success: false, output: '', error: err.message });
    });
  });
}
