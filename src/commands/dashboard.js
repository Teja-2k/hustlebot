import chalk from 'chalk';
import { startDashboard } from '../dashboard/server.js';

export async function launchDashboard(opts) {
  const port = parseInt(opts.port) || 3456;

  console.log(chalk.hex('#FF6B00')('\n  Launching HustleBot Dashboard...\n'));

  startDashboard(port);

  console.log(chalk.green(`  ✓ Dashboard running at `) + chalk.white(`http://localhost:${port}`));
  console.log(chalk.gray('  Auto-refreshes every 30 seconds.'));
  console.log(chalk.gray('  Press Ctrl+C to stop.\n'));

  // Open in browser
  try {
    const open = (await import('open')).default;
    await open(`http://localhost:${port}`);
  } catch {
    console.log(chalk.yellow('  Open the URL above in your browser.'));
  }
}
