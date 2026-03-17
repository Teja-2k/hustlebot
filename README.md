# 🤖 HustleBot

### Your AI agent that finds freelance gigs, writes winning proposals, and helps you deliver — powered by Claude.

> **I built an AI that scans for freelance opportunities, scores them against my skills, writes personalized proposals, and scaffolds project delivery. It landed me a $2,000 contract in its first week.**

---

```
$ hustlebot scan

  🔍 Scanning for gigs...

  Keywords: OpenClaw, Claude Code, AI automation, data pipeline
  Platforms: upwork, twitter, hackernews

  ✓ upwork: found 8 potential gigs
  ✓ twitter: found 5 potential gigs
  ✓ hackernews: found 3 potential gigs
  ✓ Scored 16 gigs with AI

  ━━━ Found 16 matching gigs ━━━

  #  │ Score │ Platform │ Title                                          │ Budget
  1  │ 92%   │ upwork   │ OpenClaw AI Agent Setup & Configuration         │ $300-$800 Fixed
  2  │ 88%   │ twitter  │ @saas_builder: Looking for Claude Code expert   │ DM to discuss
  3  │ 85%   │ upwork   │ Claude Code Expert — Build AI Dashboard         │ $50-75/hr
  4  │ 81%   │ hn       │ HN Hiring: AI/ML startup — Data Engineer        │ $150-200/hr
```

```
$ hustlebot propose 1

  ✍️  Generating proposal...

  ╭────────────────── YOUR PROPOSAL ──────────────────╮
  │                                                    │
  │  Setting up OpenClaw on a Mac Mini with Docker,    │
  │  Telegram integration, and custom skills is        │
  │  exactly what I've been doing for the past month.  │
  │  I've configured 6 production instances with...    │
  │                                                    │
  ╰────────────────────────────────────────────────────╯

  ✓ Copied to clipboard!
```

---

## Why HustleBot?

Every developer thinks about freelancing. Most never start because:

- 😩 **Finding gigs is tedious** — browsing Upwork for hours
- 😩 **Writing proposals is painful** — the blank page problem
- 😩 **Delivering is slow** — even for work you know how to do

HustleBot fixes all three:

- 🔍 **Scans** Upwork, Twitter/X, and HackerNews automatically
- 🧠 **Scores** each gig against your skills using AI
- ✍️ **Writes** personalized proposals that actually win
- 🚀 **Scaffolds** project delivery with Claude Code integration

**The AI doesn't replace you. It removes the friction so you can focus on the work.**

---

## Quick Start

```bash
# Install
npx hustlebot

# Or clone and run
git clone https://github.com/Teja-2k/hustlebot.git
cd hustlebot
npm install
npm link

# Set up your profile (3 minutes)
hustlebot init

# Find gigs
hustlebot scan

# Write a proposal
hustlebot propose 1

# See your dashboard
hustlebot status
```

### Requirements

- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com))
- Optional: Twitter API key for live tweet scanning
- Optional: Claude Code for the `deliver` workflow

---

## Commands

| Command | What it does |
|---------|-------------|
| `hustlebot init` | Set up your skill profile, API keys, and preferences |
| `hustlebot scan` | Scan platforms for matching gigs |
| `hustlebot scan -p upwork` | Scan specific platform |
| `hustlebot propose <#>` | Generate a personalized proposal for a gig |
| `hustlebot propose <#> --tone bold` | Generate with different tone (professional/casual/bold) |
| `hustlebot deliver <#>` | Create project workspace + CLAUDE.md for Claude Code |
| `hustlebot status` | View your earnings dashboard and pipeline |
| `hustlebot autopilot config` | Configure autopilot settings (autonomy level, Discord webhook) |
| `hustlebot autopilot start` | Start the background autopilot daemon |
| `hustlebot autopilot stop` | Stop the autopilot daemon |
| `hustlebot autopilot status` | View pipeline state + daemon status |
| `hustlebot autopilot run-now` | Trigger an immediate scan + propose cycle |
| `hustlebot autopilot logs` | View autopilot activity logs |

---

## How It Works

### 1. Profile → Your AI learns who you are
`hustlebot init` creates a skill profile that the AI uses to match gigs and write proposals in your voice.

### 2. Scan → Find opportunities everywhere
Scans multiple platforms simultaneously:
- **Upwork** — web scraping for latest job posts
- **Twitter/X** — finds people asking for help with your skills
- **HackerNews** — "Who's Hiring" threads + "Ask HN" posts

Each gig gets an AI-powered match score (0-100%) based on your skills, rate, and availability.

### 3. Propose → Write winning proposals
Claude analyzes the job description, cross-references your profile, and generates a proposal that:
- Opens with a hook about their specific problem
- Includes a mini-plan (3-4 steps)
- References your relevant experience
- Ends with a clear call to action

### 4. Deliver → Ship with Claude Code
`hustlebot deliver` generates a project workspace with:
- A detailed delivery plan
- A `CLAUDE.md` file ready for Claude Code
- Task breakdowns by phase

Just `cd` into the project and run `claude` to start building.

### 5. Autopilot → Full Automation

```bash
# Configure autonomy level + Discord notifications
hustlebot autopilot config

# Start the daemon
hustlebot autopilot start

# Check your pipeline
hustlebot autopilot status
```

Three autonomy levels:

| Level | Behavior |
|-------|----------|
| **Supervised** | Auto-scan + score + draft proposals. Pauses for your approval before submitting. |
| **Semi-Auto** | Auto-submits proposals for gigs scoring 85+. Pauses for 70-84. Skips below 70. |
| **Full-Auto** | Auto-submits all 70+. Auto-delivers won gigs using Claude Code headless. You get summary notifications. |

The pipeline tracks every gig through its lifecycle:
```
DISCOVERED → SCORED → PROPOSAL_DRAFT → SUBMITTED → WON → DELIVERING → DELIVERED → PAID
```

Discord notifications keep you informed without needing to check the terminal.

---

## The Stack

- **Runtime:** Node.js (ES modules)
- **AI:** Claude Sonnet 4 via Anthropic SDK
- **Scraping:** Cheerio + fetch
- **Scheduling:** node-schedule (cron-like daemon)
- **Notifications:** Discord webhooks
- **UI:** Chalk, Boxen, Inquirer, cli-table3
- **Storage:** Local YAML/JSON in ~/.hustlebot/
- **Delivery:** Claude Code headless mode

---

## Roadmap

- [x] Profile setup wizard
- [x] Upwork scanner
- [x] Twitter/X scanner
- [x] HackerNews scanner
- [x] AI-powered gig scoring
- [x] AI proposal generation
- [x] Project delivery scaffolding
- [x] Dashboard
- [x] Autopilot daemon (background scan/propose/deliver cycles)
- [x] Gig pipeline state machine
- [x] Discord webhook notifications
- [x] Three autonomy levels (supervised/semi-auto/full-auto)
- [x] Deduplication across scan cycles
- [x] Auto-delivery via Claude Code headless
- [ ] Freelancer.com scanner
- [ ] LinkedIn scanner
- [ ] Telegram notifications
- [ ] Proposal templates library
- [ ] Earnings tracking + analytics
- [ ] Team mode (multiple profiles)

---

## Contributing

PRs welcome! Check `CLAUDE.md` for development guidelines.

The fastest way to contribute: add a new scanner in `src/scanners/`. Each scanner is a single file that exports a scan function returning an array of gig objects.

---

## License

MIT — use it, modify it, build a business on it.

---

**Built with Claude Code in a weekend. Now it pays for itself.**

⭐ **Star this repo if you think freelancing should be less painful.**
