import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from '../utils/config.js';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('No Anthropic API key found. Set ANTHROPIC_API_KEY env var or run hustlebot init.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function scoreGigMatch(gig, profile) {
  let claude;
  try {
    claude = getClient();
  } catch (e) {
    // No API key — use keyword-based scoring instead of crashing
    return keywordScore(gig, profile);
  }

  // If API has already failed this session, don't keep retrying
  if (scoreGigMatch._apiFailed) {
    return keywordScore(gig, profile);
  }

  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a freelance opportunity scorer. Score this gig match from 0-100 and explain why in 1 line.

FREELANCER PROFILE:
- Name: ${profile.name}
- Title: ${profile.title}
- Skills: ${profile.skills.join(', ')}
- Rate: $${profile.rate_floor}/hr minimum
- Availability: ${profile.availability}
- Specialties: ${profile.specialties?.join(', ') || 'General'}

GIG:
- Title: ${gig.title}
- Description: ${gig.description?.substring(0, 500)}
- Budget: ${gig.budget || 'Not specified'}
- Skills Required: ${gig.skills?.join(', ') || 'Not specified'}
- Platform: ${gig.platform}

Respond ONLY with valid JSON, nothing else:
{"score": <number 0-100>, "reason": "<1 line explanation>", "estimated_hours": <number>, "suggested_rate": <number>}`
      }]
    });

    const text = response.content[0].text.trim();
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate the score is a reasonable number
      if (typeof parsed.score === 'number' && parsed.score >= 0 && parsed.score <= 100) {
        return {
          score: parsed.score,
          reason: parsed.reason || 'AI scored',
          estimated_hours: parsed.estimated_hours || 10,
          suggested_rate: parsed.suggested_rate || profile.rate_floor,
        };
      }
    }
  } catch (e) {
    // API call failed — mark as failed for this session to avoid spamming errors
    if (e.status === 400 || e.status === 401 || e.status === 403) {
      if (!scoreGigMatch._apiFailed) {
        console.error(`  ⚠ API key issue (${e.status}) — switching to keyword scoring for this session`);
        scoreGigMatch._apiFailed = true;
      }
    } else {
      console.error(`  ⚠ AI scoring failed: ${e.message?.substring(0, 80)}`);
    }
  }

  // Fallback: keyword-based scoring
  return keywordScore(gig, profile);
}

/**
 * Smart keyword-based scoring when AI is unavailable
 */
function keywordScore(gig, profile) {
  const text = `${gig.title} ${gig.description || ''}`.toLowerCase();
  const skills = profile.skills.map(s => s.toLowerCase());

  let score = 20; // base
  let reasons = [];

  // Skill match (+10 per matching skill, max 40)
  const matchedSkills = skills.filter(s => text.includes(s));
  const skillBonus = Math.min(40, matchedSkills.length * 10);
  score += skillBonus;
  if (matchedSkills.length > 0) reasons.push(`${matchedSkills.length} skill matches`);

  // Budget check (+15 if budget seems good)
  const budgetText = (gig.budget || '').toLowerCase();
  const budgetNums = budgetText.match(/\$?([\d,]+)/g)?.map(n => parseInt(n.replace(/[$,]/g, ''))) || [];
  if (budgetNums.length > 0) {
    const maxBudget = Math.max(...budgetNums);
    if (maxBudget >= profile.rate_floor * 5) {
      score += 15;
      reasons.push('budget fits');
    }
  }

  // Freshness bonus (+10 if recent)
  if (gig.time_submitted || gig.scraped_at) {
    const age = Date.now() - new Date(gig.time_submitted || gig.scraped_at).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      score += 10;
      reasons.push('posted today');
    } else if (age < 3 * 24 * 60 * 60 * 1000) {
      score += 5;
      reasons.push('recent post');
    }
  }

  // Low competition bonus (+10)
  if (gig.bid_count !== undefined && gig.bid_count < 10) {
    score += 10;
    reasons.push('low competition');
  }

  // Freelance keyword bonus (+5)
  const freelanceWords = ['freelancer', 'contract', 'part-time', 'remote', 'project-based', 'gig'];
  if (freelanceWords.some(w => text.includes(w))) {
    score += 5;
    reasons.push('freelance-friendly');
  }

  // Penalty for full-time indicators
  const fullTimeWords = ['full-time', 'fulltime', 'salary', 'equity', 'benefits', 'w-2', '401k', 'on-site only'];
  if (fullTimeWords.some(w => text.includes(w))) {
    score -= 20;
    reasons.push('full-time indicator');
  }

  // Demo penalty
  if (gig.is_demo) {
    score = Math.min(score, 40);
    reasons.push('demo data');
  }

  return {
    score: Math.max(5, Math.min(95, score)),
    reason: reasons.join(', ') || 'basic keyword match',
    estimated_hours: 10,
    suggested_rate: profile.rate_floor,
  };
}

export async function generateProposal(gig, profile, options = {}) {
  const claude = getClient();

  const tone = options.tone || 'professional';
  const length = options.length || 'medium';

  const lengthGuide = {
    short: '80-120 words',
    medium: '150-250 words',
    long: '300-450 words',
  };

  const toneGuide = {
    professional: 'Professional, confident, specific. Show expertise without being arrogant.',
    casual: 'Friendly, approachable, conversational. Still competent but warm.',
    bold: 'Direct, results-focused, slightly provocative. Lead with a strong hook.',
  };

  const sampleProposals = profile.sample_proposals?.length > 0
    ? `\n\nHere are examples of my past successful proposals for voice matching:\n${profile.sample_proposals.map((p, i) => `Example ${i + 1}:\n${p}`).join('\n\n')}`
    : '';

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are an elite freelance proposal writer. Write a winning proposal for this gig.

CRITICAL RULES:
- Be SPECIFIC to this exact gig - reference details from the job description
- Lead with understanding their problem, not with "I am..."
- Include a concrete mini-plan (3-4 steps) of how you'd approach this
- Mention a relevant past win or credential naturally
- End with a clear next step / call to action
- Length: ${lengthGuide[length]}
- Tone: ${toneGuide[tone]}
- DO NOT use generic filler like "I am a highly experienced..." or "I would love to..."
- DO NOT start with "Hi" or "Hello" — start with a hook about their problem

FREELANCER PROFILE:
- Name: ${profile.name}
- Title: ${profile.title}
- Skills: ${profile.skills.join(', ')}
- Years Experience: ${profile.years_experience || 'Not specified'}
- Key Achievements: ${profile.achievements?.join('; ') || 'Not specified'}
- Rate: $${profile.rate_floor}/hr
${sampleProposals}

GIG DETAILS:
- Title: ${gig.title}
- Full Description: ${gig.description}
- Budget: ${gig.budget || 'Not specified'}
- Skills Required: ${gig.skills?.join(', ') || 'Not specified'}
- Client Info: ${gig.client_info || 'Not available'}
- Platform: ${gig.platform}
- URL: ${gig.url || 'N/A'}

Write the proposal now. Output ONLY the proposal text, nothing else.`
    }]
  });

  return response.content[0].text.trim();
}

export async function generateDeliveryPlan(gig, profile) {
  const claude = getClient();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a senior technical project planner. Create a delivery plan for this freelance project.

GIG:
- Title: ${gig.title}
- Description: ${gig.description}
- Budget: ${gig.budget || 'Not specified'}
- Skills: ${gig.skills?.join(', ') || 'Not specified'}

FREELANCER: ${profile.name} - ${profile.title}
SKILLS: ${profile.skills.join(', ')}

Create a delivery plan in this JSON format:
{
  "project_name": "<slug-name>",
  "summary": "<1 line>",
  "tech_stack": ["<tech1>", "<tech2>"],
  "phases": [
    {
      "name": "<phase name>",
      "tasks": ["<task1>", "<task2>"],
      "estimated_hours": <number>,
      "deliverables": ["<deliverable1>"]
    }
  ],
  "total_hours": <number>,
  "suggested_milestones": [
    {"name": "<milestone>", "percentage": <number>}
  ],
  "claude_code_commands": ["<suggested claude code command to start>"]
}

Output ONLY valid JSON.`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    return null;
  }
}

export async function classifyGigType(gig) {
  const claude = getClient();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Classify this freelance gig into one type. Respond ONLY in JSON.

GIG: ${gig.title}
DESCRIPTION: ${gig.description?.substring(0, 300)}

{"type": "code"|"writing"|"data"|"design"|"other", "deliverable": "<what needs to be built/delivered>"}`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return { type: 'other', deliverable: 'unknown' };
}

export async function assessDeliverability(gig, profile) {
  const claude = getClient();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Can an AI coding agent (Claude Code) autonomously deliver this gig? Consider scope, complexity, and whether it needs human judgment. Respond ONLY in JSON.

GIG: ${gig.title}
DESCRIPTION: ${gig.description?.substring(0, 400)}
FREELANCER SKILLS: ${profile.skills.join(', ')}

{"canAutoDeliver": true|false, "confidence": <0-100>, "reason": "<1 line>"}`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return { canAutoDeliver: false, confidence: 0, reason: 'Unable to assess' };
}
