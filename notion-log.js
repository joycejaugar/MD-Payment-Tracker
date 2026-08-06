export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { entry } = req.body;
    const isRefund = entry.type === 'Refund / Wire Out';
    const isWire   = entry.type === 'Manual Invoice';
    const isOOO    = entry.type?.startsWith('OOO');

    if (!isRefund && !isWire && !isOOO) {
      return res.status(200).json({ success: true, skipped: true });
    }

    const REFUND_DB = '3b4e63b2b0a380f38686d18e679f93a0';
    const WIRE_DB   = '3b4e63b2b0a38002a3a4dc2d054299c1';
    const REFUND_PROJECT = 'https://app.notion.com/p/3b4e63b2b0a380e5bea7c4012fb6bfc1';
    const WIRE_PROJECT   = 'https://app.notion.com/p/3b4e63b2b0a380c3bc8fddf276471d64';

    const dbId         = isRefund ? REFUND_DB : WIRE_DB;
    const projectUrl   = isRefund ? REFUND_PROJECT : WIRE_PROJECT;
    const label        = isRefund ? 'Refund' : isWire ? 'Wire' : 'OOO';
    const taskTitle    = `${entry.md} — ${label} $${parseFloat(entry.amount || 0).toFixed(2)} · ${entry.medspa || entry.pc || ''} · ${entry.date}`;

    const content = [
      `**MD:** ${entry.md}`,
      `**Amount:** $${parseFloat(entry.amount || 0).toFixed(2)}`,
      `**Date:** ${entry.date}`,
      `**Medspa:** ${entry.medspa || '—'}`,
      `**PC:** ${entry.pc || '—'}`,
      isRefund ? `**Refunded to Original Method:** $${parseFloat(entry.amount || 0).toFixed(2)}` : '',
      isRefund ? `**Refunded to Moxie Balance:** $${parseFloat(entry.moxie_balance || 0).toFixed(2)}` : '',
      `**Notes:** ${entry.notes || '—'}`,
      `**Added by:** ${entry.added_by || '—'}`,
      ``,
      `---`,
      ``,
      `📎 *Upload receipt below*`,
    ].filter(Boolean).join('\n');

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          'Task name': { title: [{ text: { content: taskTitle } }] },
          'Status':    { status: { name: 'Done' } },
          'Project':   { relation: [{ url: projectUrl }] },
        },
        children: [{
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content } }]
          }
        }]
      })
    });

    const data = await notionRes.json();
    if (!notionRes.ok) {
      return res.status(500).json({ success: false, error: data.message });
    }

    return res.status(200).json({ success: true, url: data.url });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
