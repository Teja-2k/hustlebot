import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from '../utils/config.js';
import { log, warn } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DELIVERY_DIR = path.join(os.homedir(), '.hustlebot', 'deliveries');

/**
 * Auto-delivery engine — generates complete project deliverables using AI.
 * Takes a gig description and produces code, docs, or whatever the client needs.
 */

/**
 * Generate a complete project delivery based on the gig requirements.
 * Returns structured deliverables ready for client submission.
 */
export async function generateDelivery(gig, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API key required for auto-delivery');

  const client = new Anthropic({ apiKey });

  log(`[DELIVERY] Generating deliverables for: ${gig.title}`);

  // Step 1: Analyze the gig and create a work plan
  const planResponse = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a senior freelance developer planning a project delivery.

Analyze this gig and create a detailed work plan:

Title: ${gig.title}
Description: ${gig.description}
Skills required: ${(gig.skills || []).join(', ')}
Budget: ${gig.budget || 'Not specified'}
${gig.client_requirements ? `Client requirements: ${gig.client_requirements}` : ''}

Return a JSON object with:
{
  "project_type": "web_app|script|api|bot|data|automation|documentation|other",
  "files_to_create": [{"path": "relative/path.ext", "purpose": "what this file does"}],
  "tech_stack": ["list", "of", "technologies"],
  "estimated_hours": number,
  "delivery_notes": "what to tell the client about the delivery",
  "folder_structure": "ASCII tree of the project"
}

Be realistic and match the budget scope. For small budgets ($100-500), keep it simple. For larger budgets, be thorough.
Return ONLY the JSON, no markdown fences.`
    }]
  });

  let plan;
  try {
    const planText = planResponse.content[0].text.trim();
    plan = JSON.parse(planText.replace(/^```json?\n?/, '').replace(/\n?```$/, ''));
  } catch {
    warn('[DELIVERY] Failed to parse work plan, using defaults');
    plan = {
      project_type: 'script',
      files_to_create: [
        { path: 'main.py', purpose: 'Main application logic' },
        { path: 'README.md', purpose: 'Project documentation' },
        { path: 'requirements.txt', purpose: 'Dependencies' },
      ],
      tech_stack: ['Python'],
      estimated_hours: 5,
      delivery_notes: 'Complete implementation as described.',
      folder_structure: '.'
    };
  }

  log(`[DELIVERY] Plan: ${plan.files_to_create.length} files, ${plan.tech_stack.join(', ')}`);

  // Step 2: Generate each file
  const deliverables = [];
  const deliveryId = `delivery-${Date.now()}`;
  const deliveryPath = path.join(DELIVERY_DIR, deliveryId);

  if (!fs.existsSync(deliveryPath)) {
    fs.mkdirSync(deliveryPath, { recursive: true });
  }

  for (const file of plan.files_to_create.slice(0, 15)) { // Cap at 15 files
    try {
      const fileResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are a senior developer creating a deliverable file for a freelance project.

Project: ${gig.title}
Description: ${gig.description}
Tech stack: ${plan.tech_stack.join(', ')}

Generate the complete contents of this file:
File: ${file.path}
Purpose: ${file.purpose}

Other files in the project:
${plan.files_to_create.map(f => `- ${f.path}: ${f.purpose}`).join('\n')}

Rules:
- Write production-quality code with proper error handling
- Include helpful comments
- Follow best practices for the language/framework
- Make it actually functional, not placeholder code
- If it's a README, include setup instructions and usage examples

Return ONLY the file contents. No markdown fences, no explanations.`
        }]
      });

      let content = fileResponse.content[0].text;
      // Strip markdown fences if AI added them despite instructions
      content = content.replace(/^```[\w]*\n/, '').replace(/\n```\s*$/, '');

      // Save the file
      const filePath = path.join(deliveryPath, file.path);
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      fs.writeFileSync(filePath, content);

      deliverables.push({
        path: file.path,
        purpose: file.purpose,
        size: content.length,
        lines: content.split('\n').length,
      });

      log(`[DELIVERY] Generated: ${file.path} (${content.split('\n').length} lines)`);

      // Rate limit
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      warn(`[DELIVERY] Failed to generate ${file.path}: ${err.message}`);
    }
  }

  // Step 3: Create a delivery package summary
  const summary = {
    delivery_id: deliveryId,
    gig_title: gig.title,
    gig_id: gig.id,
    plan,
    deliverables,
    delivery_path: deliveryPath,
    created_at: new Date().toISOString(),
    status: 'ready_for_review',
    delivery_notes: plan.delivery_notes,
  };

  // Save delivery manifest
  fs.writeFileSync(
    path.join(deliveryPath, '_delivery_manifest.json'),
    JSON.stringify(summary, null, 2)
  );

  // Save to global deliveries index
  const indexPath = path.join(DELIVERY_DIR, 'deliveries-index.json');
  let index = [];
  try {
    if (fs.existsSync(indexPath)) {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
  } catch {}
  index.push({
    delivery_id: deliveryId,
    gig_id: gig.id,
    gig_title: gig.title,
    files_count: deliverables.length,
    status: 'ready_for_review',
    created_at: summary.created_at,
  });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  log(`[DELIVERY] Complete! ${deliverables.length} files at ${deliveryPath}`);

  return summary;
}

/**
 * Create a ZIP archive of the delivery for client submission.
 */
export async function packageDelivery(deliveryId) {
  const deliveryPath = path.join(DELIVERY_DIR, deliveryId);
  if (!fs.existsSync(deliveryPath)) {
    throw new Error(`Delivery not found: ${deliveryId}`);
  }

  // Use native zip if available, otherwise create a tar
  const { execSync } = await import('child_process');
  const zipPath = path.join(DELIVERY_DIR, `${deliveryId}.zip`);

  try {
    if (process.platform === 'win32') {
      execSync(`powershell.exe -command "Compress-Archive -Path '${deliveryPath}\\*' -DestinationPath '${zipPath}' -Force"`, { timeout: 30000 });
    } else {
      execSync(`cd "${deliveryPath}" && zip -r "${zipPath}" . -x "_delivery_manifest.json"`, { timeout: 30000 });
    }
    log(`[DELIVERY] Packaged: ${zipPath}`);
    return zipPath;
  } catch (err) {
    warn(`[DELIVERY] Packaging failed: ${err.message}`);
    return deliveryPath; // Return folder path as fallback
  }
}

/**
 * List all deliveries with their status.
 */
export function listDeliveries() {
  const indexPath = path.join(DELIVERY_DIR, 'deliveries-index.json');
  try {
    if (fs.existsSync(indexPath)) {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
  } catch {}
  return [];
}

/**
 * Get a specific delivery by ID.
 */
export function getDelivery(deliveryId) {
  const manifestPath = path.join(DELIVERY_DIR, deliveryId, '_delivery_manifest.json');
  try {
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
  } catch {}
  return null;
}

/**
 * Update delivery status.
 */
export function updateDeliveryStatus(deliveryId, status) {
  // Update manifest
  const manifestPath = path.join(DELIVERY_DIR, deliveryId, '_delivery_manifest.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.status = status;
    manifest.updated_at = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch {}

  // Update index
  const indexPath = path.join(DELIVERY_DIR, 'deliveries-index.json');
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const entry = index.find(e => e.delivery_id === deliveryId);
    if (entry) {
      entry.status = status;
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    }
  } catch {}
}
