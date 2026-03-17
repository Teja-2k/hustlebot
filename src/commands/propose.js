import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateProposal } from '../engines/ai.js';
import { saveProposals, getApiKey } from '../utils/config.js';

export async function proposeGig(gigId, opts, config) {
  const gigIndex = parseInt(gigId) - 1;
  const gig = config.gigs[gigIndex];

  if (!gig) {
    console.log(chalk.red(`\n  ⚠ Gig #${gigId} not found. Run `) + chalk.white('hustlebot scan') + chalk.red(' first.\n'));
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log(chalk.red('\n  ⚠ No API key. Run ') + chalk.white('hustlebot init') + chalk.red(' to configure.\n'));
    return;
  }

  console.log(chalk.hex('#FF6B00')('\n  ✍️  Generating proposal...\n'));
  console.log(chalk.white(`  Gig: `) + chalk.hex('#FF6B00')(gig.title));
  console.log(chalk.white(`  Platform: `) + chalk.cyan(gig.platform));
  console.log(chalk.white(`  Budget: `) + chalk.gray(gig.budget || 'Not specified'));
  console.log();

  const spinner = ora('  Crafting your proposal with AI...').start();

  try {
    const proposal = await generateProposal(gig, config.profile, {
      tone: opts.tone,
      length: opts.length,
    });

    spinner.succeed('  Proposal generated!');

    // Display the proposal
    console.log('\n' + boxen(
      chalk.white(proposal),
      {
        padding: 1,
        borderColor: '#FF6B00',
        borderStyle: 'round',
        title: chalk.hex('#FF6B00')(' YOUR PROPOSAL '),
        titleAlignment: 'center',
      }
    ));

    // Word count
    const wordCount = proposal.split(/\s+/).length;
    console.log(chalk.gray(`\n  📊 ${wordCount} words • Tone: ${opts.tone} • Length: ${opts.length}`));

    // Actions
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: chalk.white('What would you like to do?'),
      choices: [
        { name: '📋 Copy to clipboard', value: 'copy' },
        { name: '💾 Save to file', value: 'save' },
        { name: '🔄 Regenerate (different tone)', value: 'regen' },
        { name: '🌐 Open gig URL in browser', value: 'open' },
        { name: '✅ Mark as sent', value: 'sent' },
        { name: '❌ Discard', value: 'discard' },
      ]
    }]);

    switch (action) {
      case 'copy': {
        // Cross-platform clipboard
        try {
          const { execSync } = await import('child_process');
          const platform = process.platform;
          if (platform === 'darwin') {
            execSync('pbcopy', { input: proposal });
          } else if (platform === 'linux') {
            execSync('xclip -selection clipboard', { input: proposal });
          } else if (platform === 'win32') {
            execSync('powershell.exe -command "Set-Clipboard -Value $input"', { input: proposal });
          }
          console.log(chalk.green('\n  ✓ Copied to clipboard!\n'));
        } catch {
          console.log(chalk.yellow('\n  ⚠ Could not copy — saving to file instead'));
          const path = join(config.hustlebotDir, `proposal-${Date.now()}.txt`);
          writeFileSync(path, proposal);
          console.log(chalk.green(`  ✓ Saved to ${path}\n`));
        }
        break;
      }

      case 'save': {
        const path = join(config.hustlebotDir, `proposal-${gig.display_id}-${Date.now()}.txt`);
        writeFileSync(path, `# Proposal for: ${gig.title}\n# Platform: ${gig.platform}\n# URL: ${gig.url}\n# Generated: ${new Date().toISOString()}\n\n${proposal}`);
        console.log(chalk.green(`\n  ✓ Saved to ${path}\n`));
        break;
      }

      case 'regen': {
        const { newTone } = await inquirer.prompt([{
          type: 'list',
          name: 'newTone',
          message: 'Pick a tone:',
          choices: ['professional', 'casual', 'bold'],
        }]);
        await proposeGig(gigId, { ...opts, tone: newTone }, config);
        return;
      }

      case 'open': {
        if (gig.url) {
          const open = (await import('open')).default;
          await open(gig.url);
          console.log(chalk.green('\n  ✓ Opened in browser\n'));
        } else {
          console.log(chalk.yellow('\n  ⚠ No URL available for this gig\n'));
        }
        break;
      }

      case 'sent': {
        // Track the proposal
        const proposalRecord = {
          gig_id: gig.id,
          gig_title: gig.title,
          platform: gig.platform,
          proposal_text: proposal,
          tone: opts.tone,
          sent_at: new Date().toISOString(),
          status: 'sent',
          budget: gig.budget,
        };

        config.proposals.push(proposalRecord);
        saveProposals(config.proposals);

        const count = config.store.get('proposalsSent') || 0;
        config.store.set('proposalsSent', count + 1);

        console.log(chalk.green('\n  ✓ Marked as sent and tracked!\n'));
        console.log(chalk.gray('  Run ') + chalk.white('hustlebot status') + chalk.gray(' to see your pipeline.\n'));
        break;
      }

      case 'discard':
        console.log(chalk.gray('\n  Discarded.\n'));
        break;
    }

  } catch (err) {
    spinner.fail(`  Error: ${err.message}`);
    console.log(chalk.gray('\n  Make sure your ANTHROPIC_API_KEY is valid and has credits.\n'));
  }
}
