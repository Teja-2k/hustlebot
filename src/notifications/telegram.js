export async function sendTelegramMessage(botToken, chatId, { title, description, color, fields }) {
  if (!botToken || !chatId) return;

  // Convert embed-style data to Telegram HTML message
  const lines = [];

  if (title) lines.push(`<b>${escapeHtml(title)}</b>`);
  if (description) lines.push(escapeHtml(description));

  if (fields?.length) {
    lines.push('');
    for (const f of fields) {
      lines.push(`<b>${escapeHtml(f.name)}</b>`);
      lines.push(escapeHtml(f.value));
    }
  }

  lines.push(`\n<i>HustleBot Autopilot • ${new Date().toLocaleTimeString()}</i>`);

  const text = lines.join('\n');

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.substring(0, 4096),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error(`Telegram notification failed: ${err.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
