export async function sendNotification(title: string, body: string, data: any, env: any) {
  const accessToken = env.EXPO_ACCESS_TOKEN;
  if (!accessToken || accessToken === 'TBD') {
    console.warn('Notification skipped: EXPO_ACCESS_TOKEN missing');
    return;
  }

  // Fetch all registered tokens for the 'operator' tenant
  const { results } = await env.DB.prepare(
    'SELECT push_token FROM notification_subscriptions WHERE tenant_id = ?'
  ).bind('operator').all();

  if (results.length === 0) {
    console.warn('No push tokens found for operator');
    return;
  }

  const messages = results.map((row: any) => ({
    to: row.push_token,
    sound: 'default',
    title,
    body,
    data,
  }));

  try {
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(messages),
    });

    if (!resp.ok) {
      console.error(`Expo push failed: ${resp.status}`);
    } else {
      console.log(`Push notifications sent to ${results.length} devices`);
    }
  } catch (err) {
    console.error('Expo push error:', err);
  }
}

export async function handleSubscribe(request: Request, env: any) {
  const tenantId = request.headers.get('x-tenant-id') || 'operator';
  const { token, platform } = await request.json() as any;

  if (!token || !platform) return new Response('Missing token or platform', { status: 400 });

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT OR REPLACE INTO notification_subscriptions (id, tenant_id, push_token, platform) VALUES (?, ?, ?, ?)'
  ).bind(id, tenantId, token, platform).run();

  return new Response(JSON.stringify({ id, status: 'subscribed' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 201,
  });
}
