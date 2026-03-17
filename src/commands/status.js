import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';

export async function showStatus(config) {
  const profile = config.profile;
  const proposals = config.proposals || [];
  const projects = config.projects || [];
  const gigs = config.gigs || [];

  const proposalsSent = config.store.get('proposalsSent') || 0;
  const proposalsWon = config.store.get('proposalsWon') || 0;
  const totalEarnings = config.store.get('totalEarnings') || 0;
  const gigsCompleted = config.store.get('gigsCompleted') || 0;

  const winRate = proposalsSent > 0 ? Math.round((proposalsWon / proposalsSent) * 100) : 0;

  // Header
  const name = profile?.name || 'Unknown';
  const title = profile?.title || 'Set up your profile';

  console.log(chalk.hex('#FF6B00')('\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.hex('#FF6B00')('  ██ HUSTLEBOT DASHBOARD'));
  console.log(chalk.hex('#FF6B00')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Profile card
  console.log(chalk.white(`  ${name}`) + chalk.gray(` — ${title}`));
  if (profile) {
    console.log(chalk.gray(`  ${profile.skills?.length || 0} skills • $${profile.rate_floor}/hr • ${profile.availability}`));
  }
  console.log();

  // Stats
  const statsBox = boxen(
    chalk.hex('#FF6B00')('  💰 EARNINGS      ') + chalk.white(`$${totalEarnings.toLocaleString()}`) + '\n' +
    chalk.hex('#FF6B00')('  📨 PROPOSALS SENT ') + chalk.white(`${proposalsSent}`) + '\n' +
    chalk.hex('#FF6B00')('  🏆 PROPOSALS WON  ') + chalk.white(`${proposalsWon}`) + chalk.gray(` (${winRate}% win rate)`) + '\n' +
    chalk.hex('#FF6B00')('  ✅ GIGS COMPLETED ') + chalk.white(`${gigsCompleted}`) + '\n' +
    chalk.hex('#FF6B00')('  📡 GIGS IN RADAR  ') + chalk.white(`${gigs.length}`),
    { padding: { left: 1, right: 1, top: 0, bottom: 0 }, borderColor: '#FF6B00', borderStyle: 'round' }
  );
  console.log(statsBox);

  // Recent proposals
  if (proposals.length > 0) {
    console.log(chalk.hex('#FF6B00')('\n  ── Recent Proposals ──\n'));

    const table = new Table({
      head: [
        chalk.hex('#FF6B00')('Date'),
        chalk.hex('#FF6B00')('Platform'),
        chalk.hex('#FF6B00')('Gig'),
        chalk.hex('#FF6B00')('Status'),
      ],
      colWidths: [14, 12, 45, 12],
      style: { head: [], border: ['gray'] },
      wordWrap: true,
    });

    for (const p of proposals.slice(-10).reverse()) {
      const date = new Date(p.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const statusIcon = p.status === 'won' ? chalk.green('🏆 Won') :
        p.status === 'rejected' ? chalk.red('✗ No') :
          p.status === 'sent' ? chalk.yellow('⏳ Sent') :
            chalk.gray(p.status);

      table.push([
        chalk.gray(date),
        chalk.cyan(p.platform),
        chalk.white(p.gig_title?.substring(0, 43) || '—'),
        statusIcon,
      ]);
    }

    console.log(table.toString());
  }

  // Active projects
  if (projects.length > 0) {
    console.log(chalk.hex('#FF6B00')('\n  ── Active Projects ──\n'));
    for (const p of projects.filter(p => p.status === 'active')) {
      console.log(chalk.white(`  • ${p.name}`) + chalk.gray(` — ${p.client} — $${p.value}`));
    }
  }

  // Quick actions
  console.log(chalk.hex('#FF6B00')('\n  ── Quick Actions ──\n'));
  console.log(chalk.gray('  hustlebot scan        ') + chalk.dim('→ Find new gigs'));
  console.log(chalk.gray('  hustlebot propose <#>  ') + chalk.dim('→ Write a proposal'));
  console.log(chalk.gray('  hustlebot deliver <#>  ') + chalk.dim('→ Start delivering'));
  console.log();
}
