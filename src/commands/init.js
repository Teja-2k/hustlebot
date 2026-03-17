import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { saveProfile, setApiKey, getApiKey, HUSTLEBOT_DIR } from '../utils/config.js';

export async function initProfile() {
  console.log(chalk.hex('#FF6B00')('\n  🤖 Let\'s set up your HustleBot profile\n'));
  console.log(chalk.gray('  This takes ~3 minutes. Your answers train the AI to find\n  gigs that match YOU and write proposals in YOUR voice.\n'));

  // Step 1: API Key
  const existingKey = getApiKey();
  let apiKey = existingKey;

  if (!existingKey) {
    const { key } = await inquirer.prompt([{
      type: 'password',
      name: 'key',
      message: chalk.white('Anthropic API key') + chalk.gray(' (get one at console.anthropic.com):'),
      validate: (v) => v.length > 10 ? true : 'API key looks too short'
    }]);
    apiKey = key;
    setApiKey(apiKey);
    console.log(chalk.green('  ✓ API key saved\n'));
  } else {
    console.log(chalk.green('  ✓ API key already configured\n'));
  }

  // Step 2: Identity
  console.log(chalk.hex('#FF6B00')('  ── WHO YOU ARE ──\n'));

  const identity = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: chalk.white('Your name:'),
      validate: (v) => v.trim().length > 0 ? true : 'Name required'
    },
    {
      type: 'input',
      name: 'title',
      message: chalk.white('Professional title') + chalk.gray(' (e.g. "Senior Data Scientist & AI Engineer"):'),
      validate: (v) => v.trim().length > 0 ? true : 'Title required'
    },
    {
      type: 'input',
      name: 'years_experience',
      message: chalk.white('Years of experience:'),
      default: '5'
    },
    {
      type: 'input',
      name: 'location',
      message: chalk.white('Location') + chalk.gray(' (city, state/country):'),
      default: 'Remote'
    }
  ]);

  // Step 3: Skills
  console.log(chalk.hex('#FF6B00')('\n  ── YOUR SKILLS ──\n'));

  const { skillsRaw } = await inquirer.prompt([{
    type: 'input',
    name: 'skillsRaw',
    message: chalk.white('List your top skills') + chalk.gray(' (comma-separated):\n  e.g. Python, SQL, AI agents, OpenClaw, Claude Code, data pipelines\n '),
    validate: (v) => v.split(',').filter(s => s.trim()).length >= 2 ? true : 'List at least 2 skills'
  }]);

  const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);

  const { specialtiesRaw } = await inquirer.prompt([{
    type: 'input',
    name: 'specialtiesRaw',
    message: chalk.white('Your specialties / niches') + chalk.gray(' (what makes you stand out):\n  e.g. AI automation for small businesses, OpenClaw setup & config\n '),
  }]);

  const specialties = specialtiesRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Step 4: Work preferences
  console.log(chalk.hex('#FF6B00')('\n  ── WORK PREFERENCES ──\n'));

  const prefs = await inquirer.prompt([
    {
      type: 'input',
      name: 'rate_floor',
      message: chalk.white('Minimum hourly rate ($):'),
      default: '75',
      validate: (v) => !isNaN(parseInt(v)) ? true : 'Enter a number'
    },
    {
      type: 'input',
      name: 'availability',
      message: chalk.white('Weekly availability') + chalk.gray(' (e.g. "15 hrs/week evenings"):'),
      default: '15 hrs/week'
    },
    {
      type: 'checkbox',
      name: 'platforms',
      message: chalk.white('Which platforms to scan:'),
      choices: [
        { name: 'Upwork', value: 'upwork', checked: true },
        { name: 'Twitter/X (people asking for help)', value: 'twitter', checked: true },
        { name: 'HackerNews (Who\'s Hiring)', value: 'hackernews', checked: true },
        { name: 'Freelancer.com', value: 'freelancer', checked: false },
        { name: 'LinkedIn', value: 'linkedin', checked: false },
      ]
    },
    {
      type: 'checkbox',
      name: 'gig_types',
      message: chalk.white('Preferred gig types:'),
      choices: [
        { name: 'Fixed-price projects', value: 'fixed', checked: true },
        { name: 'Hourly contracts', value: 'hourly', checked: true },
        { name: 'Retainer / ongoing', value: 'retainer', checked: true },
        { name: 'Quick tasks (< 4 hours)', value: 'quick', checked: true },
      ]
    }
  ]);

  // Step 5: Achievements (for proposal generation)
  console.log(chalk.hex('#FF6B00')('\n  ── YOUR PROOF ──'));
  console.log(chalk.gray('  These get woven into proposals to build credibility.\n'));

  const { achievementsRaw } = await inquirer.prompt([{
    type: 'input',
    name: 'achievementsRaw',
    message: chalk.white('Key achievements') + chalk.gray(' (comma-separated, 2-4 bullet points):\n  e.g. "Built ML pipeline processing 10M records/day, Led team of 8 engineers"\n '),
  }]);

  const achievements = achievementsRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Step 6: Search keywords
  console.log(chalk.hex('#FF6B00')('\n  ── SEARCH KEYWORDS ──'));
  console.log(chalk.gray('  Keywords HustleBot uses to find relevant gigs.\n'));

  const { keywordsRaw } = await inquirer.prompt([{
    type: 'input',
    name: 'keywordsRaw',
    message: chalk.white('Search keywords') + chalk.gray(' (comma-separated):\n  e.g. "OpenClaw, AI agent, Claude Code, data pipeline, automation, chatbot"\n '),
    validate: (v) => v.split(',').filter(s => s.trim()).length >= 2 ? true : 'List at least 2 keywords'
  }]);

  const keywords = keywordsRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Build profile
  const profile = {
    name: identity.name,
    title: identity.title,
    years_experience: parseInt(identity.years_experience),
    location: identity.location,
    skills,
    specialties,
    rate_floor: parseInt(prefs.rate_floor),
    availability: prefs.availability,
    platforms: prefs.platforms,
    gig_types: prefs.gig_types,
    achievements,
    search_keywords: keywords,
    sample_proposals: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Save
  const spinner = ora('Saving your profile...').start();
  saveProfile(profile);
  spinner.succeed('Profile saved!');

  // Summary
  console.log('\n' + boxen(
    chalk.hex('#FF6B00')('🚀 HustleBot is ready to hustle!\n\n') +
    chalk.white(`  ${profile.name}`) + chalk.gray(` — ${profile.title}\n`) +
    chalk.gray(`  ${skills.length} skills • $${profile.rate_floor}/hr min • ${prefs.platforms.length} platforms\n\n`) +
    chalk.white('  Next steps:\n') +
    chalk.gray('  1. ') + chalk.white('hustlebot scan') + chalk.gray('     → Find matching gigs\n') +
    chalk.gray('  2. ') + chalk.white('hustlebot propose') + chalk.gray('  → Write a proposal\n') +
    chalk.gray('  3. ') + chalk.white('hustlebot status') + chalk.gray('   → See your dashboard'),
    { padding: 1, borderColor: '#FF6B00', borderStyle: 'round' }
  ));
}
