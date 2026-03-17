import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const SEEN_PATH = join(homedir(), '.hustlebot', 'seen-gigs.json');
const MAX_AGE_DAYS = 30;

function gigHash(gig) {
  const key = `${gig.platform}:${gig.title.toLowerCase().trim()}:${(gig.description || '').substring(0, 100).toLowerCase()}`;
  return createHash('md5').update(key).digest('hex');
}

export function loadSeen() {
  if (!existsSync(SEEN_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SEEN_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveSeen(seen) {
  writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2));
}

export function filterNewGigs(gigs) {
  const seen = loadSeen();
  const now = Date.now();
  const cutoff = now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  // Prune old entries
  for (const [hash, ts] of Object.entries(seen)) {
    if (ts < cutoff) delete seen[hash];
  }

  const newGigs = [];
  for (const gig of gigs) {
    const hash = gigHash(gig);
    if (!seen[hash]) {
      seen[hash] = now;
      newGigs.push(gig);
    }
  }

  saveSeen(seen);
  return newGigs;
}
