/**
 * Product Catalog — Manages all products HustleBot creates
 * Tracks: ideas → building → deployed → selling → revenue
 */

import fs from 'fs';
import path from 'path';
import { getConfigDir } from '../utils/config.js';

const CATALOG_FILE = () => path.join(getConfigDir(), 'product-catalog.json');

// Product lifecycle states
export const ProductState = {
  IDEA: 'idea',           // Market research identified opportunity
  PLANNED: 'planned',     // PRD created, ready to build
  BUILDING: 'building',   // Claude Code is constructing it
  TESTING: 'testing',     // Quality checks running
  READY: 'ready',         // Built, tested, ready to deploy
  DEPLOYING: 'deploying', // Being pushed to Vercel/marketplace
  LIVE: 'live',           // Deployed and accepting payments
  PAUSED: 'paused',       // Temporarily pulled
  KILLED: 'killed',       // Underperformer, discontinued
};

// Product types and their characteristics
export const ProductTypes = {
  pdf_guide: {
    name: 'PDF Guide/Playbook',
    tier: 1,
    buildTime: '15-30 min',
    priceRange: [9, 49],
    defaultPrice: 19,
    platform: 'lemonsqueezy',
    description: 'Downloadable PDF guides on trending topics',
  },
  notion_template: {
    name: 'Notion Template',
    tier: 1,
    buildTime: '10-20 min',
    priceRange: [5, 29],
    defaultPrice: 12,
    platform: 'lemonsqueezy',
    description: 'Pre-built Notion workspace templates',
  },
  website_template: {
    name: 'Website Template',
    tier: 2,
    buildTime: '30-60 min',
    priceRange: [29, 99],
    defaultPrice: 49,
    platform: 'vercel',
    description: 'Ready-to-deploy website templates',
  },
  web_tool: {
    name: 'Web Tool / Micro-SaaS',
    tier: 2,
    buildTime: '1-3 hours',
    priceRange: [0, 99],
    defaultPrice: 29,
    recurring: true,
    platform: 'vercel',
    description: 'Simple web tools with subscription model',
  },
  chrome_extension: {
    name: 'Chrome Extension',
    tier: 2,
    buildTime: '1-2 hours',
    priceRange: [0, 49],
    defaultPrice: 9,
    recurring: true,
    platform: 'chrome_store',
    description: 'Browser extensions solving specific problems',
  },
  api_service: {
    name: 'API Service',
    tier: 2,
    buildTime: '1-2 hours',
    priceRange: [9, 199],
    defaultPrice: 29,
    recurring: true,
    platform: 'vercel',
    description: 'Hosted API endpoints for developers',
  },
  starter_kit: {
    name: 'Starter Kit / Boilerplate',
    tier: 3,
    buildTime: '2-4 hours',
    priceRange: [49, 299],
    defaultPrice: 99,
    platform: 'lemonsqueezy',
    description: 'Complete project starters for developers',
  },
  full_app: {
    name: 'Full Web Application',
    tier: 3,
    buildTime: '4-8 hours',
    priceRange: [99, 499],
    defaultPrice: 199,
    platform: 'vercel',
    description: 'Complete deployed web applications',
  },
  prompt_library: {
    name: 'AI Prompt Library',
    tier: 1,
    buildTime: '20-40 min',
    priceRange: [9, 39],
    defaultPrice: 19,
    platform: 'lemonsqueezy',
    description: 'Curated prompt collections for specific use cases',
  },
  ai_tool: {
    name: 'AI-Powered Tool',
    tier: 3,
    buildTime: '2-6 hours',
    priceRange: [19, 199],
    defaultPrice: 49,
    recurring: true,
    platform: 'vercel',
    description: 'Tools powered by AI APIs (summarizers, generators, analyzers)',
  },
};

/**
 * Load the product catalog
 */
export function loadCatalog() {
  const file = CATALOG_FILE();
  if (!fs.existsSync(file)) {
    return { products: [], stats: { totalRevenue: 0, totalProducts: 0, liveProducts: 0 } };
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * Save the product catalog
 */
export function saveCatalog(catalog) {
  const file = CATALOG_FILE();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2));
}

/**
 * Add a new product idea to the catalog
 */
export function addProduct(product) {
  const catalog = loadCatalog();
  const id = `product-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const entry = {
    id,
    name: product.name,
    type: product.type,
    description: product.description,
    state: ProductState.IDEA,
    price: product.price || ProductTypes[product.type]?.defaultPrice || 29,
    recurring: product.recurring || ProductTypes[product.type]?.recurring || false,
    niche: product.niche || '',
    targetAudience: product.targetAudience || '',
    demandScore: product.demandScore || 0,
    competitorCount: product.competitorCount || 0,

    // Build tracking
    buildDir: null,
    deployUrl: null,
    paymentUrl: null,
    repoUrl: null,

    // Revenue tracking
    totalSales: 0,
    totalRevenue: 0,
    subscribers: 0,

    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deployedAt: null,
    lastSaleAt: null,

    // Marketing
    twitterPosts: [],
    redditPosts: [],
    productHuntUrl: null,

    // Metadata
    tags: product.tags || [],
    prd: null,  // Product Requirements Document
  };

  catalog.products.push(entry);
  catalog.stats.totalProducts++;
  saveCatalog(catalog);
  return entry;
}

/**
 * Update a product's state and data
 */
export function updateProduct(productId, updates) {
  const catalog = loadCatalog();
  const idx = catalog.products.findIndex(p => p.id === productId);
  if (idx === -1) throw new Error(`Product not found: ${productId}`);

  catalog.products[idx] = {
    ...catalog.products[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Update live product count
  catalog.stats.liveProducts = catalog.products.filter(p => p.state === ProductState.LIVE).length;
  catalog.stats.totalRevenue = catalog.products.reduce((sum, p) => sum + (p.totalRevenue || 0), 0);

  saveCatalog(catalog);
  return catalog.products[idx];
}

/**
 * Record a sale for a product
 */
export function recordSale(productId, amount) {
  const catalog = loadCatalog();
  const idx = catalog.products.findIndex(p => p.id === productId);
  if (idx === -1) return;

  catalog.products[idx].totalSales++;
  catalog.products[idx].totalRevenue += amount;
  catalog.products[idx].lastSaleAt = new Date().toISOString();
  catalog.stats.totalRevenue += amount;

  saveCatalog(catalog);
  return catalog.products[idx];
}

/**
 * Get products by state
 */
export function getProductsByState(state) {
  return loadCatalog().products.filter(p => p.state === state);
}

/**
 * Get top performing products (by revenue)
 */
export function getTopProducts(limit = 5) {
  return loadCatalog().products
    .filter(p => p.state === ProductState.LIVE)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

/**
 * Get products that need attention (no sales in 7 days)
 */
export function getStalledProducts() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return loadCatalog().products.filter(p =>
    p.state === ProductState.LIVE &&
    p.deployedAt &&
    (!p.lastSaleAt || p.lastSaleAt < weekAgo)
  );
}

/**
 * Get catalog summary for dashboard
 */
export function getCatalogSummary() {
  const catalog = loadCatalog();
  const products = catalog.products;

  return {
    total: products.length,
    byState: {
      ideas: products.filter(p => p.state === ProductState.IDEA).length,
      building: products.filter(p => p.state === ProductState.BUILDING).length,
      live: products.filter(p => p.state === ProductState.LIVE).length,
      paused: products.filter(p => p.state === ProductState.PAUSED).length,
      killed: products.filter(p => p.state === ProductState.KILLED).length,
    },
    byTier: {
      tier1: products.filter(p => ProductTypes[p.type]?.tier === 1).length,
      tier2: products.filter(p => ProductTypes[p.type]?.tier === 2).length,
      tier3: products.filter(p => ProductTypes[p.type]?.tier === 3).length,
    },
    revenue: {
      total: catalog.stats.totalRevenue,
      today: products.reduce((sum, p) => {
        const today = new Date().toISOString().slice(0, 10);
        return sum + (p.lastSaleAt?.startsWith(today) ? p.totalRevenue : 0);
      }, 0),
      topProduct: products.sort((a, b) => b.totalRevenue - a.totalRevenue)[0]?.name || 'None',
    },
  };
}
