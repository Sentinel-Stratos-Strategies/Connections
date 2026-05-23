import { fetchMemoryContext } from './memory-contract.js';

export async function syncGenesisMemory(env: any, ctx: any) {
  const url = env.GENESIS_TUNNEL_URL;
  const token = env.AEGIS_TOKEN;
  if (!url || !token) {
    console.warn('Genesis sync skipped: GENESIS_TUNNEL_URL or AEGIS_TOKEN missing');
    return;
  }

  const tenantId = 'operator'; // Or loop through all tenants if multi-tenant sync is needed
  const memory = await fetchMemoryContext(tenantId, env);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const resp = await fetch(`${url}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenantId,
        memory,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.ok) {
      console.log(`Genesis sync successful for ${tenantId}`);
      // Audit log (manually implementing if index.ts doesn't export a helper)
      ctx.waitUntil(env.DB.prepare(
        'INSERT INTO audit_events (type, actor, tenant_id, metadata, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind('genesis_sync_ok', 'system', tenantId, JSON.stringify({ count: Object.keys(memory).length }), new Date().toISOString()).run());
    } else {
      console.error(`Genesis sync failed: ${resp.status}`);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('Genesis sync error:', err);
  }
}
