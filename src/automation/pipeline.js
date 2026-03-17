import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PIPELINE_PATH = join(homedir(), '.hustlebot', 'pipeline.json');

// States
export const States = {
  DISCOVERED: 'DISCOVERED',
  SCORED: 'SCORED',
  PROPOSAL_DRAFT: 'PROPOSAL_DRAFT',
  PROPOSAL_REVIEW: 'PROPOSAL_REVIEW',
  SUBMITTED: 'SUBMITTED',
  WAITING: 'WAITING',
  WON: 'WON',
  DELIVERING: 'DELIVERING',
  DELIVERED: 'DELIVERED',
  PAID: 'PAID',
  LOST: 'LOST',
  SKIPPED: 'SKIPPED',
};

export function loadPipeline() {
  if (!existsSync(PIPELINE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(PIPELINE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

export function savePipeline(pipeline) {
  writeFileSync(PIPELINE_PATH, JSON.stringify(pipeline, null, 2));
}

export function addGigToPipeline(gig) {
  const pipeline = loadPipeline();
  const exists = pipeline.find(p => p.id === gig.id);
  if (exists) return exists;

  const entry = {
    id: gig.id,
    state: States.DISCOVERED,
    gig,
    score: null,
    proposal: null,
    deliveryPlan: null,
    projectDir: null,
    transitions: [{ from: null, to: States.DISCOVERED, at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  pipeline.push(entry);
  savePipeline(pipeline);
  return entry;
}

export function advanceGig(gigId, newState, metadata = {}) {
  const pipeline = loadPipeline();
  const entry = pipeline.find(p => p.id === gigId);
  if (!entry) return null;

  const oldState = entry.state;
  entry.state = newState;
  entry.updatedAt = new Date().toISOString();
  entry.transitions.push({ from: oldState, to: newState, at: entry.updatedAt });

  // Merge any metadata
  Object.assign(entry, metadata);

  savePipeline(pipeline);
  return entry;
}

export function getGigsByState(...states) {
  return loadPipeline().filter(p => states.includes(p.state));
}

export function getPipelineStats() {
  const pipeline = loadPipeline();
  const stats = {};
  for (const state of Object.values(States)) {
    stats[state] = pipeline.filter(p => p.state === state).length;
  }
  stats.total = pipeline.length;
  return stats;
}

export function getTodayProposalCount() {
  const pipeline = loadPipeline();
  const today = new Date().toISOString().split('T')[0];
  return pipeline.filter(p =>
    p.state !== States.DISCOVERED &&
    p.state !== States.SCORED &&
    p.transitions.some(t => t.to === States.SUBMITTED && t.at.startsWith(today))
  ).length;
}
