import Anthropic from '@anthropic-ai/sdk';
import { getApiKey } from '../utils/config.js';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No Anthropic API key found.');
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Classify a client message and decide how to handle it.
 * Returns { intent, urgency, autoReplyOk, suggestedReply, escalate }
 */
export async function classifyMessage(message, gigContext) {
  const claude = getClient();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are an AI assistant managing freelance client communications. Classify this message and decide the best action.

CLIENT MESSAGE:
"${message.from}: ${message.preview}"

GIG CONTEXT:
${gigContext ? `Title: ${gigContext.title}\nBudget: ${gigContext.budget}\nStatus: ${gigContext.state}` : 'No gig context available'}

Respond ONLY in JSON:
{
  "intent": "question" | "revision_request" | "approval" | "payment" | "greeting" | "scope_change" | "deadline" | "other",
  "urgency": "low" | "medium" | "high",
  "autoReplyOk": true | false,
  "suggestedReply": "<draft reply if autoReplyOk is true, or suggested reply for human review>",
  "escalate": true | false,
  "reason": "<why you made this decision>"
}`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return { intent: 'other', urgency: 'medium', autoReplyOk: false, suggestedReply: '', escalate: true, reason: 'Could not classify' };
}

/**
 * Generate a professional reply to a client message.
 */
export async function generateClientReply(message, gigContext, profile) {
  const claude = getClient();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are ${profile?.name || 'a freelancer'} responding to a client message on a freelance platform.

YOUR PROFILE:
- Name: ${profile?.name || 'Freelancer'}
- Title: ${profile?.title || 'Developer'}
- Skills: ${profile?.skills?.join(', ') || 'Various'}

GIG: ${gigContext?.title || 'Unknown project'}
STATUS: ${gigContext?.state || 'Active'}

CLIENT MESSAGE: "${message.preview || message}"

Write a professional, helpful, concise reply. Be friendly but specific.
- If they asked a question, answer it directly
- If they want a status update, give a brief progress report
- If they need clarification, ask a specific question
- Keep it under 100 words
- Sound human, not robotic

Output ONLY the reply text, nothing else.`
    }]
  });

  return response.content[0].text.trim();
}

/**
 * Review auto-delivered work before sending to client.
 */
export async function reviewDelivery(deliverables, gigContext) {
  const claude = getClient();

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are a senior QA reviewer checking work before sending to a client.

GIG: ${gigContext.title}
DESCRIPTION: ${gigContext.description?.substring(0, 500)}
DELIVERABLES: ${JSON.stringify(deliverables).substring(0, 2000)}

Review and respond in JSON:
{
  "quality": "ready" | "needs_fixes" | "major_issues",
  "score": <0-100>,
  "issues": ["<issue1>", "<issue2>"],
  "fixes_needed": ["<fix1>", "<fix2>"],
  "client_message": "<suggested delivery message to client>"
}`
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return { quality: 'needs_fixes', score: 50, issues: ['Could not review'], fixes_needed: [], client_message: '' };
}
