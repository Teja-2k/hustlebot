import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HUSTLEBOT_DIR = join(homedir(), '.hustlebot');

function readJSON(path) {
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return []; }
}

function readYAML(path) {
  if (!existsSync(path)) return null;
  try { return YAML.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

export function startDashboard(port = 3456) {
  const app = express();

  // Serve static frontend
  app.use(express.static(join(__dirname, 'public')));

  // API: full dashboard data in one call
  app.get('/api/dashboard', (req, res) => {
    const profile = readYAML(join(HUSTLEBOT_DIR, 'profile.yaml'));
    const autopilot = readYAML(join(HUSTLEBOT_DIR, 'autopilot.yaml'));
    const pipeline = readJSON(join(HUSTLEBOT_DIR, 'pipeline.json'));
    const gigs = readJSON(join(HUSTLEBOT_DIR, 'gigs.json'));
    const proposals = readJSON(join(HUSTLEBOT_DIR, 'proposals.json'));
    const projects = readJSON(join(HUSTLEBOT_DIR, 'projects.json'));
    const seenGigs = readJSON(join(HUSTLEBOT_DIR, 'seen-gigs.json'));

    // Read Conf store for stats
    let stats = {};
    try {
      const confDir = join(homedir(), '.config', 'hustlebot');
      const confPath = join(confDir, 'config.json');
      if (existsSync(confPath)) {
        stats = JSON.parse(readFileSync(confPath, 'utf-8'));
      }
    } catch {}

    // Read logs
    let logs = '';
    const logPath = join(HUSTLEBOT_DIR, 'logs', 'autopilot.log');
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.split('\n');
      logs = lines.slice(-50).join('\n');
    }

    // Pipeline stats
    const pipelineStats = {};
    for (const entry of pipeline) {
      pipelineStats[entry.state] = (pipelineStats[entry.state] || 0) + 1;
    }

    // Check daemon
    let daemonRunning = false;
    const pidPath = join(HUSTLEBOT_DIR, 'daemon.pid');
    if (existsSync(pidPath)) {
      const pid = readFileSync(pidPath, 'utf-8').trim();
      try { process.kill(parseInt(pid), 0); daemonRunning = true; } catch {}
    }

    // Earnings data
    const payments = readJSON(join(HUSTLEBOT_DIR, 'payments.json'));
    const deliveries = readJSON(join(HUSTLEBOT_DIR, 'deliveries', 'deliveries-index.json'));

    const totalEarnings = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalNet = payments.reduce((s, p) => s + (p.net_amount || 0), 0);
    const pipelineValue = (projects || [])
      .filter(p => ['accepted', 'in_progress', 'delivered'].includes(p.status))
      .reduce((s, p) => s + (p.agreed_amount || 0), 0);

    res.json({
      profile,
      autopilot: { ...autopilot, daemonRunning },
      pipeline,
      pipelineStats,
      gigs,
      proposals,
      projects,
      payments,
      deliveries: deliveries || [],
      seenGigs: seenGigs.length || 0,
      stats: {
        totalEarnings,
        totalNet,
        pipelineValue,
        proposalsSent: stats.proposalsSent || pipeline.length || 0,
        proposalsWon: stats.proposalsWon || (projects || []).length || 0,
        gigsCompleted: stats.gigsCompleted || (projects || []).filter(p => p.status === 'paid').length || 0,
        paymentsCount: payments.length,
        deliveriesCount: (deliveries || []).length,
      },
      logs,
    });
  });

  // API: pipeline gigs with filtering
  app.get('/api/pipeline', (req, res) => {
    const pipeline = readJSON(join(HUSTLEBOT_DIR, 'pipeline.json'));
    const state = req.query.state;
    const filtered = state ? pipeline.filter(g => g.state === state) : pipeline;
    res.json(filtered.sort((a, b) => (b.score || 0) - (a.score || 0)));
  });

  // API: earnings data
  app.get('/api/earnings', (req, res) => {
    const payments = readJSON(join(HUSTLEBOT_DIR, 'payments.json'));
    const projects = readJSON(join(HUSTLEBOT_DIR, 'projects.json'));
    const period = req.query.period || 'all';

    const now = new Date();
    let startDate = new Date(0);
    if (period === 'week') startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    if (period === 'month') startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const filteredPayments = payments.filter(p => new Date(p.received_at) >= startDate);

    res.json({
      total: filteredPayments.reduce((s, p) => s + p.amount, 0),
      net: filteredPayments.reduce((s, p) => s + p.net_amount, 0),
      fees: filteredPayments.reduce((s, p) => s + p.platform_fee, 0),
      payments: filteredPayments,
      projects: projects || [],
    });
  });

  // API: deliveries
  app.get('/api/deliveries', (req, res) => {
    const deliveries = readJSON(join(HUSTLEBOT_DIR, 'deliveries', 'deliveries-index.json'));
    res.json(deliveries || []);
  });

  const server = app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
  });

  return server;
}
