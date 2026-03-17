import chalk from 'chalk';
import { setupUpworkSession } from '../browser/upwork-submit.js';
import { setupFreelancerSession } from '../browser/freelancer-submit.js';
import { closeBrowser } from '../browser/chrome.js';

export async function authPlatform(platform) {
  const handlers = {
    upwork: async () => {
      console.log(chalk.hex('#FF6B00')('\n  Upwork Login\n'));
      console.log(chalk.gray('  A Chrome window will open. Log into Upwork manually.'));
      console.log(chalk.gray('  Your session will be saved for future automation.\n'));

      const result = await setupUpworkSession();
      if (result.success) {
        console.log(chalk.green(`\n  ✓ ${result.message}`));
        console.log(chalk.gray('  HustleBot can now submit proposals on Upwork automatically.\n'));
      }
    },

    freelancer: async () => {
      console.log(chalk.hex('#FF6B00')('\n  Freelancer.com Login\n'));
      console.log(chalk.gray('  A Chrome window will open. Log into Freelancer manually.'));
      console.log(chalk.gray('  Your session will be saved for future automation.\n'));

      const result = await setupFreelancerSession();
      if (result.success) {
        console.log(chalk.green(`\n  ✓ ${result.message}`));
        console.log(chalk.gray('  HustleBot can now submit bids on Freelancer automatically.\n'));
      }
    },
  };

  if (!handlers[platform]) {
    console.log(chalk.red(`\n  ⚠ Unknown platform: ${platform}`));
    console.log(chalk.gray('  Available: upwork, freelancer\n'));
    return;
  }

  try {
    await handlers[platform]();
  } catch (err) {
    console.log(chalk.red(`\n  ⚠ Error: ${err.message}\n`));
  } finally {
    await closeBrowser();
  }
}
