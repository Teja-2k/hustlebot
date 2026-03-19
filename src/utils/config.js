import Conf from 'conf';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';

const HUSTLEBOT_DIR = join(homedir(), '.hustlebot');

export function getConfigDir() {
  return HUSTLEBOT_DIR;
}
const PROFILE_PATH = join(HUSTLEBOT_DIR, 'profile.yaml');
const GIGS_PATH = join(HUSTLEBOT_DIR, 'gigs.json');
const PROPOSALS_PATH = join(HUSTLEBOT_DIR, 'proposals.json');
const PROJECTS_PATH = join(HUSTLEBOT_DIR, 'projects.json');

// Ensure directories exist
if (!existsSync(HUSTLEBOT_DIR)) {
  mkdirSync(HUSTLEBOT_DIR, { recursive: true });
}

const store = new Conf({
  projectName: 'hustlebot',
  defaults: {
    apiKey: null,
    scanHistory: [],
    totalEarnings: 0,
    proposalsSent: 0,
    proposalsWon: 0,
    gigsCompleted: 0,
    firstRun: true,
  }
});

export function getConfig() {
  const config = {
    store,
    profile: null,
    gigs: [],
    proposals: [],
    projects: [],
    hustlebotDir: HUSTLEBOT_DIR,
  };

  if (existsSync(PROFILE_PATH)) {
    try {
      config.profile = YAML.parse(readFileSync(PROFILE_PATH, 'utf-8'));
    } catch (e) {
      config.profile = null;
    }
  }

  if (existsSync(GIGS_PATH)) {
    try {
      config.gigs = JSON.parse(readFileSync(GIGS_PATH, 'utf-8'));
    } catch (e) {
      config.gigs = [];
    }
  }

  if (existsSync(PROPOSALS_PATH)) {
    try {
      config.proposals = JSON.parse(readFileSync(PROPOSALS_PATH, 'utf-8'));
    } catch (e) {
      config.proposals = [];
    }
  }

  if (existsSync(PROJECTS_PATH)) {
    try {
      config.projects = JSON.parse(readFileSync(PROJECTS_PATH, 'utf-8'));
    } catch (e) {
      config.projects = [];
    }
  }

  return config;
}

export function saveProfile(profile) {
  writeFileSync(PROFILE_PATH, YAML.stringify(profile));
}

export function saveGigs(gigs) {
  writeFileSync(GIGS_PATH, JSON.stringify(gigs, null, 2));
}

export function saveProposals(proposals) {
  writeFileSync(PROPOSALS_PATH, JSON.stringify(proposals, null, 2));
}

export function saveProjects(projects) {
  writeFileSync(PROJECTS_PATH, JSON.stringify(projects, null, 2));
}

export function getApiKey() {
  return store.get('apiKey') || process.env.ANTHROPIC_API_KEY;
}

export function setApiKey(key) {
  store.set('apiKey', key);
}

export { HUSTLEBOT_DIR, PROFILE_PATH, store };
