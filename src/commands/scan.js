import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { scanUpwork } from '../scanners/upwork.js';
import { scanTwitter } from '../scanners/twitter.js';
import { scanHackerNews } from '../scanners/hackernews.js';
import { scanFreelancer } from '../scanners/freelancer.js';
import { scanFiverr } from '../scanners/fiverr.js';
import { scoreGigMatch } from '../engines/ai.js';
import { saveGigs, getApiKey } from '../utils/config.js';

export async function scanGigs(opts, config) {
  const profile = config.profile;
  const keywords = profile.search_keywords;
  const platforms = opts.platform === 'all' ? profile.platforms : [opts.platform];
  const limit = parseInt(opts.limit);
  const minScore = parseInt(opts.minScore) || 0;

  console.log(chalk.hex('#FF6B00')('\n  🔍 Scanning for gigs...\n'));
  console.log(chalk.gray(`  Keywords: ${keywords.join(', ')}`));
  console.log(chalk.gray(`  Platforms: ${platforms.join(', ')}`));
  console.log(chalk.gray(`  Min rate: $${profile.rate_floor}/hr`));
  console.log();

  let allGigs = [];

  // Scan each platform
  for (const platform of platforms) {
    const spinner = ora(`  Scanning ${platform}...`).start();

    try {
      let gigs = [];

      switch (platform) {
        case 'upwork':
          gigs = await scanUpwork(keywords, { limit });
          break;
        case 'twitter':
          gigs = await scanTwitter(keywords, { limit });
          break;
        case 'hackernews':
          gigs = await scanHackerNews(keywords, { limit });
          break;
        case 'freelancer':
          gigs = await scanFreelancer(keywords, { limit });
          break;
        case 'fiverr':
          gigs = await scanFiverr(keywords, { limit });
          break;
        default:
          spinner.warn(`  ${platform} scanner not yet implemented`);
          continue;
      }

      spinner.succeed(`  ${platform}: found ${gigs.length} potential gigs`);
      allGigs.push(...gigs);
    } catch (err) {
      spinner.fail(`  ${platform}: error — ${err.message}`);
    }
  }

  if (allGigs.length === 0) {
    console.log(chalk.yellow('\n  No gigs found. Try adjusting your keywords or platforms.\n'));
    return;
  }

  // Score gigs with AI (if API key available)
  const apiKey = getApiKey();
  if (apiKey && allGigs.length > 0) {
    const scoreSpinner = ora(`  Scoring ${allGigs.length} gigs with AI...`).start();

    let scored = 0;
    for (const gig of allGigs) {
      try {
        const result = await scoreGigMatch(gig, profile);
        gig.match_score = result.score;
        gig.match_reason = result.reason;
        gig.estimated_hours = result.estimated_hours;
        gig.suggested_rate = result.suggested_rate;
        scored++;
        scoreSpinner.text = `  Scoring gigs with AI... (${scored}/${allGigs.length})`;
      } catch (err) {
        gig.match_score = 50;
        gig.match_reason = 'Score unavailable';
      }

      // Rate limit API calls
      await new Promise(r => setTimeout(r, 300));
    }

    scoreSpinner.succeed(`  Scored ${scored} gigs with AI`);
  } else {
    // Assign basic keyword-match scores
    allGigs.forEach(gig => {
      const keywordMatches = keywords.filter(kw =>
        (gig.title + ' ' + gig.description).toLowerCase().includes(kw.toLowerCase())
      ).length;
      gig.match_score = Math.min(90, 40 + keywordMatches * 15);
      gig.match_reason = `${keywordMatches} keyword matches`;
    });
  }

  // Sort by score
  allGigs.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

  // Filter by minimum score
  const filtered = allGigs.filter(g => (g.match_score || 0) >= minScore);

  // Assign display IDs
  filtered.forEach((gig, i) => {
    gig.display_id = i + 1;
  });

  // Save for later use by propose command
  saveGigs(filtered);

  // Display results
  console.log(chalk.hex('#FF6B00')(`\n  ━━━ Found ${filtered.length} matching gigs ━━━\n`));

  const table = new Table({
    head: [
      chalk.hex('#FF6B00')('#'),
      chalk.hex('#FF6B00')('Score'),
      chalk.hex('#FF6B00')('Platform'),
      chalk.hex('#FF6B00')('Title'),
      chalk.hex('#FF6B00')('Budget'),
    ],
    colWidths: [5, 8, 12, 50, 20],
    style: { head: [], border: ['gray'] },
    wordWrap: true,
  });

  for (const gig of filtered.slice(0, limit)) {
    const scoreColor = gig.match_score >= 75 ? chalk.green :
      gig.match_score >= 50 ? chalk.yellow : chalk.red;
    const demoTag = gig.is_demo ? chalk.gray(' [demo]') : '';

    table.push([
      chalk.white(gig.display_id),
      scoreColor(`${gig.match_score}%`),
      chalk.cyan(gig.platform),
      chalk.white(gig.title.substring(0, 48)) + demoTag,
      chalk.gray(gig.budget?.substring(0, 18) || '—'),
    ]);
  }

  console.log(table.toString());

  // Show details for top 3
  console.log(chalk.hex('#FF6B00')('\n  ── Top Matches ──\n'));

  for (const gig of filtered.slice(0, 3)) {
    console.log(chalk.white(`  #${gig.display_id} `) + chalk.hex('#FF6B00')(gig.title));
    console.log(chalk.gray(`     ${gig.match_reason}`));
    if (gig.estimated_hours) {
      console.log(chalk.gray(`     Est. ${gig.estimated_hours}hrs @ $${gig.suggested_rate}/hr = $${gig.estimated_hours * gig.suggested_rate}`));
    }
    if (gig.url) {
      console.log(chalk.blue(`     ${gig.url}`));
    }
    console.log();
  }

  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(chalk.white('  Next: ') + chalk.hex('#FF6B00')('hustlebot propose <#>') + chalk.gray(' to write a proposal'));
  console.log();
}
