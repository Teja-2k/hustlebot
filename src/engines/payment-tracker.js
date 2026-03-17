import fs from 'fs';
import path from 'path';
import os from 'os';
import { log, warn } from '../utils/logger.js';

const HUSTLEBOT_DIR = path.join(os.homedir(), '.hustlebot');
const PAYMENTS_FILE = path.join(HUSTLEBOT_DIR, 'payments.json');
const PROJECTS_FILE = path.join(HUSTLEBOT_DIR, 'projects.json');

/**
 * Payment & earnings tracking system for HustleBot.
 * Tracks: proposals sent → accepted → in_progress → delivered → paid
 * Calculates earnings, conversion rates, and ROI.
 */

function loadPayments() {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function savePayments(payments) {
  if (!fs.existsSync(HUSTLEBOT_DIR)) fs.mkdirSync(HUSTLEBOT_DIR, { recursive: true });
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2));
}

function loadProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function saveProjects(projects) {
  if (!fs.existsSync(HUSTLEBOT_DIR)) fs.mkdirSync(HUSTLEBOT_DIR, { recursive: true });
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// ─── PROJECT TRACKING ───

/**
 * Track a new project (when a proposal is accepted / gig won).
 */
export function trackProject(data) {
  const projects = loadProjects();

  const project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    gig_id: data.gig_id,
    gig_title: data.title,
    platform: data.platform,
    client: data.client || 'Unknown',
    status: 'accepted', // accepted → in_progress → delivered → completed → paid
    agreed_amount: data.amount || 0,
    currency: data.currency || 'USD',
    hourly_rate: data.hourly_rate || null,
    estimated_hours: data.estimated_hours || null,
    proposal_id: data.proposal_id || null,
    delivery_id: null,
    accepted_at: new Date().toISOString(),
    started_at: null,
    delivered_at: null,
    completed_at: null,
    paid_at: null,
    notes: data.notes || '',
    milestones: [],
    time_logged: [], // { date, hours, description }
  };

  projects.push(project);
  saveProjects(projects);
  log(`[TRACKER] New project tracked: ${project.gig_title} ($${project.agreed_amount})`);
  return project;
}

/**
 * Update a project's status.
 */
export function updateProject(projectId, updates) {
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  Object.assign(project, updates);

  // Auto-set timestamps based on status changes
  if (updates.status === 'in_progress' && !project.started_at) {
    project.started_at = new Date().toISOString();
  }
  if (updates.status === 'delivered' && !project.delivered_at) {
    project.delivered_at = new Date().toISOString();
  }
  if (updates.status === 'completed' && !project.completed_at) {
    project.completed_at = new Date().toISOString();
  }
  if (updates.status === 'paid' && !project.paid_at) {
    project.paid_at = new Date().toISOString();
  }

  saveProjects(projects);
  log(`[TRACKER] Project updated: ${project.gig_title} → ${project.status}`);
  return project;
}

/**
 * Log time worked on a project.
 */
export function logTime(projectId, hours, description) {
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  project.time_logged.push({
    date: new Date().toISOString(),
    hours,
    description,
  });

  saveProjects(projects);
  const totalHours = project.time_logged.reduce((sum, t) => sum + t.hours, 0);
  log(`[TRACKER] Logged ${hours}h on "${project.gig_title}" (total: ${totalHours}h)`);
  return project;
}

/**
 * Get all projects, optionally filtered by status.
 */
export function getProjects(status = null) {
  const projects = loadProjects();
  if (status) return projects.filter(p => p.status === status);
  return projects;
}

// ─── PAYMENT TRACKING ───

/**
 * Record a payment received.
 */
export function recordPayment(data) {
  const payments = loadPayments();

  const payment = {
    id: `pay-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    project_id: data.project_id,
    amount: data.amount,
    currency: data.currency || 'USD',
    platform: data.platform,
    platform_fee: data.platform_fee || 0,
    net_amount: data.amount - (data.platform_fee || 0),
    method: data.method || 'platform', // platform, direct, crypto, paypal
    description: data.description || '',
    received_at: data.received_at || new Date().toISOString(),
    gig_title: data.gig_title || '',
  };

  payments.push(payment);
  savePayments(payments);

  // Also update the project status to 'paid'
  if (data.project_id) {
    try {
      updateProject(data.project_id, { status: 'paid' });
    } catch {}
  }

  log(`[TRACKER] Payment recorded: $${payment.net_amount} net (${payment.platform})`);
  return payment;
}

// ─── ANALYTICS ───

/**
 * Get comprehensive earnings analytics.
 */
export function getEarningsStats(period = 'all') {
  const payments = loadPayments();
  const projects = loadProjects();

  // Filter by period
  const now = new Date();
  let startDate = new Date(0); // All time
  if (period === 'week') startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === 'month') startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
  if (period === 'year') startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);

  const filteredPayments = payments.filter(p => new Date(p.received_at) >= startDate);
  const filteredProjects = projects.filter(p => new Date(p.accepted_at) >= startDate);

  // Calculate stats
  const totalEarnings = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalNet = filteredPayments.reduce((sum, p) => sum + p.net_amount, 0);
  const totalFees = filteredPayments.reduce((sum, p) => sum + p.platform_fee, 0);
  const totalHours = filteredProjects.reduce((sum, p) =>
    sum + p.time_logged.reduce((h, t) => h + t.hours, 0), 0);
  const effectiveRate = totalHours > 0 ? Math.round(totalNet / totalHours) : 0;

  // Pipeline stats
  const pipelineValue = projects
    .filter(p => ['accepted', 'in_progress', 'delivered'].includes(p.status))
    .reduce((sum, p) => sum + (p.agreed_amount || 0), 0);

  // By platform
  const byPlatform = {};
  for (const p of filteredPayments) {
    if (!byPlatform[p.platform]) byPlatform[p.platform] = { earnings: 0, count: 0, fees: 0 };
    byPlatform[p.platform].earnings += p.amount;
    byPlatform[p.platform].count++;
    byPlatform[p.platform].fees += p.platform_fee;
  }

  // By month (for charts)
  const byMonth = {};
  for (const p of payments) {
    const month = p.received_at.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = 0;
    byMonth[month] += p.net_amount;
  }

  // Conversion funnel
  const proposalsSent = projects.length; // Each project started as a proposal
  const accepted = projects.filter(p => p.status !== 'rejected').length;
  const delivered = projects.filter(p => ['delivered', 'completed', 'paid'].includes(p.status)).length;
  const paid = projects.filter(p => p.status === 'paid').length;

  return {
    period,
    total_earnings: totalEarnings,
    total_net: totalNet,
    total_fees: totalFees,
    total_hours: totalHours,
    effective_hourly_rate: effectiveRate,
    pipeline_value: pipelineValue,
    projects_count: filteredProjects.length,
    payments_count: filteredPayments.length,
    by_platform: byPlatform,
    by_month: byMonth,
    funnel: {
      proposals_sent: proposalsSent,
      accepted,
      delivered,
      paid,
      conversion_rate: proposalsSent > 0 ? Math.round((paid / proposalsSent) * 100) : 0,
    },
    active_projects: projects.filter(p => ['accepted', 'in_progress'].includes(p.status)),
    pending_payment: projects.filter(p => p.status === 'delivered'),
  };
}

/**
 * Get daily earnings for the last N days (for dashboard chart).
 */
export function getDailyEarnings(days = 30) {
  const payments = loadPayments();
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().substring(0, 10);

    const dayTotal = payments
      .filter(p => p.received_at.substring(0, 10) === dateStr)
      .reduce((sum, p) => sum + p.net_amount, 0);

    result.push({ date: dateStr, amount: dayTotal });
  }

  return result;
}
