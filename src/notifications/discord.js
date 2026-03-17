export async function sendDiscordEmbed(webhookUrl, { title, description, color, fields }) {
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: title?.substring(0, 256),
          description: description?.substring(0, 4096),
          color: color || 0xFF6B00,
          fields: (fields || []).map(f => ({
            name: f.name.substring(0, 256),
            value: f.value.substring(0, 1024),
            inline: f.inline || false,
          })),
          timestamp: new Date().toISOString(),
          footer: { text: 'HustleBot Autopilot' },
        }]
      })
    });
  } catch (err) {
    // Don't crash the daemon for notification failures
    console.error(`Discord notification failed: ${err.message}`);
  }
}
