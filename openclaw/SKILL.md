---
name: hustlebot
version: 1.0.0
description: Manage HustleBot — your automated freelance agent that scans gigs, writes proposals, submits them, delivers work, and tracks payments
author: saite
tags:
  - freelancing
  - automation
  - hustlebot
  - gigs
  - proposals
  - earnings
triggers:
  - hustlebot
  - gig
  - gigs
  - freelance
  - proposal
  - scan
  - earnings
  - autopilot
  - deliver
  - payment
tools:
  - Bash
---

# HustleBot — Automated Freelance Agent

You are managing HustleBot, a fully automated AI freelance system installed at `C:\Users\saite\Documents\MIllionaire\hustlebot`.

## Important Setup

Before running any HustleBot command, always set the PATH:
```bash
export PATH="$PATH:/c/Program Files/nodejs"
```

The CLI entry point is:
```bash
node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" <command>
```

## Available Commands

### Finding Work
| Command | What It Does |
|---------|-------------|
| `scan` | Scan all 5 platforms (Upwork, Twitter, HackerNews, Freelancer, Fiverr) for matching gigs |
| `scan -p <platform>` | Scan a specific platform (upwork/twitter/hackernews/freelancer/fiverr) |
| `propose <number>` | Generate an AI-powered proposal for gig #number |
| `propose <number> --tone bold` | Generate with a specific tone (professional/casual/bold) |

### Delivering Work
| Command | What It Does |
|---------|-------------|
| `deliver <number>` | Create project workspace for a gig |
| `auto-deliver <number>` | AI-generate complete project deliverables with code, README, and configs |

### Tracking Money
| Command | What It Does |
|---------|-------------|
| `earnings stats` | Show revenue analytics (total/net/fees/conversion rate) |
| `earnings stats --period month` | Filter stats by period (week/month/year/all) |
| `earnings add-project "Title" --amount 500` | Track a won project |
| `earnings add-payment 500 --platform upwork --fee 100` | Record a payment received |
| `earnings projects` | List all tracked projects |
| `earnings log-time <project-id> 4 "Built API"` | Log hours worked on a project |

### Automation
| Command | What It Does |
|---------|-------------|
| `autopilot config` | Configure autonomy level, notifications, thresholds |
| `autopilot start` | Start the background scanning/proposing daemon |
| `autopilot stop` | Stop the daemon |
| `autopilot status` | Show pipeline state + daemon status |
| `autopilot run-now` | Trigger an immediate scan + propose cycle |
| `autopilot logs` | View recent activity logs |

### Other
| Command | What It Does |
|---------|-------------|
| `status` | Show terminal dashboard with pipeline overview |
| `dashboard` | Launch the web dashboard at http://localhost:3456 |
| `auth upwork` | Set up browser session for Upwork auto-submission |
| `auth freelancer` | Set up browser session for Freelancer auto-submission |
| `init` | Set up or update your freelancer profile |

## How to Run Commands

Always use this pattern:
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" <command> [args]
```

### Examples

**Scan for gigs:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" scan
```

**Scan only Upwork:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" scan -p upwork
```

**Write a proposal for gig #1:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" propose 1
```

**Check earnings:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" earnings stats
```

**Start autopilot:**
```bash
export PATH="$PATH:/c/Program Files/nodejs" && node "C:/Users/saite/Documents/MIllionaire/hustlebot/src/index.js" autopilot start
```

## Typical Workflows

### "Find me gigs" / "Scan for work"
1. Run `scan` to find gigs across all platforms
2. Report the top 5 gigs with their scores, platforms, and budgets
3. Ask if the user wants proposals written for any of them

### "Write a proposal" / "Apply to gig #X"
1. Run `propose <number>` to generate an AI proposal
2. Show the proposal text to the user
3. Ask if they want to submit it or modify the tone

### "How much have I earned?" / "Show earnings"
1. Run `earnings stats` to get the full breakdown
2. Report total earned, net after fees, effective hourly rate, and pipeline value

### "Start autopilot" / "Run everything automatically"
1. Run `autopilot config` if not configured yet
2. Run `autopilot start` to begin the daemon
3. Confirm it's running with `autopilot status`

### "Deliver work for gig #X"
1. Run `auto-deliver <number>` to generate complete project files
2. Report what files were created and the delivery status

## Response Style
- Be concise and action-oriented
- Always show the actual output from commands
- When reporting gigs, format them as a clean list with scores
- When reporting earnings, highlight the key numbers
- Proactively suggest next steps (e.g., after scanning, suggest writing proposals for top gigs)
