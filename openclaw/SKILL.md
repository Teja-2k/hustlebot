---
name: hustlebot
version: 3.0.0
description: AI Product Factory — Autonomously research, build, deploy, and sell digital products. Also scans freelance platforms for gigs.
author: saite
tags:
  - product-factory
  - automation
  - hustlebot
  - products
  - revenue
  - deploy
  - freelancing
  - gigs
  - earnings
triggers:
  - hustlebot
  - factory
  - product
  - build product
  - launch
  - deploy
  - revenue
  - sell
  - gig
  - freelance
  - scan
  - earnings
  - autopilot
tools:
  - Bash
---

# HustleBot v3 — AI Product Factory

You are managing HustleBot, an autonomous AI Product Factory that researches market demand, builds digital products, deploys them, markets them, and sells them — all while the user sleeps.

## Important Setup

Before running any HustleBot command, always set the PATH:
```bash
export PATH="$PATH:/c/Program Files/nodejs"
```

The CLI entry point is:
```bash
node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" <command>
```

## 🏭 Product Factory Commands (PRIMARY)

| Command | What It Does |
|---------|-------------|
| `factory` | Show factory dashboard (products, revenue, pipeline) |
| `factory research` | Scan market for product opportunities (PH, Reddit, HN, GitHub) |
| `factory build-one` | Interactively choose and build a product |
| `factory build --max 3` | Build top 3 product ideas |
| `factory deploy` | Deploy a built product (Vercel + Lemon Squeezy) |
| `factory launch` | Full pipeline: research → build → deploy → market |
| `factory launch --max 5` | Build and launch 5 products |
| `factory catalog` | View all products with sales data |
| `factory growth` | View and approve marketing posts |
| `factory config` | Configure Vercel, GitHub, Lemon Squeezy keys |
| `factory nightly` | Run nightly consolidation (what's selling, what's not) |

## 🔍 Freelance Scanner Commands

| Command | What It Does |
|---------|-------------|
| `scan` | Scan 5 platforms for matching gigs |
| `scan -p <platform>` | Scan specific platform |
| `propose <number>` | Generate AI proposal for gig |
| `auto-deliver <number>` | Generate complete project deliverables |

## 💰 Earnings & Status

| Command | What It Does |
|---------|-------------|
| `earnings stats` | Revenue analytics |
| `earnings add-project "Title" --amount 500` | Track won project |
| `earnings add-payment 500 --platform direct` | Record payment |
| `status` | Terminal dashboard |
| `dashboard` | Web UI at localhost:3456 |

## ⚙️ Automation

| Command | What It Does |
|---------|-------------|
| `autopilot start` | Start background daemon |
| `autopilot stop` | Stop daemon |
| `autopilot status` | Pipeline overview |
| `autopilot config` | Configure automation settings |

## How to Run Commands

```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" <command> [args]
```

### Key Examples

**Launch the product factory (full pipeline):**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" factory launch
```

**Research product opportunities:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" factory research
```

**Build a specific product:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" factory build-one
```

**Check factory status:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" factory
```

## Typical Workflows

### "Build me a product" / "Make money"
1. Run `factory research` to find hot opportunities
2. Run `factory build-one` to choose and build a product
3. Run `factory deploy` to push it live
4. Run `factory growth` to approve marketing posts

### "Launch everything on autopilot"
1. Run `factory config` to set up Vercel + Lemon Squeezy keys
2. Run `factory launch --max 5` for full pipeline
3. Products are built, deployed, and marketed automatically

### "What's selling?"
1. Run `factory` for the dashboard
2. Run `factory catalog` for detailed product list
3. Run `factory nightly` for performance analysis

## Product Types HustleBot Can Build

| Type | Price Range | Build Time | Example |
|------|-----------|-----------|---------|
| PDF Guide | $9-49 | 15-30 min | "Claude Code Masterclass" |
| Notion Template | $5-29 | 10-20 min | "Solopreneur OS" |
| Website Template | $29-99 | 30-60 min | "LaunchPage Templates" |
| Web Tool / SaaS | $0-99/mo | 1-3 hours | "SEO Analyzer" |
| Chrome Extension | $0-49/mo | 1-2 hours | "PageGist AI Summary" |
| API Service | $9-199/mo | 1-2 hours | "AI Content API" |
| Starter Kit | $49-299 | 2-4 hours | "SaaSKit Boilerplate" |
| Full Web App | $99-499 | 4-8 hours | "AI Resume Builder" |
| Prompt Library | $9-39 | 20-40 min | "500+ Developer Prompts" |
| AI Tool | $19-199/mo | 2-6 hours | "LeadMagnet AI" |

## Response Style
- Lead with action — show commands and results
- When reporting products, include: name, state, price, revenue
- Proactively suggest building more products when catalog is small
- Always mention the factory dashboard for overview
