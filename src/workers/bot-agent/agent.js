import { BaseAgent } from '../base-agent.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkJSSyntax, checkNpmInstall, checkFileTypes } from '../quality-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * BotAgent — Builds Telegram, Discord, Slack, and WhatsApp bots.
 * Growing demand category — everyone wants chatbots and automation bots.
 */
export default class BotAgent extends BaseAgent {
  constructor() {
    super({
      name: 'BotAgent',
      type: 'bot',
      emoji: '🤖',
      description: 'Telegram bots, Discord bots, Slack bots, WhatsApp bots, chatbots',
      supportedGigTypes: ['telegram bot', 'discord bot', 'slack bot', 'whatsapp bot', 'chatbot', 'bot'],
      allowedTools: [
        'Edit', 'Write', 'Read', 'Glob', 'Grep',
        'Bash(npm*)', 'Bash(npx*)', 'Bash(node*)',
        'Bash(git*)', 'Bash(mkdir*)', 'Bash(ls*)',
        'Bash(cat*)', 'Bash(echo*)', 'Bash(cp*)',
      ],
      timeout: 15 * 60 * 1000, // 15 minutes
      agentDir: __dirname,
    });
  }

  async scaffoldProject(deliveryDir, gig, plan) {
    fs.mkdirSync(deliveryDir, { recursive: true });

    const text = `${gig.title} ${gig.description || ''}`.toLowerCase();

    // Detect bot platform
    let botType = 'telegram'; // default — most common
    if (text.includes('discord')) botType = 'discord';
    else if (text.includes('slack')) botType = 'slack';
    else if (text.includes('whatsapp')) botType = 'whatsapp';

    fs.writeFileSync(path.join(deliveryDir, '.bot-type'), botType);

    // Create standard bot project structure
    fs.mkdirSync(path.join(deliveryDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'src', 'commands'), { recursive: true });
    fs.mkdirSync(path.join(deliveryDir, 'src', 'handlers'), { recursive: true });

    // Scaffold package.json based on bot type
    const deps = {
      telegram: { 'node-telegram-bot-api': '^0.66.0', 'dotenv': '^16.3.1' },
      discord: { 'discord.js': '^14.14.1', 'dotenv': '^16.3.1' },
      slack: { '@slack/bolt': '^3.17.0', 'dotenv': '^16.3.1' },
      whatsapp: { 'whatsapp-web.js': '^1.23.0', 'qrcode-terminal': '^0.12.0', 'dotenv': '^16.3.1' },
    };

    const packageJson = {
      name: plan?.project_name || 'bot-project',
      version: '1.0.0',
      type: 'module',
      main: 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        dev: 'node --watch src/index.js',
      },
      dependencies: deps[botType] || deps.telegram,
    };

    fs.writeFileSync(
      path.join(deliveryDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create .env.example
    const envExamples = {
      telegram: 'BOT_TOKEN=your_telegram_bot_token_here\n# Get from @BotFather on Telegram',
      discord: 'DISCORD_TOKEN=your_discord_bot_token_here\nCLIENT_ID=your_client_id_here\n# Get from discord.com/developers',
      slack: 'SLACK_BOT_TOKEN=xoxb-your-token\nSLACK_SIGNING_SECRET=your_signing_secret\nPORT=3000\n# Get from api.slack.com/apps',
      whatsapp: '# WhatsApp Web.js uses QR code auth — no token needed\n# Scan the QR code when bot starts',
    };

    fs.writeFileSync(
      path.join(deliveryDir, '.env.example'),
      envExamples[botType] || envExamples.telegram
    );
  }

  async runQualityChecks(projectDir, gig, plan) {
    const checks = [
      checkJSSyntax(),
      checkFileTypes(['.js']),
    ];

    // Check npm install if package.json exists
    if (fs.existsSync(path.join(projectDir, 'package.json'))) {
      checks.push(checkNpmInstall());
    }

    // Bot-specific check: entry point exists
    checks.push({
      name: 'Bot entry point exists',
      run: async (dir) => {
        const mainExists = fs.existsSync(path.join(dir, 'src', 'index.js')) ||
                          fs.existsSync(path.join(dir, 'index.js')) ||
                          fs.existsSync(path.join(dir, 'bot.js')) ||
                          fs.existsSync(path.join(dir, 'src', 'bot.js'));
        return {
          passed: mainExists,
          message: mainExists ? 'Bot entry point found' : 'Missing bot entry point (index.js or bot.js)',
        };
      },
    });

    // Bot-specific check: .env.example exists
    checks.push({
      name: 'Environment config documented',
      run: async (dir) => {
        const envExample = fs.existsSync(path.join(dir, '.env.example'));
        return {
          passed: envExample,
          message: envExample ? '.env.example found' : 'Missing .env.example — client needs to know what tokens to set',
        };
      },
    });

    const { runQualityChecks: runChecks } = await import('../quality-runner.js');
    return await runChecks(projectDir, checks);
  }
}
