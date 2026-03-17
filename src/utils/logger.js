import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOGS_DIR = join(homedir(), '.hustlebot', 'logs');

if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

function timestamp() {
  return new Date().toISOString();
}

function writeLog(level, message, file = 'autopilot.log') {
  const line = `[${timestamp()}] [${level}] ${message}\n`;
  appendFileSync(join(LOGS_DIR, file), line);
}

export function log(message) { writeLog('INFO', message); }
export function warn(message) { writeLog('WARN', message); }
export function error(message) { writeLog('ERROR', message); }

export function logDelivery(projectSlug, message) {
  writeLog('INFO', message, `delivery-${projectSlug}.log`);
}

export function readLogs(file = 'autopilot.log', lines = 50) {
  const path = join(LOGS_DIR, file);
  if (!existsSync(path)) return '(no logs yet)';
  const all = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  return all.slice(-lines).join('\n');
}

export { LOGS_DIR };
