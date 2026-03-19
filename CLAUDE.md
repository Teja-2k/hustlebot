# HustleBot v3 — AI Product Factory

## What Is This
HustleBot is an autonomous AI Product Factory that researches market demand, builds digital products using Claude Code, deploys them to Vercel, connects payments via Lemon Squeezy, and markets them on social media — all while you sleep. It also retains the original freelance scanning capability as a secondary income stream.

## Architecture Overview
```
Market Research → Product Ideas → Claude Code Builds → Quality Check → Deploy → Market → Sell → Iterate
```

## Tech Stack
- Node.js 18+ (ES modules)
- Commander.js (CLI framework)
- Inquirer.js (interactive prompts)
- Cheerio (web scraping)
- Anthropic SDK (AI-powered scoring, proposals)
- Claude Code (headless mode for product building)
- Puppeteer-core (browser automation)
- Express (web dashboard server)
- node-schedule (heartbeat + daemon scheduling)
- Chalk + Boxen + cli-table3 (terminal UI)
- Conf (persistent config storage)
- Vercel CLI (deployment)
- Lemon Squeezy API (payments)

## Project Structure
```
src/
  index.js              — CLI entry point (v3.0.0)
  factory/              — 🏭 PRODUCT FACTORY (v3 core)
    factory.js          — Main orchestrator (research→build→deploy→sell pipeline)
    product-catalog.js  — Product lifecycle management (IDEA→LIVE→KILLED)
    market-research.js  — Scans PH/Reddit/HN/GitHub for opportunities
    product-builder.js  — Spawns Claude Code to build products + quality checks
    deployer.js         — Vercel deploy + GitHub push + Lemon Squeezy payments
    growth-engine.js    — Twitter/Reddit/ProductHunt marketing automation
    heartbeat.js        — Proactive 30-min checks + nightly consolidation
  commands/
    factory.js          — Factory CLI (research/build/deploy/launch/catalog/growth/config)
    init.js             — Profile setup wizard
    scan.js             — Orchestrates all 5 scanners
    propose.js          — AI proposal generation
    deliver.js          — Project scaffolding
    status.js           — Terminal dashboard
    autopilot.js        — Autopilot daemon management
    auth.js             — Platform authentication
    dashboard.js        — Web dashboard server
    workers.js          — AI worker agent listing
  workers/              — Specialized AI agents for freelance delivery
    base-agent.js       — Foundation class (spawns Claude Code headless)
    router.js           — Gig classifier & agent dispatcher
    quality-runner.js   — Quality check orchestrator
    web-agent/          — Websites, React, dashboards
    bot-agent/          — Telegram/Discord/Slack bots
    data-agent/         — Scrapers, ETL, pipelines
    script-agent/       — Automation, APIs, CLI tools
    design-agent/       — Graphics via AI image APIs
    write-agent/        — Content, documentation
    fix-agent/          — Bug fixes, debugging
  scanners/             — 5 freelance platform scanners
  engines/              — AI scoring, proposals, delivery, payments
  automation/           — Daemon, pipeline state machine, submitter
  browser/              — Puppeteer automation
  notifications/        — Discord + Telegram alerts
  dashboard/            — Express web UI
  utils/                — Config, logging
```

## Key Design Decisions
- Everything stores in ~/.hustlebot/ as YAML/JSON files
- Products built in ~/.hustlebot/products/<product-id>/
- Claude Code spawned in headless mode with domain-specific prompts
- Market research pulls live data from Reddit, HN, GitHub APIs
- Products go through quality gates before deployment
- Marketing posts require approval by default (safety)
- Heartbeat runs every 30 min; nightly consolidation at 2 AM
- Product lifecycle: IDEA → PLANNED → BUILDING → TESTING → READY → DEPLOYING → LIVE

## When Adding Features
- Factory components go in src/factory/
- New product types: add to ProductTypes in product-catalog.js AND requirements in product-builder.js
- New CLI subcommands: add to src/commands/factory.js AND register in index.js
- New market research sources: add scan function in market-research.js
- Keep terminal output beautiful — use chalk colors (primary: #FF6B00)
- Test with: node src/index.js <command>
- On Windows: export PATH="$PATH:/c/Program Files/nodejs"

## Code Style
- ES modules (import/export)
- Async/await everywhere
- Descriptive variable names
- Comments for non-obvious logic
- Error handling with user-friendly messages
