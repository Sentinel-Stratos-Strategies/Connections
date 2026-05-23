import { sendNotification } from './notifications.js';

export async function runDriftScanner(env: any) {
  // 1. Check for recent drift events in D1
  const { results: driftEvents } = await env.DB.prepare(
    "SELECT * FROM events WHERE category = 'drift' AND created_at > datetime('now', '-1 hour') ORDER BY created_at DESC"
  ).all();

  if (driftEvents.length > 0) {
    const latest = driftEvents[0];
    await sendNotification(
      `Drift Detected: ${latest.severity.toUpperCase()}`,
      latest.message,
      { tenantId: 'operator', driftType: 'infrastructure', severity: latest.severity },
      env
    );
    return;
  }

  // 2. Check FLAGS policy markers (e.g. if a manual override is active)
  const driftFlag = await env.FLAGS.get('drift_detected');
  if (driftFlag === 'true') {
    await sendNotification(
      'Drift Alert (KV)',
      'A persistent drift condition is marked in KV storage.',
      { tenantId: 'operator', driftType: 'policy', severity: 'high' },
      env
    );
  }
}

export async function handleDriftWebhook(request: Request, env: any) {
  // Internal webhook for external drift scanners (e.g. GitHub Actions)
  const body: any = await request.json();
  const { severity, message, details } = body;

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO events (id, category, severity, message, metadata, source) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, 'drift', severity || 'medium', message, JSON.stringify(details || {}), 'api').run();

  await sendNotification(
    `Drift Alert: ${severity.toUpperCase()}`,
    message,
    { tenantId: 'operator', driftType: 'infrastructure', severity },
    env
  );

  return new Response(JSON.stringify({ id, status: 'alerted' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
