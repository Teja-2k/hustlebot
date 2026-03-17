import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';

const AUTOPILOT_PATH = join(homedir(), '.hustlebot', 'autopilot.yaml');

const DEFAULTS = {
  enabled: false,
  autonomy_level: 1,           // 1=supervised, 2=semi-auto, 3=full-auto
  scan_interval_hours: 2,
  min_score_propose: 70,
  min_score_auto_submit: 85,
  discord_webhook: null,
  max_proposals_per_day: 10,
  max_concurrent_deliveries: 2,
  auto_deliver_types: ['code', 'data', 'writing'],
  delivery_review_required: true,
};

export function loadAutopilotConfig() {
  if (!existsSync(AUTOPILOT_PATH)) return { ...DEFAULTS };
  try {
    const parsed = YAML.parse(readFileSync(AUTOPILOT_PATH, 'utf-8'));
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAutopilotConfig(config) {
  writeFileSync(AUTOPILOT_PATH, YAML.stringify({ ...DEFAULTS, ...config }));
}

export { AUTOPILOT_PATH, DEFAULTS };
