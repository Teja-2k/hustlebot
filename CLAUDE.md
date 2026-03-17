# HustleBot — Claude Code Development Guide

## What Is This
HustleBot is a CLI tool that helps technical freelancers find gigs, write proposals, and deliver work using AI. It's designed to go viral on GitHub as an open-source tool.

## Tech Stack
- Node.js 18+ (ES modules)
- Commander.js (CLI framework)
- Inquirer.js (interactive prompts)
- Cheerio (web scraping)
- Anthropic SDK (AI-powered proposals)
- Chalk + Boxen + cli-table3 (terminal UI)
- Conf (persistent config storage)

## Project Structure
```
src/
  index.js          — CLI entry point, command registration
  commands/
    init.js         — Profile setup wizard
    scan.js         — Orchestrates scanners, displays results
    propose.js      — AI proposal generation
    deliver.js      — Project scaffolding
    status.js       — Dashboard display
  scanners/
    upwork.js       — Upwork job scraping
    twitter.js      — Twitter/X opportunity scanning
    hackernews.js   — HackerNews hiring thread scanning
  engines/
    ai.js           — Claude API integration for scoring + proposals
  utils/
    config.js       — Profile, gigs, proposals persistence
```

## Key Design Decisions
- Everything stores in ~/.hustlebot/ as YAML/JSON files
- Demo/fallback data is baked into scanners for when APIs are unavailable
- The AI engine uses claude-sonnet-4-20250514 for cost efficiency
- All commands are self-contained and can work independently

## When Adding Features
- New scanners go in src/scanners/ and get imported in scan.js
- New commands go in src/commands/ and get registered in index.js
- Keep terminal output beautiful — use chalk colors consistently (primary: #FF6B00)
- Always include demo/fallback data for scanners that need network access
- Test with: node src/index.js <command>

## Priority Tasks
1. Add Freelancer.com scanner
2. Add LinkedIn scanner (via scraping)
3. Add --watch mode for continuous scanning
4. Add proposal templates system
5. Add earnings tracking (mark gigs as won, log payments)
6. Build the landing page (React on Vercel)
7. Add cron-based auto-scanning
8. Add Telegram notifications for high-score matches

## Code Style
- ES modules (import/export)
- Async/await everywhere
- Descriptive variable names
- Comments for non-obvious logic
- Error handling with user-friendly messages
