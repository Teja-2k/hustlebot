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
  const claude = getClient();

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

Respond ONLY in this exact JSON format:
{"score": <number 0-100>, "reason": "<1 line explanation>", "estimated_hours": <number>, "suggested_rate": <number>}`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // fallback
  }

  return { score: 50, reason: 'Unable to score - review manually', estimated_hours: 10, suggested_rate: profile.rate_floor };
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
