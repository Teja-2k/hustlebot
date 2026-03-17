# HustleBot — Claude Code Development Guide

## What Is This
HustleBot is a fully automated AI freelance agent — a CLI + web dashboard that scans 5 platforms for gigs, writes proposals, auto-submits via browser automation, manages client communication, generates deliverables, and tracks earnings. Designed to run 24/7 as an autonomous money-making system.

## Tech Stack
- Node.js 18+ (ES modules)
- Commander.js (CLI framework)
- Inquirer.js (interactive prompts)
- Cheerio (web scraping)
- Anthropic SDK (AI-powered proposals, scoring, delivery, client comms)
- Puppeteer-core (browser automation for Upwork/Freelancer)
- Express (web dashboard server)
- node-schedule (cron-like daemon scheduling)
- Chalk + Boxen + cli-table3 (terminal UI)
- Conf (persistent config storage)

## Project Structure
```
src/
  index.js              — CLI entry point, all command registration
  commands/
    init.js             — Profile setup wizard
    scan.js             — Orchestrates all 5 scanners, displays results
    propose.js          — AI proposal generation
    deliver.js          — Project scaffolding (manual)
    status.js           — Terminal dashboard display
    autopilot.js        — Autopilot config/start/stop/status/logs
    auth.js             — Platform authentication (opens Chrome for login)
    dashboard.js        — Launches web dashboard server
  scanners/
    upwork.js           — Upwork job scraping
    freelancer.js       — Freelancer.com API scanner
    fiverr.js           — Fiverr demand signal detection
    twitter.js          — Twitter/X opportunity scanning
    hackernews.js       — HackerNews hiring thread scanning
  engines/
    ai.js               — Claude API for scoring + proposals
    client-ai.js        — AI client communication (classify, reply, review)
    delivery-engine.js  — AI-powered code generation + ZIP packaging
    payment-tracker.js  — Earnings, projects, payments tracking
  automation/
    daemon.js           — Background autopilot scheduler
    pipeline.js         — Gig state machine (DISCOVERED → PAID)
    submitter.js        — Proposal submission (browser + clipboard fallback)
    delivery-runner.js  — Auto-delivery orchestration
    dedup.js            — Gig deduplication across cycles
    autopilot-config.js — Config loader for autopilot.yaml
  browser/
    chrome.js           — Puppeteer browser management, persistent sessions
    upwork-submit.js    — Upwork auto-proposal submission
    freelancer-submit.js — Freelancer auto-bid submission
    message-monitor.js  — Client message monitoring + reply
  notifications/
    notify.js           — Notification dispatcher (Discord + Telegram)
    discord.js          — Discord webhook sender
    telegram.js         — Telegram Bot API sender
  dashboard/
    server.js           — Express API server
    public/index.html   — Single-page web dashboard
  utils/
    config.js           — Profile, gigs, proposals persistence
    logger.js           — File + console logging
```

## Key Design Decisions
- Everything stores in ~/.hustlebot/ as YAML/JSON files
- Demo/fallback data is baked into scanners for when APIs are unavailable
- The AI engine uses claude-sonnet-4-20250514 for cost efficiency
- All commands are self-contained and can work independently
- Browser automation uses persistent Chrome profile to maintain login sessions
- Puppeteer falls back to clipboard+URL when browser automation fails
- Dashboard auto-refreshes every 30 seconds from the API

## When Adding Features
- New scanners go in src/scanners/ and get imported in scan.js AND daemon.js
- New commands go in src/commands/ and get registered in index.js
- New notification types get added to notify.js NOTIFICATION_TEMPLATES
- Keep terminal output beautiful — use chalk colors consistently (primary: #FF6B00)
- Always include demo/fallback data for scanners that need network access
- Test with: node src/index.js <command>
- On Windows, prefix bash commands with: export PATH="$PATH:/c/Program Files/nodejs"

## Code Style
- ES modules (import/export)
- Async/await everywhere
- Descriptive variable names
- Comments for non-obvious logic
- Error handling with user-friendly messages
- Dynamic imports for optional heavy dependencies (puppeteer-core)
